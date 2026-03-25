import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
  apiKey: 'AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0',
  authDomain: 'golfscorings-e4338.firebaseapp.com',
  projectId: 'golfscorings-e4338',
  storageBucket: 'golfscorings-e4338.firebasestorage.app',
  messagingSenderId: '987034024177',
  appId: '1:987034024177:web:560e69822800f3a613d150'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersPath = path.join(__dirname, '../public/api/users.json');
const credentialsPath = path.join(__dirname, '../MIGRATION_CREDENTIALS.json');

const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
const txell = usersData.txell;

if (!txell) {
  console.error('No se encontro el usuario txell en users.json');
  process.exit(1);
}

const username = 'txell';
const email = 'txell@golfteam.app';
const password = 'alosalos';

async function upsertCredentialsFile(uid) {
  let credentials = [];

  if (fs.existsSync(credentialsPath)) {
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  }

  const nextCredentials = credentials.filter((entry) => entry.username !== username);
  nextCredentials.push({ username, email, password, uid });
  fs.writeFileSync(credentialsPath, JSON.stringify(nextCredentials, null, 2));
}

async function persistProfile(user) {
  await updateProfile(user, {
    displayName: txell.full_name
  });

  await setDoc(doc(db, 'users', username), {
    uid: user.uid,
    username,
    email,
    full_name: txell.full_name,
    federation_id: txell.federation_id || '',
    photo_url: txell.photo_url || '',
    handicap_url: txell.handicap_url || '',
    role: txell.role || 'user',
    managed_users: txell.managed_users || [],
    migrated_from_php: true,
    created_at: new Date()
  }, { merge: true });

  await upsertCredentialsFile(user.uid);
}

async function migrateTxell() {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await persistProfile(credential.user);
    console.log(`Txell migrada correctamente. UID: ${credential.user.uid}`);
    process.exit(0);
  } catch (error) {
    if (error.code !== 'auth/email-already-in-use') {
      console.error('Error creando a txell:', error.code || error.message);
      process.exit(1);
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await persistProfile(credential.user);
      console.log(`Txell ya existia en Auth. Perfil sincronizado. UID: ${credential.user.uid}`);
      process.exit(0);
    } catch (signInError) {
      console.error('Txell ya existe pero no pude iniciar sesion con la nueva contraseña:', signInError.code || signInError.message);
      process.exit(1);
    }
  }
}

migrateTxell();
