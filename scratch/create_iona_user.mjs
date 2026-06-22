import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, inMemoryPersistence, setPersistence, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

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

const USER = {
  username: 'iona',
  fullName: 'Ion Lage',
  email: 'iona@golfteam.app',
  password: 'Lage00',
};

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

const adminApp = initializeApp(firebaseConfig, 'admin-check');
const adminAuth = getAuth(adminApp);
const db = getFirestore(adminApp);

async function assertUsernameAvailable() {
  const usernameSnap = await getDoc(doc(db, 'usernames', USER.username));
  if (usernameSnap.exists()) {
    throw new Error(`El username ${USER.username} ya existe: ${JSON.stringify(usernameSnap.data())}`);
  }
}

async function createAuthUser() {
  const secondaryApp = initializeApp(firebaseConfig, `create-${USER.username}-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  await setPersistence(secondaryAuth, inMemoryPersistence);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, USER.email, USER.password);
    await updateProfile(credential.user, { displayName: USER.fullName });
    return { uid: credential.user.uid, cleanup: () => deleteApp(secondaryApp) };
  } catch (error) {
    await deleteApp(secondaryApp).catch(() => {});
    throw error;
  }
}

function participantPayload(uid) {
  return {
    username: USER.username,
    fullName: USER.fullName,
    photo_url: null,
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
    uid,
  };
}

async function main() {
  await signInWithEmailAndPassword(adminAuth, ADMIN_EMAIL, ADMIN_PASS);
  await assertUsernameAvailable();

  if (!APPLY) {
    console.log('[dry-run] username disponible:', USER.username);
    console.log('[dry-run] se crearia Auth user:', USER.email);
    console.log('[dry-run] se crearia perfil y alta campeonato:', TOURNAMENT_ID);
    return;
  }

  const { uid, cleanup } = await createAuthUser();
  try {
    await setDoc(doc(db, 'users', uid), {
      username: USER.username,
      uid,
      email: USER.email,
      full_name: USER.fullName,
      federation_id: null,
      role: 'player',
      managed_users: [],
      photo_url: '',
      handicap_url: '',
      created_at: new Date().toISOString(),
      created_by_admin: true,
      updated_at: new Date().toISOString(),
    });

    await setDoc(doc(db, 'usernames', USER.username), {
      uid,
      username: USER.username,
      updated_at: serverTimestamp(),
    });

    await setDoc(doc(db, 'users', uid, 'subscribed_tournaments', TOURNAMENT_ID), {
      ...TOURNAMENT,
      subscribedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await setDoc(doc(db, 'tournaments', TOURNAMENT_ID, 'participants', USER.username), participantPayload(uid), { merge: true });

    console.log('created', { uid, username: USER.username, email: USER.email, fullName: USER.fullName });
  } finally {
    await cleanup().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
