import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc
} from 'firebase/firestore';
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
const db = getFirestore(app);

const credentialsPath = path.join(__dirname, '../MIGRATION_CREDENTIALS.json');
const credentials = fs.existsSync(credentialsPath)
  ? JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
  : [];

const usernameToUid = new Map(credentials.map((entry) => [entry.username, entry.uid]));
const uidToUsername = new Map(credentials.map((entry) => [entry.uid, entry.username]));

function looksLikeUid(value = '') {
  return typeof value === 'string' && value.length >= 20 && !value.includes('@');
}

function isMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return true;
  if (typeof value === 'object') return true;
  return true;
}

function mergeProfiles(base, incoming) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(incoming || {})) {
    if (!isMeaningfulValue(value) && isMeaningfulValue(merged[key])) {
      continue;
    }
    merged[key] = value;
  }

  return merged;
}

async function copySubcollection(sourceDocId, targetDocId, subcollectionName) {
  if (!sourceDocId || !targetDocId || sourceDocId === targetDocId) return 0;

  const snapshot = await getDocs(collection(db, 'users', sourceDocId, subcollectionName));
  let copied = 0;

  for (const documentSnapshot of snapshot.docs) {
    await setDoc(
      doc(db, 'users', targetDocId, subcollectionName, documentSnapshot.id),
      documentSnapshot.data(),
      { merge: true }
    );
    copied += 1;
  }

  return copied;
}

function inferUsername(docId, data) {
  if (data?.username) return data.username;
  if (uidToUsername.has(docId)) return uidToUsername.get(docId);
  if (!looksLikeUid(docId)) return docId;
  return '';
}

async function migrateOwnership() {
  console.log('Migrando ownership de usuarios a uid...');
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const groupedUsers = new Map();

  for (const documentSnapshot of usersSnapshot.docs) {
    const data = documentSnapshot.data();
    const username = inferUsername(documentSnapshot.id, data);

    if (!username) {
      console.log(`Skipping ${documentSnapshot.id}: username no resuelto`);
      continue;
    }

    if (!groupedUsers.has(username)) {
      groupedUsers.set(username, []);
    }
    groupedUsers.get(username).push(documentSnapshot);
  }

  const summary = [];

  for (const [username, docs] of groupedUsers.entries()) {
    const explicitUid = docs.find((candidate) => candidate.data()?.uid)?.data()?.uid;
    const uidDoc = docs.find((candidate) => looksLikeUid(candidate.id));
    const targetUid = explicitUid || uidDoc?.id || usernameToUid.get(username) || '';

    if (!targetUid) {
      console.log(`Skipping ${username}: no se encontro uid canonico`);
      summary.push({ username, status: 'skipped_no_uid' });
      continue;
    }

    const orderedDocs = [...docs].sort((left, right) => {
      if (left.id === targetUid) return 1;
      if (right.id === targetUid) return -1;
      return 0;
    });

    let mergedProfile = {};
    const sourceDocIds = [];

    for (const documentSnapshot of orderedDocs) {
      mergedProfile = mergeProfiles(mergedProfile, documentSnapshot.data());
      sourceDocIds.push(documentSnapshot.id);
    }

    const canonicalProfile = {
      ...mergedProfile,
      username,
      uid: targetUid,
      migrated_to_uid: true,
      legacy_doc_ids: sourceDocIds.filter((docId) => docId !== targetUid),
      migrated_to_uid_at: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', targetUid), canonicalProfile, { merge: true });
    await setDoc(doc(db, 'usernames', username), {
      uid: targetUid,
      username,
      updated_at: new Date().toISOString()
    }, { merge: true });

    let copiedResults = 0;
    let copiedCustom = 0;
    let copiedSettings = 0;

    for (const sourceDocId of sourceDocIds) {
      copiedResults += await copySubcollection(sourceDocId, targetUid, 'results');
      copiedCustom += await copySubcollection(sourceDocId, targetUid, 'custom_tournaments');
      copiedSettings += await copySubcollection(sourceDocId, targetUid, 'settings');

      if (sourceDocId !== targetUid) {
        await setDoc(doc(db, 'users', sourceDocId), {
          canonical_uid: targetUid,
          username,
          legacy_alias: true,
          migrated_to_uid_at: new Date().toISOString()
        }, { merge: true });
      }
    }

    console.log(`OK ${username} -> ${targetUid} | results:${copiedResults} custom:${copiedCustom} settings:${copiedSettings}`);
    summary.push({
      username,
      uid: targetUid,
      sourceDocIds,
      copiedResults,
      copiedCustom,
      copiedSettings,
      status: 'migrated'
    });
  }

  console.log('\nResumen:');
  summary.forEach((entry) => {
    console.log(JSON.stringify(entry));
  });
}

migrateOwnership().catch((error) => {
  console.error('Error migrando ownership a uid:', error);
  process.exit(1);
});
