/**
 * Auth Service
 *
 * Centralizes Firebase Authentication logic: login, logout, session resolution,
 * and profile bootstrapping. Keeps App.jsx free of auth boilerplate.
 */

import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ensureUserProfileDocument,
  fetchUserProfileByUid,
  fetchUserProfileByUsername,
} from '../utils/userProfiles';
import { writeSavedUser, readSavedUser, writeLinkedUsers, clearSessionCache } from '../utils/cache';
import { setUser as setSentryUser } from '../utils/sentry';

// ─── Session Resolution ───────────────────────────────────────────────────────

/**
 * Resolves the full user profile from a Firebase auth user.
 * Also fetches all managed profiles if the user is a manager.
 *
 * @param {import('firebase/auth').User} authUser - Firebase Auth user object
 * @returns {Promise<{ ownerProfile: object, activeUser: object, managedProfiles: object[] }>}
 */
export async function resolveSession(authUser) {
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
    full_name: resolvedProfile?.full_name || authUser.displayName || inferredUsername,
  }, inferredUsername);

  const managedProfiles = await loadManagedProfiles(ownerProfile);
  const savedActiveUser = readSavedUser();

  let activeUser = ownerProfile;

  if (managedProfiles.length > 0) {
    const preferredManagedUser = savedActiveUser?.manager_id === ownerProfile.username
      ? managedProfiles.find((p) => p.username === savedActiveUser.username)
      : null;

    const firstManagedUser = managedProfiles.find((p) =>
      (ownerProfile.managed_users || []).includes(p.username)
    );

    activeUser = preferredManagedUser || firstManagedUser || ownerProfile;

    if (activeUser.username !== ownerProfile.username) {
      activeUser = { ...activeUser, manager_id: ownerProfile.username };
    }

    writeLinkedUsers(managedProfiles);
  }

  writeSavedUser(activeUser);

  setSentryUser({
    uid: activeUser.uid || ownerProfile.uid,
    username: activeUser.username,
    displayName: activeUser.full_name,
  });

  return { ownerProfile, activeUser, managedProfiles };
}

/**
 * Fetches all profile objects for managed users of a manager account.
 *
 * @param {object} ownerProfile - Manager's profile (must have managed_users array)
 * @returns {Promise<object[]>} - Array of profiles (owner first, then managed)
 */
export async function loadManagedProfiles(ownerProfile) {
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

  // Deduplicate by username
  return profiles.filter((profile, index, array) =>
    array.findIndex((candidate) => candidate.username === profile.username) === index
  );
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribes to Firebase auth state changes.
 * Calls onLogin with resolved session or onLogout when signed out.
 *
 * @param {{ onLogin: Function, onLogout: Function, onError: Function }} callbacks
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToAuthState({ onLogin, onLogout, onError }) {
  let cancelled = false;

  const unsubscribe = onAuthStateChanged(auth, (authUser) => {
    void (async () => {
      if (!authUser) {
        if (!cancelled) onLogout();
        return;
      }

      try {
        const session = await resolveSession(authUser);
        if (!cancelled) onLogin(session);
      } catch (error) {
        console.error('[auth] Error resolving session:', error);
        if (!cancelled) onError?.(error);
      }
    })();
  });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Signs out the current Firebase user and clears session cache.
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('[auth] Error signing out:', error);
    throw error;
  } finally {
    clearSessionCache();
    setSentryUser(null);
  }
}

/**
 * Resets all auth-related local state (call from component after logout)
 * @param {Function} dispatch - Optional callback to notify component
 */
export function resetAuthState(dispatch) {
  clearSessionCache();
  setSentryUser(null);
  dispatch?.();
}
