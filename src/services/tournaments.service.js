/**
 * Tournaments Service
 *
 * Handles tournament operations: real-time Firestore subscriptions,
 * adding/updating/deleting custom tournaments, and merging with official data.
 */

import { db } from '../firebase';
import { collection, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import {
  getUserSubcollectionRef,
  getUserSubdocRef,
} from '../utils/userProfiles';
import { getYear } from '../utils/dateHelpers';

// ─── Official Tournaments ─────────────────────────────────────────────────────

/**
 * Subscribes to real-time updates for official tournaments from Firestore.
 * @param {Function} onUpdate - Called with updated tournament array on each change
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToOfficialTournaments(onUpdate) {
  const unsubscribe = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
    const tourneys = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (tourneys.length > 0) {
      console.log('[tournaments] Loaded official tournaments:', tourneys.length);
      onUpdate(tourneys);
    }
  });

  return unsubscribe;
}

/**
 * Subscribes to real-time updates for a user's custom tournaments.
 * @param {object} user - User profile object
 * @param {Function} onUpdate - Called with updated custom tournaments array
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToCustomTournaments(user, onUpdate) {
  if (!user?.username) return () => {};

  const ref = getUserSubcollectionRef(db, user, 'custom_tournaments');

  const unsubscribe = onSnapshot(ref, (snapshot) => {
    const customs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    onUpdate(customs);
  });

  return unsubscribe;
}

// ─── Custom Tournament CRUD ───────────────────────────────────────────────────

/**
 * Adds a new custom tournament for the current user.
 * @param {object} user - User profile object
 * @param {object} tournament - Tournament data object (must have `id`)
 * @returns {Promise<void>}
 */
export async function addCustomTournament(user, tournament) {
  if (!user || !tournament?.id) throw new Error('User and tournament.id are required');
  await setDoc(getUserSubdocRef(db, user, 'custom_tournaments', tournament.id), tournament);
}

/**
 * Updates an existing custom tournament.
 * @param {object} user - User profile object
 * @param {object} tournament - Updated tournament data (must have `id`)
 * @returns {Promise<void>}
 */
export async function updateCustomTournament(user, tournament) {
  if (!user || !tournament?.id) throw new Error('User and tournament.id are required');
  await setDoc(getUserSubdocRef(db, user, 'custom_tournaments', tournament.id), tournament);
}

/**
 * Deletes a custom tournament for the user.
 * @param {object} user - User profile object
 * @param {string|number} tournamentId - Tournament ID to delete
 * @returns {Promise<void>}
 */
export async function deleteCustomTournament(user, tournamentId) {
  if (!user || !tournamentId) throw new Error('User and tournamentId are required');
  const ref = getUserSubdocRef(db, user, 'custom_tournaments', tournamentId);
  await deleteDoc(ref);
}

// ─── Merge & Filter ───────────────────────────────────────────────────────────

/**
 * Merges official and custom tournaments, applying preference filters.
 * Custom tournaments override official ones by ID or by name+date.
 *
 * @param {object[]} baseTournaments - Official tournament list from Firestore
 * @param {object[]} customTournaments - User's custom tournament list
 * @param {{ hiddenIds?: (string|number)[] }} preferences - User preferences
 * @param {object} user - Current user (for user-specific filters like 'jordi')
 * @returns {object[]} - Merged tournament list
 */
export function mergeTournaments(baseTournaments, customTournaments, preferences, user) {
  const hiddenIds = preferences?.hiddenIds || [];

  const filtered = baseTournaments.filter((t) => {
    // Filter hidden
    if (hiddenIds.includes(t.id) || hiddenIds.includes(String(t.id))) return false;

    // Jordi-specific override (only Orden de Merito)
    if (user?.username === 'jordi' && t.type !== 'merit') return false;

    // Custom overrides same ID
    if (customTournaments.some((ct) => String(ct.id) === String(t.id))) return false;

    // Soft match: same name AND dates
    if (customTournaments.some((ct) => ct.name === t.name && ct.dates === t.dates)) return false;

    return true;
  });

  return [...filtered, ...customTournaments];
}

/**
 * Filters a tournament list to only include tournaments from a given year/season.
 * @param {object[]} tournaments - Full merged tournament list
 * @param {string} season - Year string (e.g., "2026")
 * @returns {object[]}
 */
export function filterBySeason(tournaments, season) {
  return tournaments.filter((t) => getYear(t.dates) === season);
}

/**
 * Extracts the sorted list of unique years available in a tournament list.
 * Always includes the base year.
 *
 * @param {object[]} tournaments - Tournament list
 * @param {string} [baseYear='2026'] - Year that's always included
 * @returns {string[]} - Sorted years descending (e.g. ["2026", "2025"])
 */
export function getAvailableSeasons(tournaments, baseYear = '2026') {
  const years = new Set([baseYear]);
  tournaments.forEach((t) => {
    const y = getYear(t.dates);
    if (y) years.add(y);
  });
  return Array.from(years).sort().reverse();
}
