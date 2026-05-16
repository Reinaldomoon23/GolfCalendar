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

export function getResultProgress(resultData) {
  const scorecards = resultData?.scorecards || {};
  const roundKeys = Object.keys(scorecards).sort((a, b) => Number(a) - Number(b));
  let totalPlayed = 0;
  let latestPlayedRound = null;
  let nextEmptyRound = null;

  for (const roundKey of roundKeys) {
    const card = scorecards[roundKey] || {};
    let holesPlayed = 0;

    for (let i = 0; i < 18; i += 1) {
      const stroke = String(card.strokes?.[i] || '').trim();
      if (stroke !== '' && stroke !== '-' && stroke !== '0') holesPlayed += 1;
    }

    totalPlayed += holesPlayed;
    const roundNumber = Number(roundKey) + 1;

    if (holesPlayed > 0 && holesPlayed < 18) {
      return {
        status: 'in_progress',
        currentRound: roundNumber,
        currentHole: holesPlayed + 1,
        holesPlayed: totalPlayed,
        progressLabel: roundKeys.length > 1 ? `R${roundNumber} · Hoyo ${holesPlayed + 1}` : `Hoyo ${holesPlayed + 1}`,
      };
    }

    if (holesPlayed === 18) {
      latestPlayedRound = roundNumber;
    } else if (holesPlayed === 0 && latestPlayedRound !== null && nextEmptyRound === null) {
      nextEmptyRound = roundNumber;
    }
  }

  if (nextEmptyRound !== null) {
    return {
      status: 'in_progress',
      currentRound: nextEmptyRound,
      currentHole: 1,
      holesPlayed: totalPlayed,
      progressLabel: roundKeys.length > 1 ? `R${nextEmptyRound} · Hoyo 1` : 'Hoyo 1',
    };
  }

  if (totalPlayed > 0) {
    return {
      status: 'finished',
      currentRound: latestPlayedRound,
      currentHole: null,
      holesPlayed: totalPlayed,
      progressLabel: 'Finalizada',
    };
  }

  if (Array.isArray(resultData?.rounds) && resultData.rounds.some((roundScore) => Number(roundScore) > 0)) {
    return {
      status: 'finished',
      currentRound: null,
      currentHole: null,
      holesPlayed: null,
      progressLabel: 'Finalizada',
    };
  }

  return {
    status: 'pending',
    currentRound: null,
    currentHole: null,
    holesPlayed: 0,
    progressLabel: 'Pendiente',
  };
}

function getResultScoreSummary(resultData) {
  const scorecards = resultData?.scorecards || {};
  const roundKeys = Object.keys(scorecards).sort((a, b) => Number(a) - Number(b));
  const rounds = [];
  let total = 0;
  let totalPar = 0;

  for (const roundKey of roundKeys) {
    const card = scorecards[roundKey] || {};
    let roundScore = 0;
    let roundPar = 0;
    let holesPlayed = 0;

    for (let i = 0; i < 18; i += 1) {
      const stroke = parseInt(card.strokes?.[i], 10);
      if (!Number.isFinite(stroke) || stroke <= 0) continue;

      const holePar = parseInt(card.pars?.[i], 10);
      roundScore += stroke;
      roundPar += Number.isFinite(holePar) && holePar > 0 ? holePar : 4;
      holesPlayed += 1;
    }

    if (holesPlayed > 0) {
      rounds.push(roundScore);
      total += roundScore;
      totalPar += roundPar;
    }
  }

  if (rounds.length > 0) {
    return { rounds, total, roundsPlayed: rounds.length, totalPar };
  }

  const validScores = (resultData?.rounds || [])
    .filter((r) => r && !isNaN(r))
    .map(Number);
  const fallbackTotal = validScores.reduce((a, b) => a + b, 0);
  const par = Number(resultData?.tournamentPar || resultData?.par || 72);

  return {
    rounds: validScores,
    total: fallbackTotal,
    roundsPlayed: validScores.length,
    totalPar: par * validScores.length,
  };
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
      status: 'pending',
      currentRound: null,
      currentHole: null,
      holesPlayed: 0,
      progressLabel: 'Pendiente',
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

  // Calculate summary from scorecards first so partial live rounds use played-hole par.
  const scoreSummary = getResultScoreSummary(resultData);
  const total = scoreSummary.total;
  const roundsPlayed = scoreSummary.roundsPlayed;
  const par = resultData.tournamentPar || 72;
  const vspar = total > 0 ? total - scoreSummary.totalPar : null;
  const progress = getResultProgress(resultData);

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
    rounds: scoreSummary.rounds,
    par,
    hasScore: total > 0,
    status: progress.status,
    currentRound: progress.currentRound,
    currentHole: progress.currentHole,
    holesPlayed: progress.holesPlayed,
    progressLabel: progress.progressLabel,
    updatedAt: serverTimestamp(),
    joinedAt: serverTimestamp(), // Will only set if doc doesn't exist; merge takes care of existing
    tournamentName: resultData.tournamentName || null,
    tournamentCourse: resultData.tournamentCourse || null,
    tournamentDates: resultData.tournamentDates || null,
  }, { merge: true });
}

/**
 * Clears a participant's public score while keeping their roster entry.
 * Used when a private result is deleted but the player remains joined.
 *
 * @param {object} user - Current user profile
 * @param {string} tournamentId - The centralized tournament ID
 * @returns {Promise<void>}
 */
export async function resetParticipantScore(user, tournamentId) {
  if (!user?.username || !tournamentId) return;

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
    total: null,
    roundsPlayed: 0,
    vspar: null,
    rounds: [],
    hasScore: false,
    status: 'pending',
    currentRound: null,
    currentHole: null,
    holesPlayed: 0,
    progressLabel: 'Pendiente',
    updatedAt: serverTimestamp(),
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
