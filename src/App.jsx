import { useState, useEffect, useRef, useMemo } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

// Views
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import HandicapView from './components/HandicapView';
import LoginViewFirebase from './components/LoginViewFirebase';
import PublicScorecardView from './components/PublicScorecardView';
import TeamLiveScorecard from './components/TeamLiveScorecard';
import TournamentsCentralView from './components/TournamentsCentralView';
import AdminDashboardView from './components/admin/AdminDashboardView';
import AdminRoute from './components/admin/AdminRoute';

// New Components
import AppHeader from './components/AppHeader';
import NavTabs from './components/NavTabs';
import ProfileModal from './components/ProfileModal';

// Firebase
import { db } from './firebase';
import { onSnapshot, setDoc, doc } from 'firebase/firestore';
import { getUserDocId, getUserProfileRef, fetchUserProfileByUsername } from './utils/userProfiles';
import { selfHealPhoto } from './services/profile.service';
import { writeSavedUser } from './utils/cache';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useHandicap } from './hooks/useHandicap';
import { useTournaments } from './hooks/useTournaments';

// Services
import { uploadProfilePhoto, updateUserProfile, recoverLegacyProfile } from './services/profile.service';
import { subscribeToPreferences, subscribeToResults, saveResult, saveAllResults, deleteResult, savePreferences } from './services/results.service';

// Config
import { IS_MULTI, DEFAULT_PREFERENCES } from './config/app';

// ─────────────────────────────────────────────────────────────────────────────

function AppContent() {
  const location = useLocation();


  // ── PWA Service Worker (silent auto-update) ────────────────────────────
  const { updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;
      // Check for updates every 10 minutes
      setInterval(() => { r.update().catch(() => {}); }, 10 * 60 * 1000);
      // Also check when the user comes back to the tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') r.update().catch(() => {});
      });
    },
    onNeedRefresh() {
      // Auto-apply silently on non-live pages
      const isLivePage = window.location.pathname.includes('/live');
      if (!isLivePage) {
        updateServiceWorker(true);
      }
    },
    onRegisterError(error) { console.log('SW registration error', error); },
  });

  useEffect(() => {
    const handleControllerChange = () => {
      // Don't auto-reload on live scorecard pages - it disrupts watchers mid-game
      const isLivePage = window.location.pathname.includes('/live');
      if (isLivePage) return;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
  }, []);

  const handleAppUpdate = async () => {
    // 1. Unregister all service workers
    if (navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
      }
    }
    // 2. Clear caches
    if (window.caches) {
      const keys = await caches.keys();
      for (let key of keys) {
        await caches.delete(key);
      }
    }
    // 3. Clear local storage partially or just force reload
    updateServiceWorker(true);
    // 4. Force hard reload
    window.location.reload(true);
  };

  // ── Core state ───────────────────────────────────────────────────────────
  const [results, setResults] = useState({});
  const [customTournaments, setCustomTournaments] = useState([]);
  const [preferences, setPreferences] = useState({ ...DEFAULT_PREFERENCES });

  // ── Auth hook ────────────────────────────────────────────────────────────
  const {
    user, setUser,
    sessionOwner,
    linkedUsers, setLinkedUsers,
    authReady,
    handleLogin, handleLogout,
    handleSwitchUser, handleReturnToOwner,
    resetSessionState,
  } = useAuth({
    setResults,
    setCustomTournaments,
    setPreferences,
    setHandicap: () => {},    // patched below after handicap hook
    setPdfUrl: () => {},      // patched below after handicap hook
  });

  // ── Handicap hook ────────────────────────────────────────────────────────
  const {
    handicap, setHandicap,
    pdfUrl, setPdfUrl,
    isUpdatingHandicap,
    history,
    refreshHandicap,
    handleHandicapButtonClick,
    handleOpenHandicapPdf,
  } = useHandicap(user, setUser);

  const activeUserDocId = getUserDocId(user);

  // ── Photo upload state ───────────────────────────────────────────────────
  const [photoVersion, setPhotoVersion] = useState(Date.now());
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const newPhotoUrl = await uploadProfilePhoto(file, user);
      const updatedUser = { ...user, photo_url: newPhotoUrl };
      setUser(updatedUser);
      writeSavedUser(updatedUser);
      setPhotoVersion(Date.now());
      alert('¡Foto actualizada en Cloudflare R2!');
    } catch (err) {
      console.error('R2 Upload error:', err);
      alert(`Error al subir a Cloudflare R2: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // ── Profile modal state ──────────────────────────────────────────────────
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editFederationId, setEditFederationId] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editHandicap, setEditHandicap] = useState('');
  const [editClub, setEditClub] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const openProfileModal = () => {
    setEditFullName(user.full_name || '');
    setEditFederationId(user.federation_id || '');
    setEditEmail(user.email || '');
    setEditHandicap(user.current_handicap || '');
    setEditClub(user.club || '');
    setIsProfileModalOpen(true);
  };

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const updatedUser = await updateUserProfile(user, {
        fullName: editFullName,
        federationId: editFederationId,
        email: editEmail,
        current_handicap: editHandicap,
        club: editClub
      });
      setUser(updatedUser);
      if (IS_MULTI) writeSavedUser(updatedUser);
      setIsProfileModalOpen(false);
      alert('Perfil actualizado correctamente');
      setHandicap(editHandicap);
    } catch (err) {
      console.error(err);
      alert('Aviso: Algunos datos pueden no haberse guardado en el servidor, pero se han asimilado localmente.');
      
      // Optimistic local update so they aren't blocked from seeing the handicap
      const fallbackUser = {
        ...user,
        full_name: editFullName,
        federation_id: editFederationId,
        current_handicap: editHandicap,
        club: editClub
      };
      setUser(fallbackUser);
      if (IS_MULTI) writeSavedUser(fallbackUser);
      setHandicap(editHandicap);
      setIsProfileModalOpen(false);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleRecoverProfile = async () => {
    if (!user?.username) return;
    setIsUpdatingProfile(true);
    try {
      const updated = await recoverLegacyProfile(user);
      setUser(updated);
      writeSavedUser(updated);
      setPhotoVersion(Date.now());
      setEditFullName(updated.full_name);
      setEditFederationId(updated.federation_id || '');
      alert('✅ Perfil restaurado correctamente desde la base de datos.');
    } catch (e) {
      console.error(e);
      alert(e.message || 'Error al recuperar datos.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleHardReset = () => {
    if (!window.confirm('¿Estás seguro? Esto cerrará la sesión y limpiará TODA la caché del móvil. Tendrás que volver a entrar.')) return;
    localStorage.clear();
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister();
      });
    }
    window.location.href = window.location.origin + import.meta.env.BASE_URL;
  };

  // ── Preferences ──────────────────────────────────────────────────────────
  const handleUpdatePreferences = async (newGroups, newHiddenIds) => {
    const newPrefs = {
      ...preferences,
      groups: newGroups || preferences.groups,
      hiddenIds: newHiddenIds || preferences.hiddenIds,
    };
    setPreferences(newPrefs);
    if (user) {
      try { await savePreferences(user, newPrefs); }
      catch (err) { console.error('[prefs] Error saving:', err); }
    }
  };

  const handleUpdateTheme = async (orgName, color) => {
    const newPrefs = {
      ...preferences,
      themes: { ...preferences.themes, [orgName]: { bg: color, border: color } },
    };
    setPreferences(newPrefs);
    if (user) {
      try { await savePreferences(user, newPrefs); }
      catch (err) { console.error('[prefs] Error saving theme:', err); }
    }
  };

  // ── User data sync (results, custom tournaments, preferences) ─────────────
  useEffect(() => {
    if (!user?.username || !activeUserDocId) return;

    const unsubPrefs = subscribeToPreferences(user, (data) => {
      setPreferences(prev => ({ ...prev, ...data, themes: data.themes || {} }));
    });

    if (user.username?.toLowerCase() === 'mariaros' || user.full_name?.toLowerCase().includes('maria ros')) {
      const meritIdsToHide = [1, 5, 7, 10, 13, 18, 19, 20, 21, 24, 25, 26];
      setPreferences(prev => ({
          ...prev,
          hiddenIds: Array.from(new Set([...(prev.hiddenIds || []), ...meritIdsToHide]))
      }));
    } else if (user.username === 'jordi') {
      const meritHiddenIds = [105, 2, 110, 4, 6, 8, 9, 11, 12, 14, 15, 16, 17, 22, 23, 27, 28, 103, 104];
      setPreferences({ groups: ['club'], hiddenIds: meritHiddenIds, themes: {} });
    }

    const unsubResults = subscribeToResults(user, setResults);

    return () => { unsubPrefs(); unsubResults(); };
  }, [activeUserDocId, user?.username]);

  // ── Profile real-time sync (photo, name, linked users) ────────────────────
  useEffect(() => {
    if (!user?.username || !activeUserDocId) return;

    const unsubProfile = onSnapshot(getUserProfileRef(db, user), (snapshot) => {
      if (!snapshot.exists()) return;

      const freshData = snapshot.data();
      const managedUsernames = Array.isArray(freshData.managed_users) ? freshData.managed_users : [];
      const incomingPhoto = freshData.photo_url;
      const incomingName = freshData.full_name;
      const currentManaged = JSON.stringify(user.managed_users || []);
      const incomingManaged = JSON.stringify(managedUsernames);

      setUser(prev => {
        if (!prev || prev.username !== user.username) return prev;
        const photoToUse = (incomingPhoto && String(incomingPhoto).trim() !== '') ? incomingPhoto : prev.photo_url;
        void selfHealPhoto(prev, incomingPhoto);
        if (prev.photo_url !== photoToUse || prev.full_name !== incomingName || currentManaged !== incomingManaged) {
          const updated = { ...prev, ...freshData, photo_url: photoToUse, manager_id: prev.manager_id };
          writeSavedUser(updated);
          setPhotoVersion(Date.now());
          return updated;
        }
        return prev;
      });

      if (managedUsernames.length > 0) {
        const fetchLinked = async () => {
          try {
            const profiles = [{ ...freshData, username: user.username, docId: activeUserDocId }];
            for (const childId of managedUsernames) {
              const childProfile = await fetchUserProfileByUsername(db, childId);
              if (childProfile) profiles.push(childProfile);
            }
            const unique = profiles.filter((v, i, a) => a.findIndex(t => t.username === v.username) === i);
            setLinkedUsers(unique);
          } catch (e) {
            console.error('[profile] Error fetching linked profiles:', e);
          }
        };
        void fetchLinked();
      } else if (freshData.role !== 'manager' && !user.manager_id) {
        setLinkedUsers([]);
      }
    });

    return () => unsubProfile();
  }, [activeUserDocId, user?.username]);

  // ── Nuke helper (dev console) ─────────────────────────────────────────────
  useEffect(() => {
    window.nukeUserData = async () => {
      if (!user) return console.error('No user logged in');
      const confirm = window.confirm(`ATENCIÓN: Esto borrará TODOS los torneos y resultados de ${user.full_name}. ¿Estás seguro?`);
      if (!confirm) return;
      console.log('🔥 Starting Nuke Process for', user.username);
      try {
        const { getDocs, writeBatch } = await import('firebase/firestore');
        const { getUserSubcollectionRef } = await import('./utils/userProfiles');
        const batch = writeBatch(db);
        let count = 0;
        const resultsSnap = await getDocs(getUserSubcollectionRef(db, user, 'results'));
        resultsSnap.forEach(doc => { batch.delete(doc.ref); count++; });
        const customSnap = await getDocs(getUserSubcollectionRef(db, user, 'custom_tournaments'));
        customSnap.forEach(doc => { batch.delete(doc.ref); count++; });
        if (count > 0) {
          await batch.commit();
          alert('Todos los datos han sido borrados.');
          window.location.reload();
        } else {
          alert('No había datos para borrar.');
        }
      } catch (e) {
        console.error('Nuke failed', e);
        alert('Error al borrar datos: ' + e.message);
      }
    };
  }, [user]);

  // ── Tournaments hook ─────────────────────────────────────────────────────
  const {
    baseTournaments,
    tournaments,
    filteredTournaments,
    currentSeason,
    setCurrentSeason,
    availableSeasons,
    handleAddTournament,
    handleUpdateTournament,
    handleDeleteTournament,
    handleJoinTournament,
    handleLeaveTournament,
    subscribedTournaments,
    sharedTournaments,
  } = useTournaments(user, preferences, handleUpdatePreferences, results);

  // ── Results handlers ─────────────────────────────────────────────────────
  const handleUpdateResults = async (newResults) => {
    setResults(newResults);
    if (!user) return;
    try { await saveAllResults(user, newResults); }
    catch (err) { console.error('[results] Error saving all results:', err); }
  };

  const handleSaveSpecificResult = async (id, data) => {
    if (!user) return;
    setResults(prev => ({ ...prev, [id]: data }));
    await saveResult(user, id, data);
  };

  const handleDeleteResult = async (id) => {
    if (!user) return;
    try {
      setResults(prev => { const next = { ...prev }; delete next[id]; return next; });
      await deleteResult(user, id);
    } catch (err) {
      console.error('[results] Error deleting result:', err);
    }
  };

  // ── Routing guards ───────────────────────────────────────────────────────
  const isLive = location.pathname.startsWith('/live/') || location.pathname.startsWith('/live-team/');

  if (isLive) {
    return (
      <Routes>
        <Route path="/live/:username/:id" element={<PublicScorecardView />} />
        <Route path="/live-team/:id" element={<TeamLiveScorecard />} />
      </Routes>
    );
  }

  if (IS_MULTI && !authReady && !user) {
    return (
      <div className="app-container fade-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ padding: '1.5rem 2rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8em', opacity: 0.7, color: 'var(--color-text-muted)' }}>(v2.9.1)</span>
          Conectando con Firebase...
        </div>
      </div>
    );
  }

  if (!user && IS_MULTI) return <LoginViewFirebase onLogin={handleLogin} />;
  if (!user && !IS_MULTI) return null;

  // Special groups for certain users (hide merit group)
  const isSpecialUser = ['txell', 'ona', 'mariaros'].includes(user?.username?.toLowerCase()) || 
                      user?.full_name?.toLowerCase().includes('maria ros');

  return (
    <div className="app-container fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <AppHeader
        user={user}
        sessionOwner={sessionOwner}
        linkedUsers={linkedUsers}
        photoVersion={photoVersion}
        isUploadingPhoto={isUploadingPhoto}
        handicap={handicap}
        pdfUrl={pdfUrl}
        isUpdatingHandicap={isUpdatingHandicap}
        currentSeason={currentSeason}
        availableSeasons={availableSeasons}
        onSeasonChange={setCurrentSeason}
        onPhotoUpload={handlePhotoUpload}
        onOpenProfileModal={openProfileModal}
        onSwitchUser={handleSwitchUser}
        onReturnToOwner={handleReturnToOwner}
        onHandicapClick={handleHandicapButtonClick}
        onOpenPdf={handleOpenHandicapPdf}
        onAppUpdate={handleAppUpdate}
        onLogout={handleLogout}
      />

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <NavTabs />

      {/* ── Main content routes ──────────────────────────────────────────── */}
      <main>
        <Routes>
          <Route path="/" element={
            <CalendarView
              viewMode="calendar"
              tournaments={filteredTournaments}
              results={results}
              activeGroups={isSpecialUser ? [] : preferences.groups}
              hiddenGroups={isSpecialUser ? ['merit'] : []}
              customThemes={preferences.themes}
              user={user}
              onUpdateGroups={handleUpdatePreferences}
              onUpdateTheme={handleUpdateTheme}
              onAddTournament={handleAddTournament}
              onUpdateResults={handleUpdateResults}
              onSaveSpecificResult={handleSaveSpecificResult}
              onDeleteResult={handleDeleteResult}
              onDeleteTournament={handleDeleteTournament}
              onUpdateTournament={handleUpdateTournament}
              onJoinTournament={handleJoinTournament}
              onLeaveTournament={handleLeaveTournament}
              managedUsers={linkedUsers.map(u => u.username)}
              subscribedTournaments={subscribedTournaments}
              allAvailableTournaments={[...(baseTournaments || []), ...(sharedTournaments || [])]}
            />
          } />
          <Route path="/event/:id" element={
            <CalendarView
              viewMode="calendar"
              tournaments={filteredTournaments}
              results={results}
              activeGroups={isSpecialUser ? [] : preferences.groups}
              hiddenGroups={isSpecialUser ? ['merit'] : []}
              customThemes={preferences.themes}
              user={user}
              onUpdateGroups={handleUpdatePreferences}
              onUpdateTheme={handleUpdateTheme}
              onAddTournament={handleAddTournament}
              onUpdateResults={handleUpdateResults}
              onSaveSpecificResult={handleSaveSpecificResult}
              onDeleteResult={handleDeleteResult}
              onDeleteTournament={handleDeleteTournament}
              onUpdateTournament={handleUpdateTournament}
              onJoinTournament={handleJoinTournament}
              onLeaveTournament={handleLeaveTournament}
              managedUsers={linkedUsers.map(u => u.username)}
              subscribedTournaments={subscribedTournaments}
              allAvailableTournaments={[...(baseTournaments || []), ...(sharedTournaments || [])]}
            />
          } />
          <Route path="/stats" element={<StatsView user={user} linkedUsers={linkedUsers} results={results} tournaments={tournaments} />} />
          <Route path="/handicap" element={<HandicapView user={user} currentHandicap={handicap} history={history} results={results} tournaments={tournaments} />} />
          <Route path="/tournaments" element={
            <TournamentsCentralView 
              user={user} 
              tournaments={tournaments} 
              subscribedTournaments={subscribedTournaments}
              onJoinTournament={handleJoinTournament} 
              onLeaveTournament={handleLeaveTournament}
            />
          } />
          <Route path="/admin" element={
            <AdminRoute user={sessionOwner || user}>
              <AdminDashboardView user={sessionOwner || user} />
            </AdminRoute>
          } />
        </Routes>
      </main>


      {/* ── Profile Modal ────────────────────────────────────────────────── */}
      <ProfileModal
        user={user}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        fullName={editFullName}
        setFullName={setEditFullName}
        email={editEmail}
        setEmail={setEditEmail}
        federationId={editFederationId}
        setFederationId={setEditFederationId}
        handicap={editHandicap}
        setHandicap={setEditHandicap}
        club={editClub}
        setClub={setEditClub}
        isUpdating={isUpdatingProfile}
        onSubmit={handleUpdateProfile}
        onRecoverProfile={handleRecoverProfile}
        onHardReset={handleHardReset}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <BrowserRouter basename={basename}>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
