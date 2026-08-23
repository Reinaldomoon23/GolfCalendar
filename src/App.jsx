import { Suspense, lazy, useState, useEffect, useRef, useMemo } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';

// Views
const CalendarView = lazy(() => import('./components/CalendarView'));
const StatsView = lazy(() => import('./components/StatsView'));
const HandicapView = lazy(() => import('./components/HandicapView'));
const LoginViewFirebase = lazy(() => import('./components/LoginViewFirebase'));
const PublicScorecardView = lazy(() => import('./components/PublicScorecardView'));
const PublicLeaderboardView = lazy(() => import('./components/PublicLeaderboardView'));
const TeamLiveScorecard = lazy(() => import('./components/TeamLiveScorecard'));
const TournamentsCentralView = lazy(() => import('./components/TournamentsCentralView'));
const FriendsView = lazy(() => import('./components/FriendsView'));
const AdminDashboardView = lazy(() => import('./components/admin/AdminDashboardView'));
const AdminRoute = lazy(() => import('./components/admin/AdminRoute'));

// New Components
import AppHeader from './components/AppHeader';
import NavTabs from './components/NavTabs';
import ProfileModal from './components/ProfileModal';

// Firebase
import { db } from './firebase';
import { onSnapshot, setDoc, doc } from 'firebase/firestore';
import { getUserDocId, getUserProfileRef, fetchUserProfileByUsername } from './utils/userProfiles';
import { writeLinkedUsers, writeSavedUser } from './utils/cache';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useHandicap } from './hooks/useHandicap';
import { useTournaments } from './hooks/useTournaments';

// Services
import { uploadProfilePhoto, updateUserProfile, recoverLegacyProfile } from './services/profile.service';
import { subscribeToPreferences, subscribeToResults, saveResult, saveAllResults, deleteResult, savePreferences } from './services/results.service';
import { subscribeToChats } from './services/chat.service';
import { subscribeToForegroundPushMessages } from './services/notifications.service';

// Config
import { IS_MULTI, DEFAULT_PREFERENCES } from './config/app';

// ─────────────────────────────────────────────────────────────────────────────

function LoadingShell({ dark = false, text = 'Cargando...' }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: dark ? '#0f172a' : 'var(--color-bg)',
      color: dark ? '#e2e8f0' : 'var(--color-text)',
      fontWeight: '800'
    }}>
      {text}
    </div>
  );
}

function PublicRoutes() {
  return (
    <Suspense fallback={<LoadingShell dark text="Cargando datos en vivo..." />}>
      <Routes>
        <Route path="/live/:username/:id" element={<PublicScorecardView />} />
        <Route path="/leaderboard/:id" element={<PublicLeaderboardView />} />
        <Route path="/live-team/:teamId/:tournamentId" element={<TeamLiveScorecard />} />
      </Routes>
    </Suspense>
  );
}

function AppRouterShell() {
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith('/live/')
    || location.pathname.startsWith('/live-team/')
    || location.pathname.startsWith('/leaderboard/');

  return isPublicRoute ? <PublicRoutes /> : <AppContent />;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // If iOS unloads or backgrounds the PWA, restore the active scoring session.
    try {
      const savedMobile = localStorage.getItem('golf_tracker_mobile_mode');
      if (savedMobile) {
        const parsed = JSON.parse(savedMobile);
        const isPublicRoute = location.pathname.startsWith('/live/')
          || location.pathname.startsWith('/live-team/')
          || location.pathname.startsWith('/leaderboard/');
        const isAlreadyOnTournament = location.pathname === `/event/${parsed.tournamentId}`;
        if (parsed.active !== false && parsed.tournamentId && !isPublicRoute && !isAlreadyOnTournament) {
          navigate(`/event/${parsed.tournamentId}`, { replace: true });
        }
      }
    } catch(e) {}
  }, [location.pathname, navigate]);


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
  const [appNotification, setAppNotification] = useState(null);
  const appNotificationTimer = useRef(null);
  const [appConfirmDialog, setAppConfirmDialog] = useState(null);
  const appConfirmResolver = useRef(null);
  const [globalChats, setGlobalChats] = useState([]);
  const [chatNotice, setChatNotice] = useState(null);
  const seenUnreadChatKeys = useRef(new Set());

  const chatNoticeKey = (chat) => {
    const timeKey = chat?.last_message_at?.toMillis?.()
      || chat?.updated_at?.toMillis?.()
      || chat?.last_message?.text
      || '';
    return `${chat?.id || ''}:${timeKey}`;
  };

  const notifyApp = (message, type = 'info') => {
    if (appNotificationTimer.current) clearTimeout(appNotificationTimer.current);
    setAppNotification({ message, type });
    appNotificationTimer.current = setTimeout(() => setAppNotification(null), 3600);
  };

  const askAppConfirm = ({ title = 'Confirmar accion', message, confirmText = 'Aceptar', cancelText = 'Cancelar', danger = false }) => (
    new Promise((resolve) => {
      appConfirmResolver.current = resolve;
      setAppConfirmDialog({ title, message, confirmText, cancelText, danger });
    })
  );

  const resolveAppConfirm = (value) => {
    if (appConfirmResolver.current) appConfirmResolver.current(value);
    appConfirmResolver.current = null;
    setAppConfirmDialog(null);
  };

  useEffect(() => {
    setGlobalChats([]);
    setChatNotice(null);
    seenUnreadChatKeys.current = new Set();

    if (!user || !activeUserDocId) return undefined;
    return subscribeToChats(user, setGlobalChats);
  }, [user?.uid, user?.docId, user?.username, activeUserDocId]);

  useEffect(() => {
    if (!activeUserDocId) return;

    const unreadIncoming = globalChats.filter((chat) => (
      chat.unread &&
      chat.last_message?.sender_uid &&
      chat.last_message.sender_uid !== activeUserDocId
    ));
    const nextKeys = new Set(unreadIncoming.map(chatNoticeKey));
    const newestUnread = unreadIncoming.find((chat) => !seenUnreadChatKeys.current.has(chatNoticeKey(chat)));

    seenUnreadChatKeys.current = nextKeys;

    if (newestUnread) {
      setChatNotice({
        chatId: newestUnread.id,
        friendName: newestUnread.friend?.full_name || newestUnread.friend?.username || 'Nuevo mensaje',
        text: newestUnread.last_message?.deleted ? 'Mensaje eliminado' : (newestUnread.last_message?.text || 'Nuevo mensaje'),
      });
    }
  }, [globalChats, activeUserDocId]);

  useEffect(() => {
    if (!chatNotice) return undefined;
    const timer = setTimeout(() => setChatNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [chatNotice]);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;

    subscribeToForegroundPushMessages((payload) => {
      setChatNotice({
        chatId: payload.data?.chatId || null,
        friendName: payload.notification?.title || 'Nuevo mensaje',
        text: payload.notification?.body || payload.data?.body || 'Tienes una notificación nueva.',
      });
    }).then((unsub) => {
      if (cancelled) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    }).catch((error) => {
      console.warn('[notifications] Foreground listener unavailable:', error);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const openChatNotice = () => {
    setChatNotice(null);
    navigate('/friends');
  };

  const renderAppFeedback = () => (
    <>
      {chatNotice && (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: '18px',
            bottom: appNotification ? '82px' : '22px',
            zIndex: 10030,
            width: 'min(390px, calc(100vw - 32px))',
            padding: '14px',
            borderRadius: '12px',
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            boxShadow: '0 22px 60px rgba(15, 23, 42, 0.34)',
            display: 'grid',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '999px',
              background: '#2563eb',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MessageCircle size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 900, marginBottom: '2px' }}>Nuevo mensaje</div>
              <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {chatNotice.friendName}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {chatNotice.text}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatNotice(null)}
              title="Cerrar aviso"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: '2px',
                display: 'inline-flex',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={openChatNotice}
            style={{
              border: '1px solid rgba(191, 219, 254, 0.45)',
              background: '#2563eb',
              color: '#fff',
              borderRadius: '8px',
              padding: '0.65rem 0.8rem',
              cursor: 'pointer',
              fontWeight: 900,
            }}
          >
            Ver chat
          </button>
        </div>
      )}
      {appNotification && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '22px',
            transform: 'translateX(-50%)',
            zIndex: 10020,
            maxWidth: 'min(520px, calc(100vw - 32px))',
            padding: '12px 16px',
            borderRadius: '999px',
            color: appNotification.type === 'error' ? '#7f1d1d' : appNotification.type === 'warning' ? '#78350f' : '#064e3b',
            background: appNotification.type === 'error' ? '#fee2e2' : appNotification.type === 'warning' ? '#fef3c7' : '#dcfce7',
            border: appNotification.type === 'error' ? '1px solid #fecaca' : appNotification.type === 'warning' ? '1px solid #fde68a' : '1px solid #bbf7d0',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
            fontWeight: '800',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}
        >
          {appNotification.message}
        </div>
      )}
      {appConfirmDialog && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10010,
            background: 'rgba(15, 23, 42, 0.48)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => resolveAppConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 100%)',
              background: 'white',
              borderRadius: '18px',
              padding: '22px',
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.32)',
              border: '1px solid #e2e8f0'
            }}
          >
            <h3 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: '1.15rem' }}>{appConfirmDialog.title}</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', lineHeight: 1.5, fontWeight: '600' }}>{appConfirmDialog.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => resolveAppConfirm(false)}
                style={{ padding: '10px 16px', borderRadius: '999px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: '900', cursor: 'pointer' }}
              >
                {appConfirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => resolveAppConfirm(true)}
                style={{ padding: '10px 16px', borderRadius: '999px', border: 'none', background: appConfirmDialog.danger ? '#dc2626' : 'var(--color-primary)', color: 'white', fontWeight: '900', cursor: 'pointer' }}
              >
                {appConfirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

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
      notifyApp('Foto actualizada en Cloudflare R2.', 'success');
    } catch (err) {
      console.error('R2 Upload error:', err);
      notifyApp(`Error al subir a Cloudflare R2: ${err.message || 'Error desconocido'}`, 'error');
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
      notifyApp('Perfil actualizado correctamente.', 'success');
      setHandicap(editHandicap);
    } catch (err) {
      console.error(err);
      notifyApp('Aviso: algunos datos pueden no haberse guardado en el servidor, pero se han asimilado localmente.', 'warning');
      
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
      notifyApp('Perfil restaurado correctamente desde la base de datos.', 'success');
    } catch (e) {
      console.error(e);
      notifyApp(e.message || 'Error al recuperar datos.', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleHardReset = async () => {
    const shouldReset = await askAppConfirm({
      title: 'Limpiar cache del movil',
      message: 'Esto cerrara la sesion y limpiara toda la cache del movil. Tendras que volver a entrar.',
      confirmText: 'Limpiar cache',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!shouldReset) return;
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
        const photoToUse = incomingPhoto && String(incomingPhoto).trim() !== '' ? incomingPhoto : '';
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

  // Keep every linked profile fresh across devices. The active profile already
  // has its own listener above; this also covers the other manager/child avatars.
  const linkedProfileKey = linkedUsers
    .map((profile) => `${getUserDocId(profile)}:${profile.username || ''}`)
    .filter(Boolean)
    .sort()
    .join('|');

  useEffect(() => {
    if (!IS_MULTI || !linkedProfileKey) return undefined;

    const unsubscribers = linkedUsers
      .filter((profile) => getUserDocId(profile))
      .map((profile) => onSnapshot(getUserProfileRef(db, profile), (snapshot) => {
        if (!snapshot.exists()) return;

        const freshData = snapshot.data();
        const profileDocId = snapshot.id;
        const profileUsername = freshData.username || profile.username;
        const freshPhoto = freshData.photo_url && String(freshData.photo_url).trim() !== ''
          ? freshData.photo_url
          : '';

        setLinkedUsers((previousProfiles) => {
          let changed = false;
          const updatedProfiles = previousProfiles.map((previousProfile) => {
            const sameProfile = getUserDocId(previousProfile) === profileDocId
              || previousProfile.username === profileUsername;
            if (!sameProfile) return previousProfile;

            const updatedProfile = {
              ...previousProfile,
              ...freshData,
              username: profileUsername,
              docId: profileDocId,
              photo_url: freshPhoto,
            };

            if (
              previousProfile.photo_url !== updatedProfile.photo_url
              || previousProfile.full_name !== updatedProfile.full_name
            ) {
              changed = true;
            }
            return updatedProfile;
          });

          if (!changed) return previousProfiles;
          writeLinkedUsers(updatedProfiles);
          return updatedProfiles;
        });

        setUser((previousUser) => {
          if (!previousUser || previousUser.username !== profileUsername) return previousUser;
          if (
            previousUser.photo_url === freshPhoto
            && previousUser.full_name === freshData.full_name
          ) {
            return previousUser;
          }

          const updatedUser = {
            ...previousUser,
            ...freshData,
            username: profileUsername,
            docId: profileDocId,
            photo_url: freshPhoto,
            manager_id: previousUser.manager_id,
          };
          writeSavedUser(updatedUser);
          setPhotoVersion(Date.now());
          return updatedUser;
        });
      }, (error) => {
        console.warn('[profile] Linked profile sync failed:', error.code || error.message);
      }));

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [linkedProfileKey, linkedUsers, setLinkedUsers, setUser]);

  // ── Nuke helper (dev console) ─────────────────────────────────────────────
  useEffect(() => {
    window.nukeUserData = async () => {
      if (!user) return console.error('No user logged in');
      const shouldNuke = await askAppConfirm({
        title: 'Borrar todos los datos',
        message: `Esto borrara TODOS los torneos y resultados de ${user.full_name}.`,
        confirmText: 'Borrar todo',
        cancelText: 'Cancelar',
        danger: true,
      });
      if (!shouldNuke) return;
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
          notifyApp('Todos los datos han sido borrados.', 'success');
          window.location.reload();
        } else {
          notifyApp('No habia datos para borrar.', 'info');
        }
      } catch (e) {
        console.error('Nuke failed', e);
        notifyApp('Error al borrar datos: ' + e.message, 'error');
      }
    };
  }, [user]);

  // ── Mapeo de resultados para IDs antiguos ──
  const mappedResults = useMemo(() => {
    if (!results) return {};
    const copy = { ...results };
    Object.keys(results).forEach((resId) => {
      if (!isNaN(resId) || resId.length < 5) {
        const resData = results[resId];
        if (resData && resData.tournamentName && resData.tournamentDates) {
          const generateSlug = (name, dates) => {
            if (!name || !dates) return null;
            const slug = name.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "");
            const dateStr = dates.replace(/[^0-9]/g, "");
            return `${slug}_${dateStr}`;
          };
          const newId = generateSlug(resData.tournamentName, resData.tournamentDates);
          if (newId && !copy[newId]) {
            copy[newId] = resData;
          }
        }
      }
    });
    return copy;
  }, [results]);

  const tournamentsState = useTournaments(user, preferences, handleUpdatePreferences, mappedResults, {
    disabled: false,
  });
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
    subscribedIds,
    sharedTournaments,
  } = tournamentsState;

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

  if (IS_MULTI && !authReady && !user) {
    return (
      <div className="app-container fade-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ padding: '1.5rem 2rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8em', opacity: 0.7, color: 'var(--color-text-muted)' }}>(v3.0.2)</span>
          Conectando con Firebase...
        </div>
      </div>
    );
  }

  if (!user && IS_MULTI) {
    return (
      <Suspense fallback={<LoadingShell text="Cargando login..." />}>
        <LoginViewFirebase onLogin={handleLogin} />
      </Suspense>
    );
  }
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
        <Suspense fallback={<LoadingShell text="Cargando sección..." />}>
        <Routes>
          <Route path="/" element={
            <CalendarView
              viewMode="calendar"
              tournaments={filteredTournaments}
              results={mappedResults}
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
              subscribedIds={subscribedIds}
              allAvailableTournaments={[...(baseTournaments || []), ...(sharedTournaments || [])]}
            />
          } />
          <Route path="/event/:id" element={
            <CalendarView
              viewMode="calendar"
              tournaments={filteredTournaments}
              results={mappedResults}
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
              subscribedIds={subscribedIds}
              allAvailableTournaments={[...(baseTournaments || []), ...(sharedTournaments || [])]}
            />
          } />
          <Route path="/stats" element={<StatsView user={user} linkedUsers={linkedUsers} results={mappedResults} tournaments={tournaments} />} />
          <Route path="/handicap" element={<HandicapView user={user} currentHandicap={handicap} history={history} results={mappedResults} tournaments={tournaments} />} />
          <Route path="/tournaments" element={
            <TournamentsCentralView 
              user={user} 
              allTournaments={[...(baseTournaments || []), ...(sharedTournaments || [])]}
              activeCalendarTournaments={tournaments}
              subscribedTournaments={subscribedTournaments}
              subscribedIds={subscribedIds}
              onJoinTournament={handleJoinTournament} 
              onLeaveTournament={handleLeaveTournament}
            />
          } />
          <Route path="/friends" element={
            <FriendsView
              user={user}
              activeCalendarTournaments={tournaments}
              subscribedIds={subscribedIds}
            />
          } />
          <Route path="/admin" element={
            <AdminRoute user={sessionOwner || user}>
              <AdminDashboardView user={sessionOwner || user} />
            </AdminRoute>
          } />
        </Routes>
        </Suspense>
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
      {renderAppFeedback()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const envBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  let basename = envBase;
  
  // Dynamic override for multi-folder support
  const path = window.location.pathname;
  if (path === '/' || path === '') {
    window.location.replace('/GolfTeam/');
    return <LoadingShell text="Cargando RoundTracker..." />;
  }

  if (path.includes('/GolfTeam')) {
    basename = '/GolfTeam';
  } else if (path.includes('/Player_HCP')) {
    basename = '/Player_HCP';
  }
  
  return (
    <BrowserRouter basename={basename}>
      <AppRouterShell />
    </BrowserRouter>
  );
}

export default App;
