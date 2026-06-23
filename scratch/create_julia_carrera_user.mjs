import { initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
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
  username: 'juliacarrera',
  firstName: 'Julia',
  lastName1: 'Carrera',
  lastName2: 'Costa',
  federationId: 'CB19299471',
  password: process.env.NEW_USER_PASSWORD,
};

USER.fullName = `${USER.firstName} ${USER.lastName1} ${USER.lastName2}`;
USER.email = `${USER.username}@golfteam.app`;

function normalizeSearchText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const adminApp = initializeApp(firebaseConfig, 'admin-check');
const adminAuth = getAuth(adminApp);
const db = getFirestore(adminApp);

async function assertAvailable() {
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

async function main() {
  await signInWithEmailAndPassword(adminAuth, ADMIN_EMAIL, ADMIN_PASS);
  await assertAvailable();

  if (!APPLY) {
    console.log('[dry-run] username disponible:', USER.username);
    console.log('[dry-run] se crearia Auth user:', USER.email);
    console.log('[dry-run] perfil:', {
      fullName: USER.fullName,
      federationId: USER.federationId,
      passwordConfigured: Boolean(USER.password),
    });
    return;
  }

  if (!USER.password) {
    throw new Error('Falta NEW_USER_PASSWORD para crear el usuario.');
  }

  const { uid, cleanup } = await createAuthUser();
  try {
    const payload = {
      username: USER.username,
      uid,
      email: USER.email,
      first_name: USER.firstName,
      last_name_1: USER.lastName1,
      last_name_2: USER.lastName2,
      full_name: USER.fullName,
      federation_id: USER.federationId,
      role: 'player',
      managed_users: [],
      photo_url: '',
      handicap_url: '',
      profile_completed: true,
      profile_completed_at: new Date().toISOString(),
      search_text: normalizeSearchText(`${USER.fullName} ${USER.username} ${USER.federationId}`),
      created_at: new Date().toISOString(),
      created_by_admin: true,
      updated_at: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', uid), payload);
    await setDoc(doc(db, 'usernames', USER.username), {
      uid,
      username: USER.username,
      updated_at: serverTimestamp(),
    });

    console.log('created', {
      uid,
      username: USER.username,
      email: USER.email,
      fullName: USER.fullName,
      federationId: USER.federationId,
    });
  } finally {
    await cleanup().catch(() => {});
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await deleteApp(adminApp).catch(() => {});
  });
