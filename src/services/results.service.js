/**
 * Results Service
 *
 * Handles golf result operations: real-time sync from Firestore,
 * saving individual results, deleting results, and batch cleanup.
 */

import { db } from '../firebase';
import { onSnapshot, setDoc, deleteDoc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import {
  getUserSubcollectionRef,
  getUserSubdocRef,
} from '../utils/userProfiles';
import {
  isSharedTournamentId,
  resetParticipantScore,
  updateParticipantScore,
} from './leaderboard.service';
import { resolveCanonicalTournamentId } from '../utils/tournamentIds';
import {
  deserializeResultFromFirestore,
  serializeResultForFirestore,
} from '../utils/resultSerialization';

function getLeaderboardSyncId(tournamentId) {
  const canonicalId = resolveCanonicalTournamentId(tournamentId);
  if (!canonicalId) return null;

  const idChanged = String(canonicalId) !== String(tournamentId);
  return idChanged || isSharedTournamentId(canonicalId) ? String(canonicalId) : null;
}

const syncedParticipantScores = new Map();

function getResultSyncSignature(resultData) {
  return JSON.stringify({
    rounds: resultData?.rounds || [],
    scorecards: resultData?.scorecards || {},
    tournamentName: resultData?.tournamentName || null,
    tournamentCourse: resultData?.tournamentCourse || null,
    tournamentDates: resultData?.tournamentDates || null,
    tournamentPar: resultData?.tournamentPar || resultData?.par || null,
  });
}

async function syncParticipantScoreForResult(user, tournamentId, resultData) {
  const leaderboardId = getLeaderboardSyncId(tournamentId);
  if (!leaderboardId || !resultData) return;

  const syncKey = `${user.username || 'user'}::${leaderboardId}`;
  const signature = getResultSyncSignature(resultData);
  if (syncedParticipantScores.get(syncKey) === signature) return;

  await updateParticipantScore(user, leaderboardId, resultData);
  syncedParticipantScores.set(syncKey, signature);
}

function backfillParticipantScores(user, resultsMap) {
  if (!user?.username || !resultsMap) return;

  Object.entries(resultsMap).forEach(([tournamentId, resultData]) => {
    syncParticipantScoreForResult(user, tournamentId, resultData).catch((err) => {
      console.warn('[results] Could not backfill participant score:', err);
    });
  });
}

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
      newResults[doc.id] = deserializeResultFromFirestore(doc.data());
    });
    console.log('[results] Synced from Firebase:', Object.keys(newResults).length);
    onUpdate(newResults);
    backfillParticipantScores(user, newResults);
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
  const scorecards = resultData?.scorecards || {};
  const privateScorecards = {};
  const includesRfegStats = Object.values(scorecards).some((card) => Object.prototype.hasOwnProperty.call(card || {}, 'rfeg'));
  const publicScorecards = Object.fromEntries(Object.entries(scorecards).map(([roundKey, card]) => {
    if (card?.rfeg) privateScorecards[roundKey] = card.rfeg;
    const publicCard = { ...(card || {}) };
    delete publicCard.rfeg;
    return [roundKey, publicCard];
  }));
  const publicResult = serializeResultForFirestore({ ...resultData, scorecards: publicScorecards });
  delete publicResult.rfeg;

  const batch = writeBatch(db);
  batch.set(ref, publicResult);
  if (includesRfegStats) {
    const hasPrivateStats = Object.values(privateScorecards).some((round) => (
      Boolean(round?.roundCode) ||
      Object.values(round || {}).some((values) => Array.isArray(values) && values.some((value) => value !== '' && value !== null && value !== undefined))
    ));
    const privateRef = getUserSubdocRef(db, user, 'rfeg_statistics', String(tournamentId));
    if (hasPrivateStats) batch.set(privateRef, { scorecards: privateScorecards, updatedAt: new Date().toISOString() });
    else batch.delete(privateRef);
  }
  await batch.commit();

  syncParticipantScoreForResult(user, tournamentId, resultData).catch((err) => {
    console.warn('[results] Could not backfill participant score:', err);
  });
}

/** Loads owner-only RFEG fields kept outside publicly readable live results. */
export async function getRfegStatistics(user, tournamentId) {
  if (!user || !tournamentId) return {};
  const ref = getUserSubdocRef(db, user, 'rfeg_statistics', String(tournamentId));
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? (snapshot.data().scorecards || {}) : {};
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
  await deleteDoc(getUserSubdocRef(db, user, 'rfeg_statistics', String(tournamentId)));

  const leaderboardId = getLeaderboardSyncId(tournamentId);
  if (leaderboardId) {
    resetParticipantScore(user, leaderboardId).catch((err) => {
      console.warn('[results] Could not reset participant score:', err);
    });
  }
}

/**
 * Deletes all results for a user (use with caution - no recovery).
 * @param {object} user - Current user profile
 * @returns {Promise<void>}
 */
export async function deleteAllResults(user) {
  if (!user) throw new Error('User is required');

  const ref = getUserSubcollectionRef(db, user, 'results');
  const privateRef = getUserSubcollectionRef(db, user, 'rfeg_statistics');
  const [snapshot, privateSnapshot] = await Promise.all([getDocs(ref), getDocs(privateRef)]);

  if (snapshot.empty && privateSnapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.forEach((doc) => batch.delete(doc.ref));
  privateSnapshot.forEach((doc) => batch.delete(doc.ref));
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
