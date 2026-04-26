/**
 * Tournaments Service
 *
 * Handles tournament operations: real-time Firestore subscriptions,
 * adding/updating/deleting custom tournaments, and merging with official data.
 */

import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, addDoc, serverTimestamp, query, where, getDocs, getDoc, writeBatch } from 'firebase/firestore';
import { getUserSubcollectionRef, getUserSubdocRef } from '../utils/userProfiles';
import { getYear } from '../utils/dateHelpers';

/**
 * Generates a deterministic unique ID for a tournament based on its name and dates.
 * This ensures that identical tournaments created by different users share the same ID.
 */
export function generateTournamentDeterministicId(name, dates) {
  if (!name || !dates) return 'temp_' + Date.now();
  const slug = name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  // Take only digits from date (e.g. "31/01/2026 - 02/02/2026" -> "3101202602022026")
  const dateStr = dates.replace(/[^0-9]/g, '');
  return `${slug}_${dateStr}`;
}

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
      id: doc.id, 
      ...doc.data(),
      isShared: true,
      groups: Array.from(new Set([...(doc.data().groups || []), 'comunidad']))
    }));
    onUpdate(shared);
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

  const deterministicId = generateTournamentDeterministicId(tournament.name, tournament.dates);
  
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
  if (!user || !tournament?.name) throw new Error('User and tournament name are required');
  
  // Always use deterministic ID for custom tournaments to unify them across users
  const deterministicId = generateTournamentDeterministicId(tournament.name, tournament.dates);
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
    const detId = generateTournamentDeterministicId(t.name, t.dates);
    
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
  const localCustom = customTournaments.filter(t => !fromCommunity.includes(t));

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

  // 4. Final Merge: Only show community ones if NOT already in my selection
  const filteredCommunity = fromCommunity.filter(st => 
    !syncedCustomTournaments.some(lc => String(lc.id) === String(st.id))
  );

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

  const ref = getUserSubdocRef(db, user, 'subscribed_tournaments', String(tournament.id));
  await setDoc(ref, {
    tournamentId: String(tournament.id),
    joinedAt: serverTimestamp(),
    source: 'shared',         // Track where it came from
    // Cache a minimal snapshot for offline support
    name: tournament.name,
    dates: tournament.dates,
    course: tournament.course,
  }, { merge: true });

  // Increment participant counter on the shared tournament doc (fire-and-forget)
  try {
    const sharedRef = doc(db, 'shared_tournaments', String(tournament.id));
    const snap = await getDoc(sharedRef);
    if (snap.exists()) {
      const current = snap.data().subscriberCount || 0;
      await setDoc(sharedRef, { subscriberCount: current + 1 }, { merge: true });
    }
  } catch (e) {
    console.warn('[joinTournament] Could not update subscriberCount:', e.message);
  }
}

/**
 * Unsubscribes a user from a shared tournament.
 * Removes the reference from /users/{uid}/subscribed_tournaments/{id}.
 *
 * @param {object} user - User profile
 * @param {string} tournamentId - Tournament ID to leave
 * @returns {Promise<void>}
 */
export async function leaveTournament(user, tournamentId) {
  if (!user || !tournamentId) throw new Error('User and tournamentId required');

  const ref = getUserSubdocRef(db, user, 'subscribed_tournaments', String(tournamentId));
  await deleteDoc(ref);

  // Decrement subscriber counter (fire-and-forget)
  try {
    const sharedRef = doc(db, 'shared_tournaments', String(tournamentId));
    const snap = await getDoc(sharedRef);
    if (snap.exists()) {
      const current = snap.data().subscriberCount || 1;
      await setDoc(sharedRef, { subscriberCount: Math.max(0, current - 1) }, { merge: true });
    }
  } catch (e) {
    console.warn('[leaveTournament] Could not update subscriberCount:', e.message);
  }
}

/**
 * Subscribes in real-time to the user's subscribed tournament references,
 * then resolves each one against the live shared_tournaments source data.
 *
 * Returns full tournament objects (from source), tagged with isSubscribed: true.
 *
 * @param {object} user - User profile
 * @param {Function} onUpdate - Called with array of resolved tournament objects
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToSubscribedTournaments(user, onUpdate) {
  if (!user?.username) return () => {};

  const ref = getUserSubcollectionRef(db, user, 'subscribed_tournaments');

  const unsub = onSnapshot(ref, async (snapshot) => {
    if (snapshot.empty) { onUpdate([]); return; }

    const refs = snapshot.docs.map(d => d.data().tournamentId).filter(Boolean);

    // Resolve each reference against the live source doc
    const resolved = await Promise.all(
      refs.map(async (tid) => {
        try {
          const sourceSnap = await getDoc(doc(db, 'shared_tournaments', tid));
          if (sourceSnap.exists()) {
            return {
              id: sourceSnap.id,
              ...sourceSnap.data(),
              isShared: true,
              isSubscribed: true,
              groups: Array.from(new Set([...(sourceSnap.data().groups || []), 'comunidad'])),
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    onUpdate(resolved.filter(Boolean));
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
        const snap = await getDoc(doc(db, 'shared_tournaments', id));
        counts[id] = snap.exists() ? (snap.data().subscriberCount || 0) : 0;
      } catch {
        counts[id] = 0;
      }
    })
  );
  return counts;
}
