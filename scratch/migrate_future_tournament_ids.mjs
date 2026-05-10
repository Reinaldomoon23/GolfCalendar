import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import {
  TOURNAMENT_ID_MIGRATION_MAP,
  resolveCanonicalTournamentId,
} from '../src/utils/tournamentIds.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0',
  authDomain: 'golfscorings-e4338.firebaseapp.com',
  projectId: 'golfscorings-e4338',
  storageBucket: 'golfscorings-e4338.firebasestorage.app',
  messagingSenderId: '987034024177',
  appId: '1:987034024177:web:560e69822800f3a613d150',
};

const ADMIN_EMAIL = 'jordi@golfteam.app';
const ADMIN_PASS = 'Garcia';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function groupMappings() {
  const grouped = new Map();

  for (const [legacyId, canonicalId] of Object.entries(TOURNAMENT_ID_MIGRATION_MAP)) {
    if (!grouped.has(canonicalId)) grouped.set(canonicalId, new Set());
    grouped.get(canonicalId).add(String(legacyId));
  }

  return Array.from(grouped.entries()).map(([canonicalId, legacyIdsSet]) => ({
    canonicalId,
    legacyIds: Array.from(legacyIdsSet),
  }));
}

function mergeArrayUnique(...values) {
  return Array.from(new Set(values.flat().filter(Boolean).map(String)));
}

async function getExistingDocs(collectionName, legacyIds) {
  const docs = [];

  for (const legacyId of legacyIds) {
    const snap = await getDoc(doc(db, collectionName, legacyId));
    if (snap.exists()) {
      docs.push({ id: legacyId, data: snap.data() });
    }
  }

  return docs;
}

function buildMergedTournamentData(canonicalId, existingDocs) {
  if (!existingDocs.length) return null;

  const merged = existingDocs.reduce((acc, entry) => ({ ...acc, ...entry.data }), {});
  return {
    ...merged,
    id: canonicalId,
    legacyIds: mergeArrayUnique(
      merged.legacyIds || [],
      existingDocs.map((entry) => entry.id)
    ),
    migratedAt: new Date().toISOString(),
  };
}

async function migrateCollectionDoc(collectionName, mapping) {
  let existingDocs = [];
  try {
    existingDocs = await getExistingDocs(collectionName, mapping.legacyIds);
  } catch (error) {
    if (collectionName === 'shared_tournaments' && error?.code === 'permission-denied') {
      return { copied: false, deleted: 0, skipped: true };
    }
    throw error;
  }
  if (!existingDocs.length) {
    return { copied: false, deleted: 0 };
  }

  const mergedData = buildMergedTournamentData(mapping.canonicalId, existingDocs);
  await setDoc(doc(db, collectionName, mapping.canonicalId), mergedData, { merge: true });

  let deleted = 0;
  for (const existing of existingDocs) {
    if (existing.id === mapping.canonicalId) continue;
    await deleteDoc(doc(db, collectionName, existing.id));
    deleted += 1;
  }

  return { copied: true, deleted };
}

async function migrateParticipants(mapping) {
  const participantDocs = new Map();

  for (const legacyId of mapping.legacyIds) {
    const participantsSnap = await getDocs(collection(db, 'tournaments', legacyId, 'participants'));
    for (const participantDoc of participantsSnap.docs) {
      participantDocs.set(participantDoc.id, participantDoc.data());
    }
  }

  for (const [participantId, data] of participantDocs.entries()) {
    await setDoc(
      doc(db, 'tournaments', mapping.canonicalId, 'participants', participantId),
      data,
      { merge: true }
    );
  }

  let deleted = 0;
  for (const legacyId of mapping.legacyIds) {
    if (legacyId === mapping.canonicalId) continue;
    const participantsSnap = await getDocs(collection(db, 'tournaments', legacyId, 'participants'));
    for (const participantDoc of participantsSnap.docs) {
      await deleteDoc(doc(db, 'tournaments', legacyId, 'participants', participantDoc.id));
      deleted += 1;
    }
  }

  return { copied: participantDocs.size, deleted };
}

async function migrateUserSubcollection(userId, subcollectionName, mapping, transformData) {
  const collected = new Map();

  for (const legacyId of mapping.legacyIds) {
    const ref = doc(db, 'users', userId, subcollectionName, legacyId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      collected.set(legacyId, snap.data());
    }
  }

  if (!collected.size) {
    return { copied: false, deleted: 0 };
  }

  const merged = Array.from(collected.entries()).reduce(
    (acc, [legacyId, data]) => ({ ...acc, ...transformData(data, legacyId, mapping) }),
    {}
  );

  await setDoc(
    doc(db, 'users', userId, subcollectionName, mapping.canonicalId),
    merged,
    { merge: true }
  );

  let deleted = 0;
  for (const legacyId of collected.keys()) {
    if (legacyId === mapping.canonicalId) continue;
    await deleteDoc(doc(db, 'users', userId, subcollectionName, legacyId));
    deleted += 1;
  }

  return { copied: true, deleted };
}

async function migrateUserPreferences(userId) {
  const prefRef = doc(db, 'users', userId, 'settings', 'preferences');
  const prefSnap = await getDoc(prefRef);
  if (!prefSnap.exists()) return false;

  const data = prefSnap.data();
  const oldHiddenIds = Array.isArray(data.hiddenIds) ? data.hiddenIds.map(String) : [];
  const newHiddenIds = mergeArrayUnique(oldHiddenIds.map((id) => resolveCanonicalTournamentId(id)));

  if (JSON.stringify(oldHiddenIds) === JSON.stringify(newHiddenIds)) {
    return false;
  }

  await setDoc(prefRef, { ...data, hiddenIds: newHiddenIds }, { merge: true });
  return true;
}

async function migrateUsers(mappings) {
  const usersSnap = await getDocs(collection(db, 'users'));
  const summary = {
    results: 0,
    custom_tournaments: 0,
    subscribed_tournaments: 0,
    preferences: 0,
  };

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;

    for (const mapping of mappings) {
      const resultMigration = await migrateUserSubcollection(
        userId,
        'results',
        mapping,
        (data, legacyId) => ({
          ...data,
          legacyTournamentIds: mergeArrayUnique(data.legacyTournamentIds || [], [legacyId]),
        })
      );
      if (resultMigration.copied) summary.results += 1;

      const customMigration = await migrateUserSubcollection(
        userId,
        'custom_tournaments',
        mapping,
        (data, legacyId) => ({
          ...data,
          id: mapping.canonicalId,
          legacyIds: mergeArrayUnique(data.legacyIds || [], [legacyId]),
        })
      );
      if (customMigration.copied) summary.custom_tournaments += 1;

      const subscribedMigration = await migrateUserSubcollection(
        userId,
        'subscribed_tournaments',
        mapping,
        (data, legacyId) => ({
          ...data,
          tournamentId: mapping.canonicalId,
          legacyIds: mergeArrayUnique(data.legacyIds || [], [legacyId]),
        })
      );
      if (subscribedMigration.copied) summary.subscribed_tournaments += 1;
    }

    const preferencesUpdated = await migrateUserPreferences(userId);
    if (preferencesUpdated) summary.preferences += 1;
  }

  return summary;
}

async function main() {
  console.log('Signing in as admin...');
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);
  console.log('Signed in:', auth.currentUser?.email);

  const mappings = groupMappings();
  const summary = {
    tournaments: { copied: 0, deleted: 0 },
    shared_tournaments: { copied: 0, deleted: 0, skipped: 0 },
    participants: { copied: 0, deleted: 0 },
    users: null,
  };

  for (const mapping of mappings) {
    const tournamentsMigration = await migrateCollectionDoc('tournaments', mapping);
    if (tournamentsMigration.copied) summary.tournaments.copied += 1;
    summary.tournaments.deleted += tournamentsMigration.deleted;

    const sharedMigration = await migrateCollectionDoc('shared_tournaments', mapping);
    if (sharedMigration.copied) summary.shared_tournaments.copied += 1;
    summary.shared_tournaments.deleted += sharedMigration.deleted;
    if (sharedMigration.skipped) summary.shared_tournaments.skipped += 1;

    const participantsMigration = await migrateParticipants(mapping);
    summary.participants.copied += participantsMigration.copied;
    summary.participants.deleted += participantsMigration.deleted;
  }

  summary.users = await migrateUsers(mappings);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
