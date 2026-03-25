/**
 * useAuth Hook
 *
 * Manages authentication state: Firebase auth subscription, session resolution,
 * linked user switching, and single/multi mode handling.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { fetchUserProfileByUsername } from '../utils/userProfiles';
import { subscribeToAuthState, logout as authLogout } from '../services/auth.service';
import { writeSavedUser, clearSessionCache } from '../utils/cache';
import { setUser as setSentryUser } from '../utils/sentry';
import { IS_MULTI, DEFAULT_USER, DEFAULT_PREFERENCES } from '../config/app';

/**
 * @returns {{
 *   user: object|null,
 *   setUser: Function,
 *   sessionOwner: object|null,
 *   linkedUsers: object[],
 *   authReady: boolean,
 *   handleLogin: Function,
 *   handleLogout: Function,
 *   handleSwitchUser: Function,
 *   handleReturnToOwner: Function,
 *   resetSessionState: Function,
 * }}
 */
export function useAuth({ setResults, setCustomTournaments, setPreferences, setHandicap, setPdfUrl }) {
  const location = useLocation();

  const [authReady, setAuthReady] = useState(!IS_MULTI);
  const [user, setUser] = useState(() => (IS_MULTI ? null : DEFAULT_USER));
  const [sessionOwner, setSessionOwner] = useState(null);
  const [linkedUsers, setLinkedUsers] = useState([]);

  // ─── Reset all session-dependent state ───────────────────────────────────────
  const resetSessionState = () => {
    setUser(null);
    setSessionOwner(null);
    setLinkedUsers([]);
    clearSessionCache();
    setResults({});
    setCustomTournaments([]);
    setPreferences({ ...DEFAULT_PREFERENCES });
    setHandicap(null);
    setPdfUrl(null);
    setSentryUser(null);
  };

  // ─── Firebase Auth subscription (multi mode only) ─────────────────────────
  useEffect(() => {
    if (!IS_MULTI) return undefined;

    let cancelled = false;
    setAuthReady(false);

    const unsubscribe = subscribeToAuthState({
      onLogin: ({ ownerProfile, activeUser, managedProfiles }) => {
        if (cancelled) return;
        setSessionOwner(ownerProfile);
        setUser(activeUser);
        setLinkedUsers(managedProfiles.length > 0 ? managedProfiles : []);
        setAuthReady(true);
      },
      onLogout: () => {
        if (cancelled) return;
        resetSessionState();
        setAuthReady(true);
      },
      onError: () => {
        if (cancelled) return;
        resetSessionState();
        setAuthReady(true);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // ─── Auto-login for single mode ───────────────────────────────────────────
  useEffect(() => {
    if (!IS_MULTI && !user) {
      setUser(DEFAULT_USER);
    }
  }, [user]);

  // ─── Admin "view_as" URL param handling ──────────────────────────────────
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
          writeSavedUser(sessionOwner);
        }
        return;
      }

      const existingProfile = linkedUsers.find((p) => p.username === normalizedUsername);
      const targetProfile = existingProfile || await fetchUserProfileByUsername(db, normalizedUsername);

      if (!targetProfile || cancelled) return;

      const nextActiveUser = { ...targetProfile, manager_id: sessionOwner.username };

      if (user?.username !== nextActiveUser.username || user?.photo_url !== nextActiveUser.photo_url) {
        setUser(nextActiveUser);
        writeSavedUser(nextActiveUser);
      }
    };

    void switchActiveProfile();
    return () => { cancelled = true; };
  }, [linkedUsers, location.search, sessionOwner, user?.photo_url, user?.username]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleLogin = (userData) => {
    if (userData) {
      setUser(userData);
      writeSavedUser(userData);
    }
    setAuthReady(true);
  };

  const handleLogout = async () => {
    if (!IS_MULTI) return;
    try {
      await authLogout();
    } catch (error) {
      console.error('[auth] Error signing out:', error);
      resetSessionState();
      setAuthReady(true);
    }
  };

  const handleSwitchUser = (targetUser) => {
    if (!user) return;
    const ownerUsername = sessionOwner?.username || user.manager_id || user.username;
    const newActiveUser = targetUser.username === ownerUsername
      ? { ...targetUser }
      : { ...targetUser, manager_id: ownerUsername };
    setUser(newActiveUser);
    writeSavedUser(newActiveUser);
  };

  const handleReturnToOwner = () => {
    if (!sessionOwner) return;
    setUser(sessionOwner);
    writeSavedUser(sessionOwner);
  };

  return {
    user,
    setUser,
    sessionOwner,
    linkedUsers,
    setLinkedUsers,
    authReady,
    handleLogin,
    handleLogout,
    handleSwitchUser,
    handleReturnToOwner,
    resetSessionState,
  };
}
