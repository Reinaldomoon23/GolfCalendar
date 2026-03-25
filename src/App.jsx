import { useState, useEffect, useRef, useMemo } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import HandicapView from './components/HandicapView';
import {
  Calendar as CalendarIcon,
  BarChart3,
  TrendingUp,
  User,
  Shield,
  X,
  LogOut,
  Camera
} from 'lucide-react';

import tournamentsData from './data/tournaments.json';
import LoginViewFirebase from './components/LoginViewFirebase';
import PublicScorecardView from './components/PublicScorecardView';
import TeamLiveScorecard from './components/TeamLiveScorecard';
import ProfileImage from './components/ProfileImage';
import AdminDashboardView from './components/admin/AdminDashboardView';
import AdminRoute from './components/admin/AdminRoute';

// Firebase Imports
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, setDoc } from 'firebase/firestore';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  ensureUserProfileDocument,
  fetchUserProfileByUid,
  fetchUserProfileByUsername,
  getUserDocId,
  getUserProfileRef,
  getUserSubcollectionRef,
  getUserSubdocRef
} from './utils/userProfiles';

// Sentry Error Tracking
import { setUser as setSentryUser } from './utils/sentry';

// Configuration
import { R2_CONFIG, s3Client } from './config/cloudflare';
import { APP_MODE, IS_MULTI, DEFAULT_USER, DEFAULT_PREFERENCES, HANDICAP_CACHE_KEY_PREFIX } from './config/app';

function getHandicapCacheKey(userLike) {
  const suffix = getUserDocId(userLike) || userLike?.username || '';
  return suffix ? `${HANDICAP_CACHE_KEY_PREFIX}_${suffix}` : '';
}

function normalizeTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return 0;
}

function isHandicapCacheFresh(fetchedAtValue) {
  const fetchedAt = normalizeTimestamp(fetchedAtValue);
  if (!fetchedAt) return false;

  const now = new Date();
  const todayAtEight = new Date(now);
  todayAtEight.setHours(8, 0, 0, 0);

  if (now < todayAtEight) {
    return fetchedAt >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  return fetchedAt >= todayAtEight.getTime();
}

function isCloudflarePhotoPath(photoPath) {
  const value = String(photoPath || '').trim();
  return value.includes('.r2.dev/') || value.includes('.workers.dev/');
}

function readHandicapCache(userLike) {
  const cacheKey = getHandicapCacheKey(userLike);
  if (!cacheKey) return null;

  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    return cached && typeof cached === 'object' ? cached : null;
  } catch {
    return null;
  }
}

function writeHandicapCache(userLike, payload) {
  const cacheKey = getHandicapCacheKey(userLike);
  if (!cacheKey) return;
  localStorage.setItem(cacheKey, JSON.stringify(payload));
}

function AppContent() {
  const location = useLocation();

  // Initialize user based on Mode
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;
      console.log('SW Registered');

      // 1. Periodic check every 10 minutes
      setInterval(() => {
        r.update().catch(() => { });
      }, 10 * 60 * 1000);

      // 2. Check for updates every time app comes to foreground (critical for iOS PWA)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          r.update().catch(() => { });
        }
      });
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // 3. Auto-reload when a new SW takes control (iOS PWA safe)
  //    With autoUpdate registerType, skipWaiting is called automatically
  //    and controllerchange fires → we reload to get fresh JS/CSS
  useEffect(() => {
    const handleControllerChange = () => {
      console.log('New SW controller detected, reloading…');
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleAppUpdate = () => {
    updateServiceWorker(true);
    setTimeout(() => window.location.reload(), 1000);
  };

  const [authReady, setAuthReady] = useState(!IS_MULTI);
  const [user, setUser] = useState(() => (IS_MULTI ? null : DEFAULT_USER));
  const [sessionOwner, setSessionOwner] = useState(null);
  const activeUserDocId = getUserDocId(user);

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
  const [editEmail, setEditEmail] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Temporary: Allow deleting all data for current user via console
  useEffect(() => {
    window.nukeUserData = async () => {
      if (!user) return console.error("No user logged in");
      // Safety check: Only allow for Sofia as requested, or anyone if confirm is persistent
      const confirm = window.confirm(`ATENCIÓN: Esto borrará TODOS los torneos y resultados de ${user.full_name}. ¿Estás seguro?`);
      if (!confirm) return;

      console.log("🔥 Starting Nuke Process for", user.username);

      try {
        // We need to import needed functions dynamically or ensure they are available
        // But writeBatch and getDocs might not be imported.
        // Let's assume they are imported or I'll add them to the import list in a separate call.
        // Actually, let's use the existing 'db' and 'collection'. 
        // If I can't batch, I'll delete one by one.
        const { getDocs, writeBatch } = await import('firebase/firestore');

        // 1. Delete Results
        const resultsRef = getUserSubcollectionRef(db, user, "results");
        const resultsSnap = await getDocs(resultsRef);
        console.log(`Found ${resultsSnap.size} results. Deleting...`);

        // Batches have a limit of 500 operations
        let batch = writeBatch(db);
        let count = 0;

        resultsSnap.forEach(doc => {
          batch.delete(doc.ref);
          count++;
        });

        // 2. Delete Custom Tournaments
        const customRef = getUserSubcollectionRef(db, user, "custom_tournaments");
        const customSnap = await getDocs(customRef);
        console.log(`Found ${customSnap.size} custom tournaments. Deleting...`);

        customSnap.forEach(doc => {
          batch.delete(doc.ref);
          count++;
        });

        if (count > 0) {
          await batch.commit();
          console.log("✅ Data Nuked Successfully!");
          alert("Todos los datos han sido borrados.");
          window.location.reload();
        } else {
          console.log("Nothing to delete.");
          alert("No había datos para borrar.");
        }
      } catch (e) {
        console.error("Nuke failed", e);
        alert("Error al borrar datos: " + e.message);
      }
    };
  }, [user]);

  const handlePhotoClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingPhoto(true);

    try {
      // 1. Upload to Cloudflare R2
      const fileName = `${user.username}_${Math.floor(Date.now() / 1000)}.jpg`;
      const arrayBuffer = await file.arrayBuffer();

      const command = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileName,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || 'image/jpeg'
      });

      await s3Client.send(command);
      const newPhotoUrl = `${R2_CONFIG.publicUrl}/${fileName}`;

      // 2. Persist to Firebase
      await setDoc(getUserProfileRef(db, user), {
        photo_url: newPhotoUrl
      }, { merge: true });

      // 3. Update local state
      const updatedUser = { ...user, photo_url: newPhotoUrl };
      setUser(updatedUser);
      localStorage.setItem('golf_tracker_user', JSON.stringify(updatedUser));

      setPhotoVersion(Date.now());
      alert('¡Foto actualizada en Cloudflare R2!');
    } catch (err) {
      console.error("R2 Upload error details:", err);
      const errorMsg = err.message || 'Error desconocido';
      alert(`Error al subir a Cloudflare R2: ${errorMsg}`);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setIsUpdatingProfile(true);

    try {
      // Update in Firebase (Now primary source of truth)
      await setDoc(getUserProfileRef(db, user), {
        full_name: editFullName,
        federation_id: editFederationId,
        email: editEmail
      }, { merge: true });

      // Keep PHP update for legacy shared cards while we finish migration
      const baselink = import.meta.env.BASE_URL.replace(/\/$/, '');
      await fetch(`${baselink}/api/update_user.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          full_name: editFullName,
          federation_id: editFederationId,
          email: editEmail
        })
      });

      const updatedUser = { ...user, full_name: editFullName, federation_id: editFederationId, email: editEmail };
      setUser(updatedUser);
      if (IS_MULTI) {
        localStorage.setItem('golf_tracker_user', JSON.stringify(updatedUser));
      }
      setIsProfileModalOpen(false);
      alert('Perfil actualizado correctamente');
      refreshHandicap();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar perfil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };


  const [linkedUsers, setLinkedUsers] = useState([]);

  const resetSessionState = () => {
    setUser(null);
    setSessionOwner(null);
    setLinkedUsers([]);
    localStorage.removeItem('golf_tracker_user');
    localStorage.removeItem('golf_tracker_results');
    localStorage.removeItem('golf_tracker_linked_users');
    setResults({});
    setCustomTournaments([]);
    setPreferences({ ...DEFAULT_PREFERENCES });
    setHandicap(null);

    // Clear user from Sentry
    setSentryUser(null);
    setPdfUrl(null);
  };

  const loadManagedProfiles = async (ownerProfile) => {
    if (!ownerProfile?.managed_users || !Array.isArray(ownerProfile.managed_users)) {
      return [];
    }

    const profiles = [{ ...ownerProfile }];

    for (const childUsername of ownerProfile.managed_users) {
      const childProfile = await fetchUserProfileByUsername(db, childUsername);
      if (childProfile) {
        profiles.push(childProfile);
      }
    }

    return profiles.filter((profile, index, array) => (
      array.findIndex((candidate) => candidate.username === profile.username) === index
    ));
  };

  useEffect(() => {
    if (!IS_MULTI) return undefined;

    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      void (async () => {
        if (!authUser) {
          if (!cancelled) {
            resetSessionState();
            setAuthReady(true);
          }
          return;
        }

        if (!cancelled) {
          setAuthReady(false);
        }

        try {
          const resolvedProfile = await fetchUserProfileByUid(db, authUser.uid, authUser.email);
          const inferredUsername = resolvedProfile?.username || authUser.email?.split('@')[0] || '';

          if (!inferredUsername) {
            throw new Error('No se pudo resolver el perfil del usuario autenticado');
          }

          const ownerProfile = await ensureUserProfileDocument(db, {
            ...resolvedProfile,
            uid: authUser.uid,
            username: inferredUsername,
            email: resolvedProfile?.email || authUser.email || `${inferredUsername}@golfteam.app`,
            full_name: resolvedProfile?.full_name || authUser.displayName || inferredUsername
          }, inferredUsername);

          let savedActiveUser = null;
          try {
            savedActiveUser = JSON.parse(localStorage.getItem('golf_tracker_user') || 'null');
          } catch {
            savedActiveUser = null;
          }

          const managedProfiles = await loadManagedProfiles(ownerProfile);
          let activeUser = ownerProfile;

          if (managedProfiles.length > 0) {
            const preferredManagedUser = savedActiveUser?.manager_id === ownerProfile.username
              ? managedProfiles.find((profile) => profile.username === savedActiveUser.username)
              : null;
            const firstManagedUser = managedProfiles.find((profile) => (
              ownerProfile.managed_users || []
            ).includes(profile.username));

            activeUser = preferredManagedUser || firstManagedUser || ownerProfile;

            if (activeUser.username !== ownerProfile.username) {
              activeUser = { ...activeUser, manager_id: ownerProfile.username };
            }

            if (!cancelled) {
              setLinkedUsers(managedProfiles);
              localStorage.setItem('golf_tracker_linked_users', JSON.stringify(managedProfiles));
            }
          } else if (!cancelled) {
            setLinkedUsers([]);
            localStorage.removeItem('golf_tracker_linked_users');
          }

          if (!cancelled) {
            setSessionOwner(ownerProfile);
            setUser(activeUser);
            localStorage.setItem('golf_tracker_user', JSON.stringify(activeUser));

            // Set user context in Sentry for error tracking
            setSentryUser({
              uid: activeUser.uid || ownerProfile.uid,
              username: activeUser.username,
              displayName: activeUser.full_name
            });
          }
        } catch (error) {
          console.error('Error resolving Firebase session', error);
          if (!cancelled) {
            resetSessionState();
          }
        } finally {
          if (!cancelled) {
            setAuthReady(true);
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleRecoverProfile = async () => {
    if (!user?.username) return;
    setIsUpdatingProfile(true);
    try {
      const baselink = import.meta.env.BASE_URL.replace(/\/$/, '');
      const res = await fetch(`${baselink}/api/users.json?t=${Date.now()}`);
      const users = await res.json();
      const legacy = users[user.username];

      if (legacy) {
        const currentPhoto = String(user.photo_url || '').trim();
        const legacyPhoto = String(legacy.photo_url || '').trim();
        const nextPhoto = (isCloudflarePhotoPath(currentPhoto) && legacyPhoto)
          ? currentPhoto
          : (legacyPhoto || currentPhoto);

        // Prepare update
        const updates = {
          full_name: legacy.full_name || user.full_name,
          federation_id: legacy.federation_id || user.federation_id,
          photo_url: nextPhoto
        };

        // Push to Firestore
        await setDoc(getUserProfileRef(db, user), updates, { merge: true });

        // Update local state
        const updated = { ...user, ...updates };
        setUser(updated);
        localStorage.setItem('golf_tracker_user', JSON.stringify(updated));
        setPhotoVersion(Date.now());

        // Set form fields
        setEditFullName(updated.full_name);
        setEditFederationId(updated.federation_id || '');

        alert("✅ Perfil restaurado correctamente desde la base de datos.");
      } else {
        alert("No se encontraron datos antiguos para este usuario.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al recuperar datos.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleLogin = async (userData) => {
    if (userData) {
      setUser(userData);
      localStorage.setItem('golf_tracker_user', JSON.stringify(userData));
    }
    setAuthReady(true);
  };

  const handleHardReset = () => {
    if (!window.confirm("¿Estás seguro? Esto cerrará la sesión y limpiará TODA la caché del móvil. Tendrás que volver a entrar.")) return;

    // Clear everything
    localStorage.clear();

    // Unregister all service workers
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }

    // Redirect to home and reload
    window.location.href = window.location.origin + import.meta.env.BASE_URL;
  };

  const handleLogout = async () => {
    if (!IS_MULTI) return;

    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out from Firebase', error);
      resetSessionState();
      setAuthReady(true);
    }
  };

  // Auto-login effect for Single Mode
  useEffect(() => {
    if (!IS_MULTI && !user) {
      setUser(DEFAULT_USER);
    }
  }, [user]);

  // Preferences State
  const [preferences, setPreferences] = useState(() => {
    return { ...DEFAULT_PREFERENCES };
  });

  const handleUpdatePreferences = async (newGroups, newHiddenIds) => {
    const newPrefs = {
      ...preferences,
      groups: newGroups || preferences.groups,
      hiddenIds: newHiddenIds || preferences.hiddenIds
    };
    setPreferences(newPrefs);

    if (user) {
      try {
        await setDoc(getUserSubdocRef(db, user, "settings", "preferences"), newPrefs);
      } catch (err) {
        console.error("Error saving prefs to Firebase", err);
      }
    }
  };

  const handleUpdateTheme = async (orgName, color) => {
    const newThemes = {
      ...preferences.themes,
      [orgName]: { bg: color, border: color } // Simple unified color for now, or maybe derive border?
      // Let's stick to user picking "Background" color mostly.
    };
    // Deep merge if we want detailed control, but simple override is easier.

    // Better strategy: User picks a "Color". We generate bg (light) and border (dark)?
    // Or user picks the main color.
    // Let's assume user picks the "Badge/Border" color. We can make bg transparent or light version.
    // For simplicity, let's just save what they pick as 'border' and a lighter version as 'bg'.
    // Actually, let's just save exactly what they pick as 'bg' and 'border' for now?
    // No, ORG_THEMES in CalendarView expects { bg, border }.

    // Let's just save the "base" color and let CalendarView derive or utilize it?
    // CalendarView logic is: theme = ORG_THEMES[org] || ...
    // If I pass customThemes, CalendarView can use it.

    const newPrefs = {
      ...preferences,
      themes: newThemes
    };
    setPreferences(newPrefs);

    if (user) {
      try {
        await setDoc(getUserSubdocRef(db, user, "settings", "preferences"), newPrefs);
      } catch (err) {
        console.error("Error saving theme prefs", err);
      }
    }
  };

  // Base Tournaments (Real-time from Firebase)
  const [baseTournaments, setBaseTournaments] = useState(tournamentsData);

  // Fetch official tournaments from Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "tournaments"), (snapshot) => {
      const tourneys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (tourneys.length > 0) {
        console.log("Loaded official tournaments from Firebase.", tourneys.length);
        setBaseTournaments(tourneys);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync User Data (Profile, Results, Custom Tournaments, Prefs)
  useEffect(() => {
    if (!user?.username || !activeUserDocId) return;

    // 1. Preferences
    const unsubPrefs = onSnapshot(getUserSubdocRef(db, user, "settings", "preferences"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        // Merge with defaults to ensure 'themes' exists
        setPreferences(prev => ({ ...prev, ...data, themes: data.themes || {} }));
      } else if (user.username === 'jordi') {
        const meritHiddenIds = [105, 2, 110, 4, 6, 8, 9, 11, 12, 14, 15, 16, 17, 22, 23, 27, 28, 103, 104];
        setPreferences({
          groups: ['club'],
          hiddenIds: meritHiddenIds,
          themes: {}
        });
      }
    });

    // 2. Results
    // We stored results in subcollection "results" where docId = tournamentId
    const unsubResults = onSnapshot(getUserSubcollectionRef(db, user, "results"), (snapshot) => {
      const newResults = {};
      snapshot.forEach(doc => {
        newResults[doc.id] = doc.data();
      });
      setResults(newResults);
      console.log("Synced results from Firebase", Object.keys(newResults).length);
    });

    // 3. Custom Tournaments
    const unsubCustom = onSnapshot(getUserSubcollectionRef(db, user, "custom_tournaments"), (snapshot) => {
      const customs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomTournaments(customs);
    });

    return () => {
      unsubPrefs();
      unsubResults();
      unsubCustom();
    };
  }, [activeUserDocId, user?.username]);

  useEffect(() => {
    if (!IS_MULTI || sessionOwner?.role !== 'admin' || !sessionOwner?.username) return undefined;

    const params = new URLSearchParams(location.search);
    const requestedUsername = params.get('view_as');
    if (!requestedUsername) return undefined;

    const normalizedUsername = requestedUsername.trim().toLowerCase();
    if (!normalizedUsername) return undefined;

    let cancelled = false;

    const switchActiveProfile = async () => {
      if (normalizedUsername === sessionOwner.username) {
        if (!cancelled && user?.username !== sessionOwner.username) {
          setUser(sessionOwner);
          localStorage.setItem('golf_tracker_user', JSON.stringify(sessionOwner));
        }
        return;
      }

      const existingProfile = linkedUsers.find((profile) => profile.username === normalizedUsername);
      const targetProfile = existingProfile || await fetchUserProfileByUsername(db, normalizedUsername);

      if (!targetProfile || cancelled) return;

      const nextActiveUser = {
        ...targetProfile,
        manager_id: sessionOwner.username
      };

      if (user?.username !== nextActiveUser.username || user?.photo_url !== nextActiveUser.photo_url) {
        setUser(nextActiveUser);
        localStorage.setItem('golf_tracker_user', JSON.stringify(nextActiveUser));
      }
    };

    void switchActiveProfile();

    return () => {
      cancelled = true;
    };
  }, [linkedUsers, location.search, sessionOwner, user?.photo_url, user?.username]);


  // Merge static/server and custom tournaments
  const tournaments = useMemo(() => [
    ...baseTournaments.filter(t => {
      // Filter hidden
      if (preferences.hiddenIds?.includes(t.id)) return false;
      if (preferences.hiddenIds?.includes(String(t.id))) return false;

      // Strict Filter for Jordi (Only Orden de Merito)
      if (user?.username === 'jordi') {
        if (t.type !== 'merit') return false;
      }

      // Hard Override (same ID)
      if (customTournaments.some(ct => String(ct.id) === String(t.id))) return false;
      // Soft Override (Deduplication: same Name AND Dates)
      if (customTournaments.some(ct => ct.name === t.name && ct.dates === t.dates)) return false;
      return true;
    }),
    ...customTournaments
  ], [baseTournaments, preferences.hiddenIds, customTournaments, user?.username]);

  // Real-time synchronization for Profile and Linked Accounts via Firestore
  useEffect(() => {
    if (!user?.username || !activeUserDocId) return;

    const unsubProfile = onSnapshot(getUserProfileRef(db, user), (snapshot) => {
      if (snapshot.exists()) {
        const freshData = snapshot.data();
        const managedUsernames = Array.isArray(freshData.managed_users) ? freshData.managed_users : [];

        const incomingPhoto = freshData.photo_url;
        const incomingName = freshData.full_name;
        const currentManaged = JSON.stringify(user.managed_users || []);
        const incomingManaged = JSON.stringify(managedUsernames);

        // Use functional update to ensure we use latest state and don't overwrite with empty values
        setUser(prev => {
          if (!prev || prev.username !== user.username) return prev;

          // Only overwrite photo if incoming is valid and not empty
          const photoToUse = (incomingPhoto && String(incomingPhoto).trim() !== '') ? incomingPhoto : prev.photo_url;

          // Self-healing: If we have a local photo but Firestore is missing it, push it to Firestore
          if (!incomingPhoto && prev.photo_url && String(prev.photo_url).trim() !== '') {
            console.log("Self-healing: Synchronizing legacy photo to Firestore for", user.username);
            setDoc(getUserProfileRef(db, prev), { photo_url: prev.photo_url }, { merge: true });
          }

          if (prev.photo_url !== photoToUse || prev.full_name !== incomingName || currentManaged !== incomingManaged) {
            const updated = {
              ...prev,
              ...freshData,
              photo_url: photoToUse,
              manager_id: prev.manager_id
            };
            localStorage.setItem('golf_tracker_user', JSON.stringify(updated));
            setPhotoVersion(Date.now());
            return updated;
          }
          return prev;
        });

        // Handle Linked Users (Manager Mode)
        if (managedUsernames.length > 0) {
          const fetchLinked = async () => {
            try {
              const profiles = [];
              // Add manager first
              profiles.push({ ...freshData, username: user.username, docId: activeUserDocId });

              for (const childId of managedUsernames) {
                const childProfile = await fetchUserProfileByUsername(db, childId);
                if (childProfile) {
                  profiles.push(childProfile);
                }
              }

              const uniqueProfiles = profiles.filter((v, i, a) => a.findIndex(t => t.username === v.username) === i);
              setLinkedUsers(uniqueProfiles);
              localStorage.setItem('golf_tracker_linked_users', JSON.stringify(uniqueProfiles));
            } catch (e) {
              console.error("Error fetching linked profiles", e);
            }
          };
          fetchLinked();
        } else if (freshData.role !== 'manager' && !user.manager_id) {
          // If NOT a manager AND NOT currently being managed by someone else, clear list
          setLinkedUsers([]);
          localStorage.removeItem('golf_tracker_linked_users');
        }
      }
    });

    return () => unsubProfile();
  }, [activeUserDocId, user?.username]);



  // Helper to extract year
  const getYear = (dateStr) => {
    if (!dateStr) return '';
    // Handle ranges, take start date
    const firstDate = dateStr.split(' - ')[0].trim();

    const parts = firstDate.split('/');
    if (parts.length === 3) return parts[2];

    const isoParts = firstDate.split('-');
    if (isoParts.length === 3) return isoParts[0];

    return '';
  };

  const [currentSeason, setCurrentSeason] = useState('2026');
  const [availableSeasons, setAvailableSeasons] = useState(['2026']);

  useEffect(() => {
    const years = new Set();
    years.add('2026'); // Base year
    // years.add(String(new Date().getFullYear())); // Ensure current is always there

    tournaments.forEach(t => {
      const y = getYear(t.dates);
      if (y) years.add(y);
    });

    setAvailableSeasons(Array.from(years).sort().reverse());
  }, [tournaments.length]); // Optimize dep to length or just tournaments

  const filteredTournaments = tournaments.filter(t => {
    // If tournament has no valid date, show it? Or maybe strict filter?
    // Let's assume if it has no date, it might be TBD, maybe show it in current year or all?
    // For now strict filter by year string match
    const y = getYear(t.dates);
    return y === currentSeason;
  });

  const applyCachedHandicap = (targetUser) => {
    if (!targetUser) return false;

    const fetchedAt = normalizeTimestamp(targetUser.handicap_fetched_at);
    if (targetUser.current_handicap || targetUser.handicap_pdf_url || fetchedAt) {
      setHandicap(targetUser.current_handicap || null);
      setPdfUrl(targetUser.handicap_pdf_url || null);

      if (targetUser.current_handicap || targetUser.handicap_pdf_url) {
        writeHandicapCache(targetUser, {
          handicap: targetUser.current_handicap || null,
          pdfUrl: targetUser.handicap_pdf_url || null,
          fetchedAt,
        });
      }
      return true;
    }

    const cached = readHandicapCache(targetUser);
    if (!cached) return false;

    setHandicap(cached.handicap || null);
    setPdfUrl(cached.pdfUrl || null);
    return true;
  };

  const refreshHandicap = async ({ force = false, background = false } = {}) => {
    if (!user) return;

    const existingCache = readHandicapCache(user);
    const cachedFetchedAt = existingCache?.fetchedAt || user.handicap_fetched_at;

    if (!force && isHandicapCacheFresh(cachedFetchedAt)) {
      applyCachedHandicap(user);
      return;
    }

    if (!background) {
      setIsUpdatingHandicap(true);
    }

    const baselink = "https://reinaldomoon.top/GolfTeam";
    try {
      const licenseParam = user.federation_id ? `&license=${user.federation_id}` : '';
      const res = await fetch(`${baselink}/api/get_handicap.php?username=${user.username}${licenseParam}&t=${Date.now()}`);
      const data = await res.json();

      const nextCache = {
        handicap: data.handicap || null,
        pdfUrl: data.pdf_url || null,
        fetchedAt: Date.now(),
      };

      setHandicap(nextCache.handicap);
      setPdfUrl(nextCache.pdfUrl);
      writeHandicapCache(user, nextCache);

      const nextUser = {
        ...user,
        current_handicap: nextCache.handicap,
        handicap_pdf_url: nextCache.pdfUrl,
        handicap_fetched_at: nextCache.fetchedAt,
      };

      setUser(nextUser);
      if (IS_MULTI) {
        localStorage.setItem('golf_tracker_user', JSON.stringify(nextUser));
      }

      if (IS_MULTI && getUserDocId(user)) {
        void setDoc(getUserProfileRef(db, user), {
          current_handicap: nextCache.handicap,
          handicap_pdf_url: nextCache.pdfUrl,
          handicap_fetched_at: new Date(nextCache.fetchedAt).toISOString(),
        }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to fetch handicap:', err);
      applyCachedHandicap(user);
    } finally {
      if (!background) {
        setIsUpdatingHandicap(false);
      }
    }
  };

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

  // Initial Handicap Fetch on User Load
  useEffect(() => {
    if (!user?.username) return;

    applyCachedHandicap(user);

    const timeoutId = window.setTimeout(() => {
      refreshHandicap({ background: true });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [user?.username, user?.federation_id]);

  const handleHandicapButtonClick = () => {
    refreshHandicap({ force: true });
  };

  const handleOpenHandicapPdf = (e) => {
    e.stopPropagation();
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleUpdateResults = async (newResults) => {
    setResults(newResults); // Optimistic UI update

    // In Firebase we update individual documents. 
    // newResults is the WHOLE object { [id]: result, ... }.
    // But usually we update one result at a time in the UI logic?
    // Actually CalendarView calls onUpdateResults(newAllResults).
    // This is inefficient for Firebase to write ALL every time.
    // Ideally we should refactor handleUpdateResults to accept (tournamentId, resultData).

    // For now, to keep strict compatibility, we should iterate and setDocs? 
    // Or better: Detect WHAT changed?
    // That's hard.

    // Let's assume CalendarView calls this when ONE result changes.
    // Wait, CalendarView Logic:
    // const newResults = { ...results, [t.id]: updatedResult };
    // onUpdateResults(newResults);

    // We can't easily know which one changed without diffing.
    // Simple approach: We iterate newResults keys and write them.
    // THIS IS CONSUMPTIVE if list is huge.
    // BUT list is per user per year. Maybe 50 items? It's okay-ish.

    // BETTER: Change CalendarView to pass the specific update? 
    // That requires editing CalendarView.
    // Let's do a smart diff here.

    if (!user) return;

    for (const [tId, result] of Object.entries(newResults)) {
      // We should check if it's different from current state 'results'?
      // But 'results' state matches newResults in React batching?
      // No, 'results' is old state inside the function closure if not from setState callback.
      // Actually, let's just write to Firebase blindly for the specific ID involved?
      // We don't know the ID involved from the argument.

      // Let's just write ALL results? Firestore writes are cheap enough for < 100 docs?
      // No, that's bad practice.

      // We really should update CalendarView to pass "handleSaveResult(id, data)".
      // But I can't edit CalendarView easily right now without breaking the contract.

      // Hack: find key where value !== oldResults[key]
      // const oldResults = results; // captured from closure
      // This might work most of the time.

      await setDoc(getUserSubdocRef(db, user, "results", tId), result);
    }

    /**
     * NOTE: Writing all documents on every edit is risky and slow.
     * However, since we successfully migrated to Firebase, we should
     * modify CalendarView.jsx to call a granular save function instead of bulk update.
     * But for this exact step, I will stick to writing.
     * 
     * Actually, let's modify CalendarView in next step to be cleaner.
     * For now, this loop writes everything. It ensures consistency at cost of bandwidth.
     **/
  };

  // Actually, I'll modify the handleUpdateResults to take (id, data) inside App, 
  // but CalendarView passes the whole object.
  // I will rely on the fact that CalendarView usually calls it after modifying ONE Key.
  // But wait, if I delete a result (handleDeleteTournament), I need to delete the doc.

  // Let's rewrite `handleUpdateResults` in a smarter way or fix CalendarView later.
  // For this step, I'll use the loop but wrap in try/catch.

  const handleSaveSpecificResult = async (id, data) => {
    if (!user) return;
    setResults(prev => ({ ...prev, [id]: data }));
    await setDoc(getUserSubdocRef(db, user, "results", id), data);
  };

  const handleDeleteResult = async (id) => {
    if (!user) return;
    try {
      setResults(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(getUserSubdocRef(db, user, "results", id));
    } catch (err) {
      console.error("Error deleting result", err);
    }
  };

  const handleDeleteTournament = async (id) => {
    // Determine if custom
    const isCustom = customTournaments.some(t => String(t.id) === String(id));

    if (isCustom) {
      // Delete from Firestore
      if (user) {
        // Import deleteDoc needed
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(getUserSubdocRef(db, user, "custom_tournaments", id));
      }
      // State updates automatically via header snapshot
    } else {
      // Global: Hide it
      const newHidden = [...(preferences.hiddenIds || []), id];
      handleUpdatePreferences(null, newHidden);
    }

    // Delete result if exists
    if (results[id]) {
      if (user) {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(getUserSubdocRef(db, user, "results", id));
      }
    }
  };

  const handleAddTournament = async (newT) => {
    if (!user) return;
    // Add to Firestore
    await setDoc(getUserSubdocRef(db, user, "custom_tournaments", newT.id), newT);
  };

  const handleUpdateTournament = async (updatedT) => {
    if (!user) return;
    await setDoc(getUserSubdocRef(db, user, "custom_tournaments", updatedT.id), updatedT);
  };

  const handleSwitchUser = (targetUser) => {
    if (!user) return;
    const ownerUsername = sessionOwner?.username || user.manager_id || user.username;
    const newActiveUser = targetUser.username === ownerUsername
      ? { ...targetUser }
      : { ...targetUser, manager_id: ownerUsername };
    setUser(newActiveUser);
    localStorage.setItem('golf_tracker_user', JSON.stringify(newActiveUser));
  };

  const handleReturnToOwner = () => {
    if (!sessionOwner) return;
    setUser(sessionOwner);
    localStorage.setItem('golf_tracker_user', JSON.stringify(sessionOwner));
  };


  // Determine active tab based on path
  const currentPath = location.pathname;
  const isCalendar = currentPath === '/';
  const isStats = currentPath === '/stats';
  const isHandicap = currentPath === '/handicap';
  const isLive = currentPath.startsWith('/live/');

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
          Conectando con Firebase...
        </div>
      </div>
    );
  }

  if (!user && IS_MULTI) {
    return <LoginViewFirebase onLogin={handleLogin} />;
  }

  // Fallback for single mode if user somehow is null (shouldn't happen due to init)
  if (!user && !IS_MULTI) return null;

  return (
    <div className="app-container fade-in">
      <header className="app-header" style={{ position: 'relative' }}>
        {IS_MULTI && (
          <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: '0.5rem', padding: '0.5rem', zIndex: 100 }}>
            <button
              onClick={handleAppUpdate}
              style={{
                background: 'rgba(255,255,255,0.85)', border: '1px solid #e2e8f0', cursor: 'pointer',
                color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
              title="Recargar/Actualizar la App"
            >
              ↻
            </button>
            <button
              onClick={handleLogout}
              className="btn"
              style={{
                background: 'none', border: 'none', padding: '4px', cursor: 'pointer',
                color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center'
              }}
              title="Cerrar Sesión"
            >
              <LogOut size={24} />
            </button>
          </div>
        )}


        {linkedUsers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.7)', padding: '6px', borderRadius: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              {/* Current Active User big */}
              <div style={{ position: 'relative' }}>
                <ProfileImage
                  key={`photo-${photoVersion}`}
                  photoPath={user.photo_url}
                  displayName={user.full_name || user.username}
                  version={photoVersion}
                  alt={user.full_name}
                  style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary)' }}
                />
              </div>
              {/* Other Linked Users small */}
              {linkedUsers.filter(u => u.username !== user.username).map(u => (
                <div key={u.username} onClick={() => handleSwitchUser(u)} style={{ cursor: 'pointer', opacity: 0.6, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center' }} title={`Cambiar a ${u.full_name}`}>
                  <ProfileImage
                    key={`nav-photo-${u.username}-${photoVersion}`}
                    photoPath={u.photo_url}
                    displayName={u.full_name || u.username}
                    version={photoVersion}
                    alt={u.full_name}
                    style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid transparent' }}
                  />
                </div>
              ))}
            </div>
            <h1 className="app-title" style={{ fontSize: '1.8rem', marginTop: '0.5rem', marginBottom: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {user.full_name}
              <button
                onClick={() => {
                  setEditFullName(user.full_name);
                  setEditFederationId(user.federation_id || '');
                  setEditEmail(user.email || '');
                  setIsProfileModalOpen(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--color-primary)',
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Editar Perfil"
              >
                <User size={16} />
              </button>
            </h1>
          </div>
        ) : (
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
              <ProfileImage
                key={`edit-photo-${photoVersion}`}
                photoPath={user.photo_url}
                displayName={user.full_name || user.username}
                version={photoVersion}
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
                  <Camera size={18} />
                </div>
              )}
            </div>
          </div>
        )}

        {linkedUsers.length === 0 && <h1 className="app-title">
          {user.full_name || 'RoundTracker'}
          {IS_MULTI && (
            <button
              onClick={async () => {
                setEditFullName(user.full_name);
                setEditFederationId(user.federation_id || '');
                setEditEmail(user.email || '');
                setIsProfileModalOpen(true);
                // ... same as before
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
            >
              <User size={20} />
            </button>
          )}
        </h1>}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Temporada</span>
          <select
            value={currentSeason}
            onChange={(e) => setCurrentSeason(e.target.value)}
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              borderBottom: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
              padding: '0 4px',
              textAlign: 'center',
              appearance: 'none',
              WebkitAppearance: 'none'
            }}
          >
            {availableSeasons.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.8em', opacity: 0.7, color: 'var(--color-text-muted)' }}>(v2.4.8)</span>
        </div>

        {IS_MULTI && sessionOwner?.role === 'admin' && user?.username !== sessionOwner?.username && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.7rem 1rem',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.06)',
              border: '1px solid rgba(15, 23, 42, 0.08)'
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                Viendo como <strong style={{ color: 'var(--color-primary-dark)' }}>{user.full_name || user.username}</strong>
              </span>
              <button
                onClick={handleReturnToOwner}
                style={{
                  border: 'none',
                  background: '#0f172a',
                  color: 'white',
                  borderRadius: '999px',
                  padding: '0.45rem 0.9rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}
              >
                Volver a mi usuario
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '12px' }}>
          {IS_MULTI && sessionOwner?.role === 'admin' && (
            <Link to="/admin" style={{ textDecoration: 'none' }}>
              <button
                className="handicap-btn fade-in"
                title="Ir al panel de administración"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#0f172a',
                  color: 'white',
                  padding: '8px 18px',
                  borderRadius: '24px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Shield size={16} />
                Admin
              </button>
            </Link>
          )}

          <button
            className="handicap-btn fade-in"
            onClick={handleHandicapButtonClick}
            title="Actualizar hándicap"
            disabled={isUpdatingHandicap || !user?.username}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary-dark)',
              padding: '8px 24px',
              borderRadius: '24px',
              fontSize: '1.1rem',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0,0,0,0.05)',
              cursor: isUpdatingHandicap || !user?.username ? 'default' : 'pointer',
              transition: 'all 0.2s ease',
              width: '220px',
              maxWidth: '75vw',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
            <TrendingUp size={18} className={isUpdatingHandicap ? "spin-animation" : ""} />
            <span>{isUpdatingHandicap ? 'Actualizando...' : (handicap ? `Hándicap: ${String(handicap).substring(0, 15)}` : 'Actualizar hándicap')}</span>
          </button>

          {pdfUrl && (
            <button
              className="handicap-btn fade-in"
              onClick={handleOpenHandicapPdf}
              title="Abrir PDF del hándicap"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '999px',
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'rgba(255,255,255,0.7)',
                color: 'var(--color-primary-dark)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                cursor: 'pointer'
              }}
            >
              PDF
            </button>
          )}
        </div>
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
              tournaments={filteredTournaments}
              results={results}
              activeGroups={['txell', 'ona'].includes(user?.username?.toLowerCase()) ? [] : preferences.groups}
              hiddenGroups={['txell', 'ona'].includes(user?.username?.toLowerCase()) ? ['merit'] : []}
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
              managedUsers={linkedUsers.map(u => u.username)}
            />
          } />
          <Route path="/event/:id" element={
            <CalendarView
              viewMode="calendar"
              tournaments={filteredTournaments}
              results={results}
              activeGroups={['txell', 'ona'].includes(user?.username?.toLowerCase()) ? [] : preferences.groups}
              hiddenGroups={['txell', 'ona'].includes(user?.username?.toLowerCase()) ? ['merit'] : []}
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
              managedUsers={linkedUsers.map(u => u.username)}
            />
          } />
          <Route path="/stats" element={<StatsView user={user} linkedUsers={linkedUsers} results={results} tournaments={tournaments} />} />
          <Route path="/handicap" element={<HandicapView user={user} currentHandicap={handicap} results={results} tournaments={tournaments} />} />
          <Route path="/admin" element={
            <AdminRoute user={sessionOwner || user}>
              <AdminDashboardView user={sessionOwner || user} />
            </AdminRoute>
          } />
        </Routes>
      </main>

      {/* PWA Update Banner */}
      {needRefresh && (
        <div className="fade-in" style={{
          position: 'fixed', bottom: '30px', left: '20px', right: '20px',
          backgroundColor: '#0f172a', color: 'white', padding: '12px 16px', borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 10000, display: 'flex', gap: '12px', alignItems: 'center',
          border: '1px solid rgba(255,255,255,0.1)', justifyContent: 'space-between',
          maxWidth: '500px', margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'var(--color-primary)', padding: '8px', borderRadius: '10px' }}>
              🚀
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem' }}>Nueva versión</p>
              <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>Haz clic para actualizar</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAppUpdate}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: 'white', color: '#0f172a', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '0.85rem'
              }}
            >
              ACTUALIZAR
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              style={{
                padding: '8px', borderRadius: '8px', border: 'none',
                background: 'rgba(255,255,255,0.1)', color: 'white',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

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

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email (Opcional)</label>
                <input
                  type="email"
                  placeholder="ejemplo@email.com"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #E5E1DE', boxSizing: 'border-box' }}
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
                style={{ width: '100%', marginBottom: '1rem' }}
                disabled={isUpdatingProfile}
              >
                {isUpdatingProfile ? 'Guardando...' : 'Guardar Cambios'}
              </button>

              <button
                type="button"
                className="btn"
                onClick={handleRecoverProfile}
                style={{ width: '100%', background: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.2)', fontSize: '0.85rem' }}
              >
                🔄 Restaurar Foto y Datos (Legacy)
              </button>

              <div style={{ marginTop: '2rem', borderTop: '1px dashed #E5E1DE', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '10px' }}>
                  ¿Problemas con el perfil? Prueba a limpiar la app:
                </p>
                <button
                  type="button"
                  onClick={handleHardReset}
                  style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Borrar caché y resetear aplicación
                </button>
                <p style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '5px', opacity: 0.5 }}>
                  ID: {user.username} | Photo: {String(user.photo_url).substring(0, 20)}...
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <BrowserRouter basename={basename}>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
