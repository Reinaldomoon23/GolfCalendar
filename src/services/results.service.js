/**
 * Results Service
 *
 * Handles golf result operations: real-time sync from Firestore,
 * saving individual results, deleting results, and batch cleanup.
 */

import { db } from '../firebase';
import { onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import {
  getUserSubcollectionRef,
  getUserSubdocRef,
} from '../utils/userProfiles';

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribes to real-time result updates for a user.
 * @param {object} user - User profile object
 * @param {Function} onUpdate - Called with results object { [tournamentId]: resultData }
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToResults(user, onUpdate) {
  if (!user?.username) return () => {};

  const ref = getUserSubcollectionRef(db, user, 'results');

  const unsubscribe = onSnapshot(ref, (snapshot) => {
    const newResults = {};
    snapshot.forEach((doc) => {
      newResults[doc.id] = doc.data();
    });
    console.log('[results] Synced from Firebase:', Object.keys(newResults).length);
    onUpdate(newResults);
  });

  return unsubscribe;
}

// ─── Save / Update ────────────────────────────────────────────────────────────

/**
 * Saves (or updates) a single tournament result to Firestore.
 * @param {object} user - Current user profile
 * @param {string|number} tournamentId - Tournament ID
 * @param {object} resultData - Result data to save
 * @returns {Promise<void>}
 */
export async function saveResult(user, tournamentId, resultData) {
  if (!user || !tournamentId) throw new Error('User and tournamentId are required');
  const ref = getUserSubdocRef(db, user, 'results', String(tournamentId));
  await setDoc(ref, resultData);
}

/**
 * Saves multiple results at once (use sparingly - prefer saveResult for single changes).
 * @param {object} user - Current user profile
 * @param {{ [id: string]: object }} resultsMap - Map of tournamentId → resultData
 * @returns {Promise<void>}
 */
export async function saveAllResults(user, resultsMap) {
  if (!user) throw new Error('User is required');
  const entries = Object.entries(resultsMap);
  await Promise.all(entries.map(([id, data]) => saveResult(user, id, data)));
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Deletes a single result from Firestore.
 * @param {object} user - Current user profile
 * @param {string|number} tournamentId - Tournament ID whose result to delete
 * @returns {Promise<void>}
 */
export async function deleteResult(user, tournamentId) {
  if (!user || !tournamentId) throw new Error('User and tournamentId are required');
  const ref = getUserSubdocRef(db, user, 'results', String(tournamentId));
  await deleteDoc(ref);
}

/**
 * Deletes all results for a user (use with caution - no recovery).
 * @param {object} user - Current user profile
 * @returns {Promise<void>}
 */
export async function deleteAllResults(user) {
  if (!user) throw new Error('User is required');

  const { getDocs, writeBatch } = await import('firebase/firestore');
  const ref = getUserSubcollectionRef(db, user, 'results');
  const snapshot = await getDocs(ref);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  console.log(`[results] Deleted ${snapshot.size} results for ${user.username}`);
}

// ─── Preferences ──────────────────────────────────────────────────────────────

/**
 * Subscribes to real-time user preferences from Firestore.
 * @param {object} user - User profile object
 * @param {Function} onUpdate - Called with preferences object
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToPreferences(user, onUpdate) {
  if (!user?.username) return () => {};

  const ref = getUserSubdocRef(db, user, 'settings', 'preferences');

  const unsubscribe = onSnapshot(ref, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      onUpdate(data);
    }
  });

  return unsubscribe;
}

/**
 * Saves user preferences to Firestore.
 * @param {object} user - Current user profile
 * @param {object} preferences - Preferences object to save
 * @returns {Promise<void>}
 */
export async function savePreferences(user, preferences) {
  if (!user) throw new Error('User is required');
  const ref = getUserSubdocRef(db, user, 'settings', 'preferences');
  await setDoc(ref, preferences);
}
