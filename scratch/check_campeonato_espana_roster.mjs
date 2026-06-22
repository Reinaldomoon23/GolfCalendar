import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

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
const APPLY = process.argv.includes('--apply');
const TOURNAMENT_ID = 'tt_v2__2026-06-26__2026-06-28__rfeg__real-la-manga-club-la-se__campeonato-de-espana-infantil-alevin-y-ben__8ad47faf';
const TOURNAMENT = {
  id: TOURNAMENT_ID,
  dates: '26/06/2026 - 28/06/2026',
  name: 'Campeonato de España Infantil, Alevín y Benjamín 2026 "Memorial Juan Antonio Andreu"',
  course: 'La Manga Campo Sur',
  organizer: 'RFEG',
  type: 'national_championship',
  groups: ['valedero'],
  valedera: true,
};
const TARGETS = ['ona', 'txell'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function readUser(username) {
  const usernameSnap = await getDoc(doc(db, 'usernames', username));
  if (!usernameSnap.exists()) return { username, uid: null, profile: null };
  const uid = usernameSnap.data().uid || usernameSnap.data().userId || username;
  const profileSnap = await getDoc(doc(db, 'users', uid));
  return { username, uid, profile: profileSnap.exists() ? profileSnap.data() : null };
}

async function exists(path) {
  const snap = await getDoc(doc(db, ...path));
  return { exists: snap.exists(), data: snap.exists() ? snap.data() : null };
}

function participantPayload(user) {
  return {
    username: user.profile?.username || user.username,
    fullName: user.profile?.full_name || user.profile?.fullName || user.username,
    photo_url: user.profile?.photo_url || null,
    tournamentId: TOURNAMENT_ID,
    tournamentName: TOURNAMENT.name,
    tournamentCourse: TOURNAMENT.course,
    tournamentDates: TOURNAMENT.dates,
    hasScore: false,
    total: null,
    vspar: null,
    rounds: [],
    roundsPlayed: 0,
    status: 'pending',
    progressLabel: 'Pendiente',
    holesPlayed: 0,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function main() {
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);
  const participantsSnap = await getDocs(collection(db, 'tournaments', TOURNAMENT_ID, 'participants'));
  console.log('participants actual:', participantsSnap.docs.map(d => d.id).sort().join(', ') || '(ninguno)');

  for (const username of TARGETS) {
    const user = await readUser(username);
    console.log('\nuser', username, 'uid:', user.uid, 'name:', user.profile?.full_name || user.profile?.fullName || '(sin perfil)');
    if (!user.uid) continue;

    const subscribed = await exists(['users', user.uid, 'subscribed_tournaments', TOURNAMENT_ID]);
    const custom = await exists(['users', user.uid, 'custom_tournaments', TOURNAMENT_ID]);
    const participant = await exists(['tournaments', TOURNAMENT_ID, 'participants', username]);
    console.log('  subscribed:', subscribed.exists, subscribed.data?.course || '');
    console.log('  custom:', custom.exists, custom.data?.course || '');
    console.log('  participant:', participant.exists, participant.data?.fullName || participant.data?.full_name || '');

    if (APPLY) {
      if (!subscribed.exists) {
        await setDoc(doc(db, 'users', user.uid, 'subscribed_tournaments', TOURNAMENT_ID), {
          ...TOURNAMENT,
          subscribedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log('  [apply] subscribed_tournaments creado');
      }
      if (!participant.exists) {
        await setDoc(doc(db, 'tournaments', TOURNAMENT_ID, 'participants', username), participantPayload(user), { merge: true });
        console.log('  [apply] participant creado');
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
