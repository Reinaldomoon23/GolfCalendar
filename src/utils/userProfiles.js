import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

export function inferUsernameFromEmail(email = '') {
  const [username] = String(email).toLowerCase().split('@');
  return username || '';
}

function normalizeProfile(rawProfile, fallbackUsername = '', docId = '') {
  const username = rawProfile?.username || fallbackUsername || docId || '';
  if (!username) return null;

  return {
    ...rawProfile,
    username,
  };
}

export async function fetchUserProfileByUsername(db, username) {
  if (!username) return null;

  const normalizedUsername = String(username).toLowerCase();
  const directRef = doc(db, 'users', normalizedUsername);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return normalizeProfile(directSnap.data(), normalizedUsername, directSnap.id);
  }

  const fallbackQuery = query(
    collection(db, 'users'),
    where('username', '==', normalizedUsername)
  );
  const fallbackSnap = await getDocs(fallbackQuery);

  if (fallbackSnap.empty) return null;

  const match = fallbackSnap.docs[0];
  return normalizeProfile(match.data(), normalizedUsername, match.id);
}

export async function fetchUserProfileByUid(db, uid, email = '') {
  if (!uid) return null;

  const byUid = query(collection(db, 'users'), where('uid', '==', uid));
  const uidSnap = await getDocs(byUid);

  if (!uidSnap.empty) {
    const match = uidSnap.docs[0];
    const fallbackUsername = inferUsernameFromEmail(email);
    return normalizeProfile(match.data(), fallbackUsername, match.id);
  }

  const inferredUsername = inferUsernameFromEmail(email);
  if (!inferredUsername) return null;

  return fetchUserProfileByUsername(db, inferredUsername);
}

export async function ensureUsernameProfileDocument(db, profile, fallbackUsername = '') {
  const normalized = normalizeProfile(profile, fallbackUsername);
  if (!normalized?.username) return null;

  const { id, manager_id, ...payload } = normalized;
  await setDoc(doc(db, 'users', normalized.username), payload, { merge: true });

  return {
    ...payload,
    username: normalized.username,
  };
}
