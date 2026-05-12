import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0',
  authDomain: 'golfscorings-e4338.firebaseapp.com',
  projectId: 'golfscorings-e4338',
  storageBucket: 'golfscorings-e4338.firebasestorage.app',
  messagingSenderId: '987034024177',
  appId: '1:987034024177:web:560e69822800f3a613d150',
};

const ADMIN_EMAIL = process.env.FIREBASE_ADMIN_EMAIL || 'jordi@golfteam.app';
const ADMIN_PASS = process.env.FIREBASE_ADMIN_PASSWORD;
const TARGET_ID = 'tt_v2__2026-05-16__2026-05-17__fcg__club-de-golf-costa-brava__campionat-de-catalunya-infantil__e2f0316c';
const TARGET_PLAYERS = ['mariaros', 'nicole', 'ona', 'txell'];
const TOURNAMENT = {
  id: TARGET_ID,
  tournamentId: TARGET_ID,
  name: 'Campionat de Catalunya Infantil',
  dates: '16/05/2026 - 17/05/2026',
  course: 'Club de Golf Costa Brava (Recorrido Verde)',
  type: 'regional_championship',
  groups: ['valedero'],
  valedera: true,
  source: 'official',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

function summarizeResultScore(resultData) {
  const validRounds = (resultData?.rounds || [])
    .filter((roundScore) => roundScore !== '' && roundScore != null && !Number.isNaN(Number(roundScore)))
    .map(Number);

  const total = validRounds.reduce((sum, score) => sum + score, 0);
  const roundsPlayed = validRounds.length;
  const par = Number(resultData?.tournamentPar) || 72;

  return {
    total: total > 0 ? total : null,
    roundsPlayed,
    rounds: validRounds,
    par,
    vspar: total > 0 ? total - (par * roundsPlayed) : null,
    hasScore: total > 0,
  };
}

async function upsertPlayerTournament(user) {
  const resultSnap = await getDoc(doc(db, 'users', user.docId, 'results', TARGET_ID));
  const resultData = resultSnap.exists() ? resultSnap.data() : null;
  const scoreSummary = summarizeResultScore(resultData);

  await setDoc(doc(db, 'users', user.docId, 'subscribed_tournaments', TARGET_ID), {
    ...TOURNAMENT,
    joinedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(db, 'tournaments', TARGET_ID, 'participants', user.username), {
    username: user.username,
    fullName: user.full_name || user.fullName || user.username,
    tournamentName: TOURNAMENT.name,
    tournamentCourse: TOURNAMENT.course,
    tournamentDates: TOURNAMENT.dates,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...scoreSummary,
  }, { merge: true });

  return {
    username: user.username,
    docId: user.docId,
    subscribed: true,
    participant: true,
    hadPrivateResult: Boolean(resultData),
    hasPublicScore: scoreSummary.hasScore,
  };
}

if (!ADMIN_PASS) {
  throw new Error('Missing FIREBASE_ADMIN_PASSWORD');
}

await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);

await setDoc(doc(db, 'tournaments', TARGET_ID), {
  ...TOURNAMENT,
  updatedAt: serverTimestamp(),
}, { merge: true });

const report = [];
for (const username of TARGET_PLAYERS) {
  const user = await findUserByUsername(username);
  if (!user) {
    report.push({ username, error: 'user-not-found' });
    continue;
  }

  report.push(await upsertPlayerTournament(user));
}

const participantsSnap = await getDocs(collection(db, 'tournaments', TARGET_ID, 'participants'));
console.log(JSON.stringify({
  targetId: TARGET_ID,
  report,
  participants: participantsSnap.docs.map((participantDoc) => ({
    id: participantDoc.id,
    ...participantDoc.data(),
  })),
}, null, 2));

process.exit(0);
