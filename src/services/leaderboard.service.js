/**
 * Leaderboard Service
 *
 * Manages centralized tournament leaderboards:
 * - Writing participant scores to the shared `tournaments/{id}/participants` subcollection
 * - Subscribing to real-time leaderboard updates
 * - Registering a user as a participant (even before they have a score)
 */

import { db } from '../firebase';
import {
  doc,
  setDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';

/**
 * Determines if a tournament ID is a "shared/centralized" one
 * (slug-based deterministic IDs contain underscores and are not purely numeric).
 * @param {string|number} id
 * @returns {boolean}
 */
export function isSharedTournamentId(id) {
  if (!id) return false;
  const strId = String(id);
  // Numeric IDs are official/local; slug IDs (with _) are centralized
  return strId.includes('_') || strId.length > 10;
}

/**
 * Registers a user as a participant in a centralized tournament.
 * This creates/updates their participant document WITHOUT a score yet.
 * Useful to show "X players joined" even before results are recorded.
 *
 * @param {object} user - Current user profile
 * @param {string} tournamentId - The centralized tournament ID
 * @param {object} [tournamentMeta] - Optional: { name, course, dates }
 * @returns {Promise<void>}
 */
export async function joinTournamentAsParticipant(user, tournamentId, tournamentMeta = {}) {
  if (!user?.username || !tournamentId) return;

  const participantRef = doc(
    db,
    'tournaments',
    String(tournamentId),
    'participants',
    user.username
  );

  await setDoc(
    participantRef,
    {
      username: user.username,
      fullName: user.full_name || user.username,
      photo_url: user.photo_url || null,
      joinedAt: serverTimestamp(),
      hasScore: false,
      tournamentName: tournamentMeta.name || null,
      tournamentCourse: tournamentMeta.course || null,
      tournamentDates: tournamentMeta.dates || null,
    },
    { merge: true } // Don't overwrite if they already have a score
  );
}

/**
 * Updates (or creates) a participant's score in a centralized tournament.
 * Called automatically every time a result is saved for a shared tournament.
 *
 * @param {object} user - Current user profile
 * @param {string} tournamentId - The centralized tournament ID
 * @param {object} resultData - The result data being saved
 * @returns {Promise<void>}
 */
export async function updateParticipantScore(user, tournamentId, resultData) {
  if (!user?.username || !tournamentId || !resultData) return;

  // Calculate summary from resultData
  const validScores = (resultData.rounds || [])
    .filter((r) => r && !isNaN(r))
    .map(Number);
  const total = validScores.reduce((a, b) => a + b, 0);
  const roundsPlayed = validScores.length;
  const par = resultData.tournamentPar || 72;
  const totalPar = par * roundsPlayed;
  const vspar = total > 0 ? total - totalPar : null;

  const participantRef = doc(
    db,
    'tournaments',
    String(tournamentId),
    'participants',
    user.username
  );

  await setDoc(participantRef, {
    username: user.username,
    fullName: user.full_name || user.username,
    photo_url: user.photo_url || null,
    total: total > 0 ? total : null,
    roundsPlayed,
    vspar,
    rounds: validScores,
    par,
    hasScore: total > 0,
    updatedAt: serverTimestamp(),
    joinedAt: serverTimestamp(), // Will only set if doc doesn't exist; merge takes care of existing
    tournamentName: resultData.tournamentName || null,
    tournamentCourse: resultData.tournamentCourse || null,
    tournamentDates: resultData.tournamentDates || null,
  }, { merge: true });
}

/**
 * Subscribes to real-time leaderboard updates for a tournament.
 * Returns participants sorted by total strokes (ascending), with non-scorers at the bottom.
 *
 * @param {string} tournamentId - The centralized tournament ID
 * @param {Function} callback - Called with sorted participant array on each update
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToLeaderboard(tournamentId, callback) {
  if (!tournamentId) return () => {};

  const participantsRef = collection(
    db,
    'tournaments',
    String(tournamentId),
    'participants'
  );

  const unsubscribe = onSnapshot(participantsRef, (snapshot) => {
    const participants = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Sort: players with scores first (ascending total), then players without scores
    const sorted = participants.sort((a, b) => {
      if (a.hasScore && !b.hasScore) return -1;
      if (!a.hasScore && b.hasScore) return 1;
      if (!a.hasScore && !b.hasScore) return 0;
      // Both have scores: sort by total (lower is better in stroke play)
      return (a.total || 999) - (b.total || 999);
    });

    callback(sorted);
  });

  return unsubscribe;
}
