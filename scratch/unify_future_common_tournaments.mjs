import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  generateTournamentDeterministicId,
  getTournamentIdCandidates,
  parseTournamentDateRange,
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

const ADMIN_EMAIL = process.env.FIREBASE_ADMIN_EMAIL || 'jordi@golfteam.app';
const ADMIN_PASS = process.env.FIREBASE_ADMIN_PASSWORD || 'Garcia';
const TARGET_PLAYERS = ['mariaros', 'nicole', 'ona', 'txell'];
const APPLY = process.argv.includes('--apply');
const WRITE_SHARED = !process.argv.includes('--skip-shared');
const TODAY_ISO = '2026-05-14';
const EXCLUDED_SIGNATURES = new Set([
  'campionat de catalunya infantil|2026-05-16|2026-05-17',
]);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function writeStep(label, action) {
  try {
    if (APPLY) console.log(`[apply] ${label}`);
    return await action();
  } catch (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extractTournamentDates(tournament) {
  return tournament?.dates || tournament?.tournamentDates || '';
}

function extractTournamentName(tournament) {
  return tournament?.name || tournament?.tournamentName || '';
}

function extractTournamentCourse(tournament) {
  return tournament?.course || tournament?.tournamentCourse || '';
}

function getStartEndIso(tournament) {
  return parseTournamentDateRange(extractTournamentDates(tournament));
}

function isFutureTournament(tournament) {
  const { startIso, endIso } = getStartEndIso(tournament);
  return Boolean((endIso || startIso) && (endIso || startIso) > TODAY_ISO);
}

function isExcludedTournament(tournament) {
  const { startIso, endIso } = getStartEndIso(tournament);
  const signature = [
    normalizeText(extractTournamentName(tournament)),
    startIso || '',
    endIso || startIso || '',
  ].join('|');
  return EXCLUDED_SIGNATURES.has(signature);
}

function getTournamentSignature(tournament) {
  const { startIso, endIso } = getStartEndIso(tournament);
  return [
    normalizeText(extractTournamentName(tournament)),
    startIso || '',
    endIso || startIso || '',
    normalizeText(extractTournamentCourse(tournament)),
  ].join('|');
}

function getCanonicalTournamentId(tournament) {
  return resolveCanonicalTournamentId(
    tournament?.tournamentId ||
    tournament?.id ||
    generateTournamentDeterministicId({
      name: extractTournamentName(tournament),
      dates: extractTournamentDates(tournament),
      course: extractTournamentCourse(tournament),
      organizer: tournament?.organizer || tournament?.source || tournament?.type || 'club',
      type: tournament?.type || 'shared',
    })
  );
}

function buildSharedTournamentData(canonicalId, entries) {
  const sourceEntry = entries.find((entry) => entry.kind === 'subscribed')
    || entries.find((entry) => String(entry.id).startsWith('tt_v2__'))
    || entries[0];
  const source = sourceEntry.data;

  return {
    ...source,
    id: canonicalId,
    tournamentId: canonicalId,
    name: extractTournamentName(source),
    dates: extractTournamentDates(source),
    course: extractTournamentCourse(source),
    type: source.type || 'shared',
    groups: Array.from(new Set([...(source.groups || []), 'comunidad'])),
    isShared: true,
    source: source.source || 'shared',
    unifiedFrom: Array.from(new Set(entries.map((entry) => String(entry.id)))),
    unifiedPlayers: Array.from(new Set(entries.map((entry) => entry.username))),
    updatedAt: serverTimestamp(),
  };
}

function buildSubscriptionData(canonicalId, sharedData) {
  return {
    tournamentId: canonicalId,
    joinedAt: serverTimestamp(),
    source: sharedData.source || 'shared',
    name: sharedData.name,
    dates: sharedData.dates,
    course: sharedData.course,
    type: sharedData.type || 'shared',
    groups: sharedData.groups || ['comunidad'],
    valedera: Boolean(sharedData.valedera),
  };
}

function summarizeResultScore(resultData) {
  const rounds = [];
  let total = 0;
  let totalPar = 0;

  if (resultData?.scorecards) {
    Object.keys(resultData.scorecards)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((roundKey) => {
        const card = resultData.scorecards[roundKey];
        let roundScore = 0;
        let roundPar = 0;

        for (let i = 0; i < 18; i += 1) {
          const stroke = Number(card?.strokes?.[i]);
          if (!Number.isFinite(stroke) || stroke <= 0) continue;
          const holePar = Number(card?.pars?.[i]);
          roundScore += stroke;
          roundPar += Number.isFinite(holePar) && holePar > 0 ? holePar : 4;
        }

        if (roundScore > 0) {
          rounds.push(roundScore);
          total += roundScore;
          totalPar += roundPar;
        }
      });
  }

  if (rounds.length === 0 && Array.isArray(resultData?.rounds)) {
    resultData.rounds.forEach((roundScore) => {
      const score = Number(roundScore);
      if (!Number.isFinite(score) || score <= 0) return;
      rounds.push(score);
      total += score;
    });
    const par = Number(resultData?.tournamentPar || resultData?.par || 72);
    totalPar = par * rounds.length;
  }

  return {
    total: total > 0 ? total : null,
    roundsPlayed: rounds.length,
    rounds,
    vspar: total > 0 ? total - totalPar : null,
    hasScore: total > 0,
  };
}

async function findUserByUsername(username) {
  const normalizedUsername = String(username).toLowerCase();

  const usernameSnap = await getDoc(doc(db, 'usernames', normalizedUsername));
  if (usernameSnap.exists() && usernameSnap.data()?.uid) {
    const mappedSnap = await getDoc(doc(db, 'users', usernameSnap.data().uid));
    if (mappedSnap.exists()) {
      return { docId: mappedSnap.id, username: normalizedUsername, ...mappedSnap.data() };
    }
  }

  const directSnap = await getDoc(doc(db, 'users', normalizedUsername));
  if (directSnap.exists()) {
    return { docId: directSnap.id, username: normalizedUsername, ...directSnap.data() };
  }

  const fallbackSnap = await getDocs(query(
    collection(db, 'users'),
    where('username', '==', normalizedUsername)
  ));

  if (!fallbackSnap.empty) {
    const match = fallbackSnap.docs[0];
    return { docId: match.id, username: normalizedUsername, ...match.data() };
  }

  return null;
}

async function readTournamentSubcollection(user, subcollectionName) {
  const snap = await getDocs(collection(db, 'users', user.docId, subcollectionName));
  return snap.docs
    .map((entryDoc) => {
      const data = entryDoc.data();
      return {
        username: user.username,
        docId: user.docId,
        kind: subcollectionName === 'custom_tournaments' ? 'custom' : 'subscribed',
        id: String(entryDoc.id),
        canonicalId: getCanonicalTournamentId({ ...data, id: entryDoc.id }),
        data: { ...data, id: data.id || entryDoc.id },
      };
    })
    .filter((entry) => isFutureTournament(entry.data))
    .filter((entry) => !isExcludedTournament(entry.data));
}

async function readResults(user) {
  const snap = await getDocs(collection(db, 'users', user.docId, 'results'));
  return new Map(snap.docs.map((resultDoc) => [String(resultDoc.id), resultDoc.data()]));
}

async function findResultForTournament(resultsById, tournament) {
  const candidates = getTournamentIdCandidates({
    id: tournament.id || tournament.tournamentId,
    name: extractTournamentName(tournament),
    dates: extractTournamentDates(tournament),
    course: extractTournamentCourse(tournament),
    type: tournament.type,
  });

  for (const candidateId of candidates) {
    const result = resultsById.get(String(candidateId));
    if (result) return { id: String(candidateId), data: result };
  }

  return null;
}

async function applyGroup(canonicalId, entries, usersByUsername, resultsByUsername) {
  const sharedData = buildSharedTournamentData(canonicalId, entries);
  if (WRITE_SHARED) {
    await writeStep(`set shared_tournaments/${canonicalId}`, () => (
      setDoc(doc(db, 'shared_tournaments', canonicalId), sharedData, { merge: true })
    ));
  }

  const targetUsernames = Array.from(new Set(entries.map((entry) => entry.username)));

  for (const username of targetUsernames) {
    const user = usersByUsername.get(username);
    if (!user) continue;

    await writeStep(`set users/${user.docId}/subscribed_tournaments/${canonicalId}`, () => (
      setDoc(
        doc(db, 'users', user.docId, 'subscribed_tournaments', canonicalId),
        buildSubscriptionData(canonicalId, sharedData),
        { merge: true }
      )
    ));

    const userEntries = entries.filter((entry) => entry.username === username);
    for (const entry of userEntries) {
      if (entry.kind === 'custom') {
        await writeStep(`delete users/${user.docId}/custom_tournaments/${entry.id}`, () => (
          deleteDoc(doc(db, 'users', user.docId, 'custom_tournaments', entry.id))
        ));
      }
    }

    const resultMatch = await findResultForTournament(resultsByUsername.get(username) || new Map(), {
      ...sharedData,
      id: canonicalId,
    });
    const scoreSummary = summarizeResultScore(resultMatch?.data);

    await writeStep(`set tournaments/${canonicalId}/participants/${username}`, () => (
      setDoc(doc(db, 'tournaments', canonicalId, 'participants', username), {
        username,
        fullName: user.full_name || user.fullName || username,
        photo_url: user.photo_url || null,
        tournamentName: sharedData.name,
        tournamentCourse: sharedData.course,
        tournamentDates: sharedData.dates,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...scoreSummary,
      }, { merge: true })
    ));
  }
}

async function main() {
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);

  const users = [];
  for (const username of TARGET_PLAYERS) {
    const user = await findUserByUsername(username);
    if (!user) throw new Error(`User not found: ${username}`);
    users.push(user);
  }

  const usersByUsername = new Map(users.map((user) => [user.username, user]));
  const resultsByUsername = new Map();
  const allEntries = [];

  for (const user of users) {
    const [customEntries, subscribedEntries, results] = await Promise.all([
      readTournamentSubcollection(user, 'custom_tournaments'),
      readTournamentSubcollection(user, 'subscribed_tournaments'),
      readResults(user),
    ]);

    resultsByUsername.set(user.username, results);
    allEntries.push(...customEntries, ...subscribedEntries);
  }

  const groups = new Map();
  for (const entry of allEntries) {
    const signature = getTournamentSignature(entry.data);
    if (!signature.includes('|2026-')) continue;
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(entry);
  }

  const commonGroups = Array.from(groups.entries())
    .map(([signature, entries]) => ({
      signature,
      entries,
      players: Array.from(new Set(entries.map((entry) => entry.username))).sort(),
      customEntries: entries.filter((entry) => entry.kind === 'custom'),
      subscribedEntries: entries.filter((entry) => entry.kind === 'subscribed'),
    }))
    .filter((group) => group.players.length >= 2)
    .sort((a, b) => {
      const [, startA] = a.signature.split('|');
      const [, startB] = b.signature.split('|');
      return startA.localeCompare(startB) || a.signature.localeCompare(b.signature);
    });

  const operations = [];
  for (const group of commonGroups) {
    const canonicalId = resolveCanonicalTournamentId(
      group.subscribedEntries.find((entry) => String(entry.canonicalId).startsWith('tt_v2__'))?.canonicalId ||
      group.entries.find((entry) => String(entry.canonicalId).startsWith('tt_v2__'))?.canonicalId ||
      generateTournamentDeterministicId(group.entries[0].data)
    );

    operations.push({
      canonicalId,
      name: extractTournamentName(group.entries[0].data),
      dates: extractTournamentDates(group.entries[0].data),
      course: extractTournamentCourse(group.entries[0].data),
      players: group.players,
      existingIds: Array.from(new Set(group.entries.map((entry) => `${entry.username}:${entry.kind}:${entry.id}`))).sort(),
      customDocsToDelete: group.customEntries
        .map((entry) => `${entry.username}:${entry.id}`)
        .sort(),
      subscriptionsToUpsert: group.players.map((username) => `${username}:${canonicalId}`),
      participantsToUpsert: group.players.map((username) => `${username}:${canonicalId}`),
      sharedTournamentWrite: WRITE_SHARED ? 'enabled' : 'skipped-by-flag',
    });

    if (APPLY) {
      await applyGroup(canonicalId, group.entries, usersByUsername, resultsByUsername);
    }
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    writeShared: WRITE_SHARED,
    todayIso: TODAY_ISO,
    excluded: Array.from(EXCLUDED_SIGNATURES),
    players: users.map((user) => ({ username: user.username, docId: user.docId })),
    commonGroupCount: commonGroups.length,
    operations,
  }, null, 2));

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
