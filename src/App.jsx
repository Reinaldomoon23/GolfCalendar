import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import HandicapView from './components/HandicapView';
import { Calendar as CalendarIcon, BarChart3, TrendingUp, User, X } from 'lucide-react';

import tournamentsData from './data/tournaments.json';

import LoginView from './components/LoginView';
import { LogOut } from 'lucide-react';

// Environment Mode: 'single' (Nicole) or 'multi' (Team)
const APP_MODE = import.meta.env.VITE_APP_MODE || 'single';
const IS_MULTI = APP_MODE === 'multi';

// Default user for Single Mode
const DEFAULT_USER = {
  username: 'nicole',
  full_name: 'Calendario Nicole Likhomanova',
  photo_url: 'profile.jpg',
  // In single mode we assume profile.jpg matches. 
  // We can update update profile.jpg path if base changes, but let's stick to convention.
  // Actually, if we are in Single mode, we might not query users.json? 
  // But our backend now expects a username. So we mock it here.
};

function AppContent() {
  const location = useLocation();

  // Initialize user based on Mode
  const [user, setUser] = useState(() => {
    if (!IS_MULTI) {
      return DEFAULT_USER;
    }
    const saved = localStorage.getItem('golf_tracker_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [handicap, setHandicap] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isUpdatingHandicap, setIsUpdatingHandicap] = useState(false);
  const [customTournaments, setCustomTournaments] = useState([]);
  const [results, setResults] = useState({});

  // Photo Upload State
  const fileInputRef = useRef(null);
  const [photoVersion, setPhotoVersion] = useState(Date.now());
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Profile Edit State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editFederationId, setEditFederationId] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const handlePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', user.username);

    const baselink = IS_MULTI ? '/GolfTeam' : '/Nicole26';

    try {
      const res = await fetch(`${baselink}/api/upload_profile.php`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        // Update user photo in state and storage
        const updatedUser = { ...user, photo_url: data.url };
        setUser(updatedUser);
        if (IS_MULTI) {
          localStorage.setItem('golf_tracker_user', JSON.stringify(updatedUser));

          // Persist photo URL to backend DB so other devices see it
          fetch(`${baselink}/api/update_user.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: user.username,
              photo_url: data.url
            })
          }).catch(e => console.error("Error saving photo url to DB", e));
        }

        setPhotoVersion(Date.now()); // Force refresh
        alert('¡Foto actualizada correctamente!');
      } else {
        alert('Error al subir la foto.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al subir la foto');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setIsUpdatingProfile(true);

    const baselink = IS_MULTI ? '/GolfTeam' : '/Nicole26';

    try {
      const res = await fetch(`${baselink}/api/update_user.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          full_name: editFullName,
          federation_id: editFederationId
        })
      });

      const data = await res.json();

      if (res.ok) {
        const updatedUser = { ...user, ...data.user };
        setUser(updatedUser);
        if (IS_MULTI) {
          localStorage.setItem('golf_tracker_user', JSON.stringify(updatedUser));
        }
        setIsProfileModalOpen(false);
        alert('Perfil actualizado correctamente');
        // Refresh handicap URL if federation ID changed
        refreshHandicap();
      } else {
        alert(data.error || 'Error al actualizar perfil');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al actualizar perfil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };


  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('golf_tracker_user', JSON.stringify(userData));
    setResults({});
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('golf_tracker_user');
    localStorage.removeItem('golf_tracker_results');
    setResults({});
    setHandicap(null);
    setPdfUrl(null);
  };

  // Auto-login effect for Single Mode (just to be safe if state is lost, though useState init handles it)
  useEffect(() => {
    if (!IS_MULTI && !user) {
      setUser(DEFAULT_USER);
    }
  }, [user]);

  // Preferences State
  const [preferences, setPreferences] = useState(() => {
    // Default: all enabled
    return {
      groups: ['valedero', 'grand_prix', 'baby_cup', 'wagr', 'legacy', 'club'],
      hiddenIds: []
    };
  });

  const handleUpdatePreferences = (newGroups, newHiddenIds) => {
    const newPrefs = {
      ...preferences,
      groups: newGroups || preferences.groups,
      hiddenIds: newHiddenIds || preferences.hiddenIds
    };
    setPreferences(newPrefs);

    if (user) {
      const baselink = IS_MULTI ? '/GolfTeam' : '/Nicole26';
      fetch(`${baselink}/api/save_preferences.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          preferences: newPrefs
        })
      }).catch(err => console.error(err));
    }
  };

  // Merge static and custom tournaments, prioritizing custom (overrides)
  // Also filter out hidden tournaments (personal isolation)
  const tournaments = [
    ...tournamentsData.filter(t => !preferences.hiddenIds?.includes(t.id) && !customTournaments.some(ct => ct.id === t.id)),
    ...customTournaments
  ];

  const refreshHandicap = async () => {
    if (!user) return;
    setIsUpdatingHandicap(true);
    const baselink = IS_MULTI ? '/GolfTeam' : '/Nicole26';
    try {
      const res = await fetch(`${baselink}/api/get_handicap.php?username=${user.username}&t=${new Date().getTime()}`);
      const data = await res.json();
      if (data.handicap) {
        setHandicap(data.handicap);
      }
      if (data.pdf_url) {
        setPdfUrl(data.pdf_url);
      }
    } catch (err) {
      console.error('Failed to fetch handicap:', err);
    } finally {
      setIsUpdatingHandicap(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const baselink = IS_MULTI ? '/GolfTeam' : '/Nicole26';

    // Fetch Preferences
    fetch(`${baselink}/api/save_preferences.php?username=${user.username}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.groups) {
          setPreferences(data);
        }
      })
      .catch(e => console.error("Error loading prefs", e));

    // Fetch Handicap Initial
    refreshHandicap();

    // Fetch Results
    fetch(`${baselink}/api/save_results.php?username=${user.username}&t=${new Date().getTime()}`)
      .then(res => res.json())
      .then(data => {
        const serverResults = Array.isArray(data) ? {} : data;
        setResults(serverResults);
      })
      .catch(err => {
        console.error('Failed to fetch results from server:', err);
      });

    // Fetch Custom Tournaments
    fetch(`${baselink}/api/save_custom_tournaments.php?username=${user.username}&t=${new Date().getTime()}`)
      .then(res => res.json())
      .then(data => {
        setCustomTournaments(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error('Failed to fetch custom tournaments from server:', err);
      });

    // Fetch Latest User Profile (Photo, Name) to sync devices
    fetch(`${baselink}/api/users.json?t=${new Date().getTime()}`)
      .then(res => res.json())
      .then(users => {
        if (Array.isArray(users)) {
          const me = users.find(u => u.username === user.username);
          if (me) {
            setUser(prev => ({
              ...prev,
              photo_url: me.photo_url,
              full_name: me.full_name,
              federation_id: me.federation_id
            }));
            // Update local storage too so next offline load is fresher
            if (IS_MULTI) {
              const updated = { ...user, photo_url: me.photo_url, full_name: me.full_name, federation_id: me.federation_id };
              localStorage.setItem('golf_tracker_user', JSON.stringify(updated));
            }
          }
        }
      })
      .catch(err => console.error("Error syncing profile:", err));
  }, [user]);

  // Auto-update check for 08:00 AM
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      if (now.getHours() === 8 && now.getMinutes() === 0) { // Check specifically for 08:00
        refreshHandicap();
      }
    };

    // Check every minute
    const intervalId = setInterval(checkTime, 60000);
    return () => clearInterval(intervalId);
  }, [user]);

  const handleUpdateResults = (newResults) => {
    setResults(newResults);
    localStorage.setItem('golf_tracker_results', JSON.stringify(newResults));

    if (!user) return;
    const baselink = IS_MULTI ? '/GolfTeam' : '/Nicole26';

    fetch(`${baselink}/api/save_results.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        results: newResults
      })
    })
      .then(res => res.json())
      .then(d => console.log('Saved to server:', d))
      .catch(e => {
        console.error('Save to server failed:', e);
        alert('❌ Error al guardar en el servidor.');
      });
  };

  const handleDeleteTournament = (id) => {
    const isCustom = customTournaments.some(t => t.id === id);

    if (isCustom) {
      const updated = customTournaments.filter(t => t.id !== id);
      setCustomTournaments(updated);
      syncCustomTournaments(updated);
    } else {
      // It's a global tournament, hide it personally
      const newHidden = [...(preferences.hiddenIds || []), id];
      handleUpdatePreferences(null, newHidden);
    }

    if (results[id]) {
      const newResults = { ...results };
      delete newResults[id];
      handleUpdateResults(newResults);
    }
  };

  const syncCustomTournaments = (updated) => {
    if (!user) return;
    const baselink = IS_MULTI ? '/GolfTeam' : '/Nicole26';
    fetch(`${baselink}/api/save_custom_tournaments.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        tournaments: updated
      })
    }).catch(err => console.error(err));
  };

  const handleAddTournament = (newT) => {
    const updated = [...customTournaments, newT];
    setCustomTournaments(updated);
    syncCustomTournaments(updated);
  };

  const handleUpdateTournament = (updatedT) => {
    // Check if it already exists in custom
    const existingIndex = customTournaments.findIndex(t => t.id === updatedT.id);
    let updatedList;

    if (existingIndex >= 0) {
      updatedList = [...customTournaments];
      updatedList[existingIndex] = updatedT;
    } else {
      // It was a static tournament, now becoming a custom override
      updatedList = [...customTournaments, updatedT];
    }

    setCustomTournaments(updatedList);
    syncCustomTournaments(updatedList);
  };


  // Determine active tab based on path
  const currentPath = location.pathname;
  const isCalendar = currentPath === '/';
  const isStats = currentPath === '/stats';
  const isHandicap = currentPath === '/handicap';

  if (!user && IS_MULTI) {
    return <LoginView onLogin={handleLogin} />;
  }

  // Fallback for single mode if user somehow is null (shouldn't happen due to init)
  if (!user && !IS_MULTI) return null;

  return (
    <div className="app-container fade-in">
      <header className="app-header" style={{ position: 'relative' }}>
        {IS_MULTI && (
          <button
            onClick={handleLogout}
            className="btn"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              padding: '8px',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              zIndex: 100 // Ensure it is above other header elements
            }}
            title="Cerrar Sesión"
          >
            <LogOut size={24} />
          </button>
        )}

        <div style={{ padding: '20px 0 10px 0', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handlePhotoUpload}
          />
          <div
            onClick={handlePhotoClick}
            style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}
            title="Cambiar foto de perfil"
          >
            <img
              src={user.photo_url ? (user.photo_url.startsWith('/') || user.photo_url.startsWith('http') ? user.photo_url : `${IS_MULTI ? '/GolfTeam' : '/Nicole26'}/${user.photo_url}`) + `?t=${photoVersion}` : (IS_MULTI ? "/GolfTeam/profile.jpg" : "/Nicole26/profile.jpg") + `?t=${photoVersion}`}
              onError={(e) => { e.target.onerror = null; e.target.src = "https://ui-avatars.com/api/?name=" + user.username }}
              alt={user.full_name}
              style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
            />
            {isUploadingPhoto && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <TrendingUp className="spin-animation" size={24} />
              </div>
            )}
            {!isUploadingPhoto && (
              <div style={{
                position: 'absolute',
                bottom: '5px',
                right: '5px',
                background: 'var(--color-primary)',
                color: 'white',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                <span style={{ fontSize: '14px' }}>📷</span>
              </div>
            )}
          </div>
        </div>
        <h1 className="app-title">
          {user.full_name || 'Calendario Golf'}
          {IS_MULTI && (
            <button
              onClick={() => {
                setEditFullName(user.full_name);
                setEditFederationId(user.federation_id || '');
                setIsProfileModalOpen(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                marginLeft: '10px',
                cursor: 'pointer',
                color: 'var(--color-primary)',
                verticalAlign: 'middle',
                opacity: 0.6,
                transition: 'opacity 0.2s'
              }}
              title="Editar Perfil"
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            >
              <User size={20} />
            </button>
          )}
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Temporada 2026 <span style={{ fontSize: '0.8em', opacity: 0.7 }}>(v2.3.5)</span></p>

        {handicap && (
          <button
            className="handicap-btn fade-in"
            onClick={() => pdfUrl && window.open(pdfUrl, '_blank')}
            title={pdfUrl ? "Ver fuente del hándicap (PDF)" : "Hándicap actualizado"}
            disabled={!pdfUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary-dark)',
              padding: '6px 16px',
              borderRadius: '20px',
              marginTop: '12px',
              fontSize: '1.1rem',
              fontWeight: '600',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              border: 'none',
              cursor: pdfUrl ? 'pointer' : 'default',
              transition: 'all 0.2s ease'
            }}>
            <TrendingUp size={18} className={isUpdatingHandicap ? "spin-animation" : ""} />
            <span>{isUpdatingHandicap ? "Actualizando..." : `Hándicap: ${handicap}`}</span>
          </button>
        )}
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <button className={`btn ${isCalendar ? 'btn-primary' : 'card'}`}>
            <CalendarIcon size={20} />
            Calendario
          </button>
        </Link>
        <Link to="/stats" style={{ textDecoration: 'none' }}>
          <button className={`btn ${isStats ? 'btn-primary' : 'card'}`}>
            <BarChart3 size={20} />
            Estadísticas
          </button>
        </Link>
        <Link to="/handicap" style={{ textDecoration: 'none' }}>
          <button className={`btn ${isHandicap ? 'btn-primary' : 'card'}`}>
            <TrendingUp size={20} />
            Hándicap
          </button>
        </Link>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={
            <CalendarView
              viewMode="calendar"
              tournaments={tournaments}
              results={results}
              activeGroups={['txell', 'ona'].includes(user?.username?.toLowerCase()) ? [] : preferences.groups}
              hiddenGroups={['txell', 'ona'].includes(user?.username?.toLowerCase()) ? ['merit'] : []}
              onUpdateGroups={handleUpdatePreferences}
              onAddTournament={handleAddTournament}
              onUpdateResults={handleUpdateResults}
              onDeleteTournament={handleDeleteTournament}
              onUpdateTournament={handleUpdateTournament}
            />
          } />
          <Route path="/event/:id" element={
            <CalendarView
              viewMode="calendar"
              tournaments={tournaments}
              results={results}
              activeGroups={['txell', 'ona'].includes(user?.username?.toLowerCase()) ? [] : preferences.groups}
              hiddenGroups={['txell', 'ona'].includes(user?.username?.toLowerCase()) ? ['merit'] : []}
              onUpdateGroups={handleUpdatePreferences}
              onAddTournament={handleAddTournament}
              onUpdateResults={handleUpdateResults}
              onDeleteTournament={handleDeleteTournament}
              onUpdateTournament={handleUpdateTournament}
            />
          } />
          <Route path="/stats" element={<StatsView results={results} />} />
          <Route path="/handicap" element={<HandicapView user={user} currentHandicap={handicap} />} />
        </Routes>
      </main>

      {/* Profile Edit Modal */}
      {isProfileModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000,
          paddingTop: '5rem', overflowY: 'auto'
        }}>
          <div className="card fade-in" style={{ width: '90%', maxWidth: '400px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Editar Perfil</h2>
              <button onClick={() => setIsProfileModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Tu nombre completo"
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #E5E1DE', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nº Licencia (Federado)</label>
                <input
                  type="text"
                  placeholder="Ej: CB00123456"
                  value={editFederationId}
                  onChange={e => setEditFederationId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #E5E1DE', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
                  El nº de licencia se utiliza para cargar tu hándicap oficial automáticamente.
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={isUpdatingProfile}
              >
                {isUpdatingProfile ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const isMulti = IS_MULTI;
  const basename = isMulti ? "/GolfTeam" : "/Nicole26";

  return (
    <BrowserRouter basename={basename}>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
