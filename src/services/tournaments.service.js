/**
 * Tournaments Service
 *
 * Handles tournament operations: real-time Firestore subscriptions,
 * adding/updating/deleting custom tournaments, and merging with official data.
 */

import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, getDoc, updateDoc, increment, getDocs } from 'firebase/firestore';
import { getUserSubcollectionRef, getUserSubdocRef } from '../utils/userProfiles';
import { getYear } from '../utils/dateHelpers';
import { joinTournamentAsParticipant } from './leaderboard.service';
import {
  generateTournamentDeterministicId,
  resolveCanonicalTournamentId,
  getTournamentIdCandidates,
} from '../utils/tournamentIds';

export { generateTournamentDeterministicId, resolveCanonicalTournamentId, getTournamentIdCandidates };

// ─── Official Tournaments ─────────────────────────────────────────────────────

/**
 * Subscribes to real-time updates for official tournaments from Firestore.
 * @param {Function} onUpdate - Called with updated tournament array on each change
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToOfficialTournaments(onUpdate) {
  const unsubscribe = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
    const tourneys = snapshot.docs.map((doc) => ({
      id: resolveCanonicalTournamentId(doc.id),
      ...doc.data(),
      legacyIds: getTournamentIdCandidates(doc.id).filter((candidateId) => candidateId !== resolveCanonicalTournamentId(doc.id)),
    }));
    if (tourneys.length > 0) {
      console.log('[tournaments] Loaded official tournaments:', tourneys.length);
      onUpdate(tourneys);
    }
  });

  return unsubscribe;
}

// ─── Shared/Community Tournaments ───────────────────────────────────────────

/**
 * Subscribes to public shared tournaments from the community.
 * @param {Function} onUpdate - Called with shared tournaments array
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToSharedTournaments(onUpdate) {
  const q = query(collection(db, 'shared_tournaments'));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const shared = snapshot.docs.map((doc) => ({ 
      id: resolveCanonicalTournamentId(doc.id), 
      ...doc.data(),
      isShared: true,
      groups: Array.from(new Set([...(doc.data().groups || []), 'comunidad']))
    }));
    onUpdate(shared);
  }, (error) => {
    if (error?.code === 'permission-denied') {
      console.warn('[tournaments] Shared tournaments unavailable for current session');
      onUpdate([]);
      return;
    }

    console.error('[tournaments] Shared tournaments listener failed:', error);
  });

  return unsubscribe;
}

/**
 * Publishes a tournament to the shared community pool.
 * @param {object} user - User profile of the creator
 * @param {object} tournament - Tournament data
 */
export async function publishTournament(user, tournament) {
  if (!user || !tournament) throw new Error('User and tournament data required');

  const deterministicId = resolveCanonicalTournamentId(
    tournament.id || generateTournamentDeterministicId(tournament)
  );
  
  const sharedData = {
    ...tournament,
    id: deterministicId, // Ensure the shared doc has the deterministic ID
    originalId: tournament.id,
    sharedBy: user.username || user.uid,
    sharedByName: user.full_name || user.username,
    sharedAt: serverTimestamp(),
    isShared: true,
    groups: tournament.groups || ['club']
  };

  // setDoc with the deterministic ID to avoid duplicates in the shared pool
  await setDoc(doc(db, 'shared_tournaments', deterministicId), sharedData);
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
    const customs = snapshot.docs.map((doc) => ({
      id: resolveCanonicalTournamentId(doc.id),
      ...doc.data(),
    }));
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
  if (!user || !tournament?.name) throw new Error('User and tournament name are required');
  
  // Always use deterministic ID for custom tournaments to unify them across users
  const deterministicId = resolveCanonicalTournamentId(
    tournament.id || generateTournamentDeterministicId(tournament)
  );
  const tournamentWithId = { ...tournament, id: deterministicId };
  
  await setDoc(getUserSubdocRef(db, user, 'custom_tournaments', deterministicId), tournamentWithId);
  return deterministicId;
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

// ─── Normalization & Migration ────────────────────────────────────────────────

/**
 * Normalizes a user's custom tournaments to use deterministic IDs.
 * This is used to unify identical tournaments created by different users.
 * 
 * @param {object} user - User profile
 * @param {object[]} customTournaments - List of current custom tournaments
 * @param {object} resultsMap - Map of results { [id]: data }
 */
export async function normalizeUserTournaments(user, customTournaments, resultsMap) {
  if (!user || !customTournaments.length) return;

  const { saveResult, deleteResult } = await import('./results.service');

  for (const t of customTournaments) {
    const detId = resolveCanonicalTournamentId(
      t.id || generateTournamentDeterministicId(t)
    );
    
    // If current ID is already correct or it's an official ID (not custom), skip
    if (t.id === detId) continue;
    
    console.log(`[migration] Normalizing tournament "${t.name}" from ${t.id} to ${detId}`);

    // 1. Create new tournament entry with deterministic ID
    const newTournament = { ...t, id: detId };
    await addCustomTournament(user, newTournament);

    // 2. If there are results for the old ID, migrate them
    if (resultsMap[t.id]) {
      console.log(`[migration] Moving results for ${t.name}`);
      await saveResult(user, detId, resultsMap[t.id]);
      await deleteResult(user, t.id);
    }

    // 3. Delete old tournament entry
    await deleteCustomTournament(user, t.id);
  }
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

    // MariaRos-specific: hide all Orden de Merito (type 'merit' or name 'ORDEN DE MERITO')
    const isMariaRos = user?.username?.toLowerCase() === 'mariaros' || user?.full_name?.toLowerCase().includes('maria ros');
    if (isMariaRos && (t.type === 'merit' || String(t.name).toUpperCase().includes('ORDEN DE MERITO'))) return false;

    // Custom overrides same ID
    if (customTournaments.some((ct) => String(ct.id) === String(t.id))) return false;

    // Soft match: same name AND dates
    if (customTournaments.some((ct) => ct.name === t.name && ct.dates === t.dates)) return false;

    return true;
  });

  // 2. Separate shared from custom in the input array to check for cross-duplicates
  const fromCommunity = customTournaments.filter(t => t.isShared || String(t.id).includes('_')); // Detective logic for slug-based IDs

  // 3. MASTER SYNC LOGIC:
  // For any tournament the user has "Added" (custom list), if it exists in the 
  // master pool (baseTournaments or current shared snapshot), we SYNC the shared fields.
  const masterTournamentsMap = new Map();
  [...baseTournaments, ...fromCommunity].forEach(mt => {
    if (mt.id) masterTournamentsMap.set(String(mt.id), mt);
  });

  const syncedCustomTournaments = customTournaments.map(ct => {
    const master = masterTournamentsMap.get(String(ct.id));
    if (master) {
      // Sync shared truth fields but keep user-specific overrides
      return {
        ...ct,
        name: master.name,
        dates: master.dates,
        course: master.course,
        lastSyncedAt: new Date().toISOString()
      };
    }
    return ct;
  });

  return [...filtered, ...syncedCustomTournaments];
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

// ─── Subscription System (Join/Leave tournaments) ─────────────────────────────

/**
 * Subscribes a user to a shared tournament.
 * Saves a lightweight reference (NOT a copy) in /users/{uid}/subscribed_tournaments/{id}.
 * The actual tournament data always comes from the source shared_tournaments doc.
 *
 * @param {object} user - User profile
 * @param {object} tournament - Tournament from shared_tournaments (must have id)
 * @returns {Promise<void>}
 */
export async function joinTournament(user, tournament) {
  if (!user || !tournament?.id) throw new Error('User and tournament required');

  const canonicalId = resolveCanonicalTournamentId(tournament.id);
  const canonicalTournament = {
    ...tournament,
    id: canonicalId,
  };
  const ref = getUserSubdocRef(db, user, 'subscribed_tournaments', canonicalId);
  await setDoc(ref, {
    tournamentId: canonicalId,
    joinedAt: serverTimestamp(),
    source: canonicalTournament.isShared ? 'shared' : 'official',
    // Always cache a full snapshot so we can show it even if resolution fails
    name: canonicalTournament.name,
    dates: canonicalTournament.dates,
    course: canonicalTournament.course,
    type: canonicalTournament.type || 'official',
    groups: canonicalTournament.groups || [],
    valedera: canonicalTournament.valedera || false,
  }, { merge: true });

  // Mirror every join into the public participants subcollection so the
  // roster and counts have a single source of truth for both official and
  // community tournaments.
  try {
    await joinTournamentAsParticipant(user, canonicalId, canonicalTournament);

    // Shared/community tournaments also keep an aggregate counter on their
    // source doc for legacy UI surfaces.
    if (canonicalTournament.isShared || String(canonicalId).includes('_')) {
      const sharedRef = doc(db, 'shared_tournaments', canonicalId);
      await updateDoc(sharedRef, { 
        subscriberCount: increment(1) 
      }).catch(async (err) => {
        // If doc doesn't exist (it's an official tournament with shared ID but not in shared_tournaments yet)
        if (err.code === 'not-found') {
          await setDoc(sharedRef, { ...canonicalTournament, subscriberCount: 1 }, { merge: true });
        }
      });
    }
  } catch (e) {
    console.warn('[joinTournament] Could not register participant:', e.message);
  }
}

export async function leaveTournament(user, tournamentId) {
  if (!user || !tournamentId) throw new Error('User and tournamentId required');

  const canonicalId = resolveCanonicalTournamentId(tournamentId);
  const ref = getUserSubdocRef(db, user, 'subscribed_tournaments', canonicalId);
  const participantRef = doc(db, 'tournaments', canonicalId, 'participants', String(user.username));
  
  // Check source before decrementing counter
  try {
    const snap = await getDoc(ref);
    if (snap.exists() && (snap.data().source === 'shared' || String(canonicalId).includes('_'))) {
      const sharedRef = doc(db, 'shared_tournaments', canonicalId);
      await updateDoc(sharedRef, { 
        subscriberCount: increment(-1) 
      }).catch(() => {/* ignore if shared doc doesn't exist */});
    }
  } catch (e) {
    console.warn('[leaveTournament] Could not update subscriberCount:', e.message);
  }

  try {
    await deleteDoc(participantRef);
  } catch (e) {
    console.warn('[leaveTournament] Could not remove participant doc:', e.message);
  }

  await deleteDoc(ref);
}

export function subscribeToSubscribedTournaments(user, onUpdate) {
  if (!user?.username) return () => {};

  const ref = getUserSubcollectionRef(db, user, 'subscribed_tournaments');

  const unsub = onSnapshot(ref, async (snapshot) => {
    if (snapshot.empty) { onUpdate([], []); return; }

    const rawIds = snapshot.docs
      .map((d) => resolveCanonicalTournamentId(d.data().tournamentId))
      .filter(Boolean);
    const cachedDocs = snapshot.docs.map(d => d.data());

    // Build full tournament objects from the cached snapshot first (instant),
    // then try to resolve from Firestore for live data
    const resolved = await Promise.all(
      cachedDocs.map(async (cached) => {
        const tid = resolveCanonicalTournamentId(cached.tournamentId);
        if (!tid) return null;

        for (const candidateId of getTournamentIdCandidates({ id: tid, name: cached.name, dates: cached.dates, course: cached.course, type: cached.type })) {
          // 1. Try shared_tournaments (community)
          try {
            const sourceSnap = await getDoc(doc(db, 'shared_tournaments', candidateId));
            if (sourceSnap.exists()) {
              return {
                id: sourceSnap.id,
                ...sourceSnap.data(),
                isShared: true,
                isSubscribed: true,
                groups: Array.from(new Set([...(sourceSnap.data().groups || []), 'comunidad'])),
              };
            }
          } catch { /* continue */ }

          // 2. Try official tournaments collection
          try {
            const officialSnap = await getDoc(doc(db, 'tournaments', candidateId));
            if (officialSnap.exists()) {
              return {
                id: officialSnap.id,
                ...officialSnap.data(),
                isSubscribed: true,
              };
            }
          } catch { /* continue */ }
        }

        // 3. Fall back to cached snapshot stored at join time
        if (cached.name && cached.dates) {
          return {
            id: tid,
            ...cached,
            isSubscribed: true,
          };
        }

        return null;
      })
    );

    onUpdate(resolved.filter(Boolean), rawIds);
  });

  return unsub;
}

/**
 * Fetches the participant count for a list of shared tournament IDs.
 * Uses one-shot getDocs (not real-time) to minimize reads.
 *
 * @param {string[]} tournamentIds
 * @returns {Promise<Record<string, number>>} - { [id]: count }
 */
export async function fetchParticipantCounts(tournamentIds) {
  if (!tournamentIds?.length) return {};

  const counts = {};
  await Promise.all(
    tournamentIds.map(async (id) => {
      try {
        const canonicalId = resolveCanonicalTournamentId(id);
        const snap = await getDoc(doc(db, 'shared_tournaments', canonicalId));
        counts[canonicalId] = snap.exists() ? (snap.data().subscriberCount || 0) : 0;
      } catch {
        counts[String(id)] = 0;
      }
    })
  );
  return counts;
}

/**
 * Fetches participant names and counts from /tournaments/{id}/participants.
 * This is the shared roster used by both official and community tournaments.
 *
 * @param {(string|number)[]} tournamentIds
 * @returns {Promise<Record<string, { count: number, names: string[] }>>}
 */
export async function fetchTournamentParticipantMeta(tournamentIds) {
  if (!tournamentIds?.length) return {};

  const meta = {};
  await Promise.all(
    tournamentIds.map(async (id) => {
      const key = resolveCanonicalTournamentId(id);
      try {
        const snap = await getDocs(collection(db, 'tournaments', key, 'participants'));
        meta[key] = {
          count: snap.size,
          names: snap.docs
            .map((participantDoc) => {
              const data = participantDoc.data();
              return data.fullName || data.full_name || data.username || participantDoc.id;
            })
            .filter(Boolean)
            .sort((a, b) => String(a).localeCompare(String(b), 'es')),
        };
      } catch {
        meta[key] = { count: 0, names: [] };
      }
    })
  );

  return meta;
}
