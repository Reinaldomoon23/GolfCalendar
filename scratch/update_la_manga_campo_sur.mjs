import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  updateDoc,
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
const ADMIN_PASS = process.env.FIREBASE_ADMIN_PASSWORD || 'Garcia';
const APPLY = process.argv.includes('--apply');

const TOURNAMENT_ID = 'tt_v2__2026-06-26__2026-06-28__rfeg__real-la-manga-club-la-se__campeonato-de-espana-infantil-alevin-y-ben__8ad47faf';
const NEW_COURSE = 'La Manga Campo Sur';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function updateIfExists(pathSegments, payload) {
  const ref = doc(db, ...pathSegments);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;

  const current = snap.data();
  const currentCourse = current.course || current.tournamentCourse || null;
  const label = pathSegments.join('/');
  console.log(`${APPLY ? '[apply]' : '[dry-run]'} ${label}: ${currentCourse || '(sin campo)'} -> ${NEW_COURSE}`);

  if (APPLY) {
    await updateDoc(ref, payload);
  }
  return true;
}

async function main() {
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);

  let touched = 0;
  if (await updateIfExists(['tournaments', TOURNAMENT_ID], { course: NEW_COURSE })) touched += 1;
  if (await updateIfExists(['shared_tournaments', TOURNAMENT_ID], { course: NEW_COURSE })) touched += 1;

  const usersSnap = await getDocs(collection(db, 'users'));
  for (const userDoc of usersSnap.docs) {
    const userPath = ['users', userDoc.id];
    if (await updateIfExists([...userPath, 'custom_tournaments', TOURNAMENT_ID], { course: NEW_COURSE })) touched += 1;
    if (await updateIfExists([...userPath, 'subscribed_tournaments', TOURNAMENT_ID], { course: NEW_COURSE })) touched += 1;
    if (await updateIfExists([...userPath, 'results', TOURNAMENT_ID], { tournamentCourse: NEW_COURSE })) touched += 1;
  }

  console.log(`${APPLY ? 'Updated' : 'Would update'} ${touched} existing documents.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
