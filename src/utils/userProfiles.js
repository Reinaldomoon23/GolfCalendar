import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

export function inferUsernameFromEmail(email = '') {
  const [username] = String(email).toLowerCase().split('@');
  return username || '';
}

function normalizeProfile(rawProfile, fallbackUsername = '', docId = '') {
  const username = rawProfile?.username || fallbackUsername || docId || '';
  if (!username) return null;

  const uid = rawProfile?.uid || '';
  const resolvedDocId = uid || docId || username;

  return {
    ...rawProfile,
    username,
    uid,
    docId: resolvedDocId,
  };
}

export async function fetchUserProfileByUsername(db, username) {
  if (!username) return null;

  const normalizedUsername = String(username).toLowerCase();
  const usernameRef = doc(db, 'usernames', normalizedUsername);
  const usernameSnap = await getDoc(usernameRef);

  if (usernameSnap.exists()) {
    const mappedUid = usernameSnap.data()?.uid;
    if (mappedUid) {
      const mappedProfileSnap = await getDoc(doc(db, 'users', mappedUid));
      if (mappedProfileSnap.exists()) {
        return normalizeProfile(mappedProfileSnap.data(), normalizedUsername, mappedProfileSnap.id);
      }
    }
  }

  const directRef = doc(db, 'users', normalizedUsername);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    const directProfile = directSnap.data();

    if (directProfile?.uid && directProfile.uid !== normalizedUsername) {
      const canonicalSnap = await getDoc(doc(db, 'users', directProfile.uid));
      if (canonicalSnap.exists()) {
        return normalizeProfile(canonicalSnap.data(), normalizedUsername, canonicalSnap.id);
      }
    }

    return normalizeProfile(directProfile, normalizedUsername, directSnap.id);
  }

  const fallbackQuery = query(
    collection(db, 'users'),
    where('username', '==', normalizedUsername)
  );
  const fallbackSnap = await getDocs(fallbackQuery);

  if (fallbackSnap.empty) return null;

  const match = fallbackSnap.docs.find((candidate) => candidate.id === candidate.data()?.uid)
    || fallbackSnap.docs[0];
  return normalizeProfile(match.data(), normalizedUsername, match.id);
}

export async function fetchUserProfileByUid(db, uid, email = '') {
  if (!uid) return null;

  const directSnap = await getDoc(doc(db, 'users', uid));
  if (directSnap.exists()) {
    return normalizeProfile(directSnap.data(), inferUsernameFromEmail(email), directSnap.id);
  }

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

export function getUserDocId(userLike) {
  if (!userLike) return '';
  if (typeof userLike === 'string') return userLike;
  return userLike.docId || userLike.uid || userLike.username || '';
}

export function getUserProfileRef(db, userLike) {
  return doc(db, 'users', getUserDocId(userLike));
}

export function getUserSubcollectionRef(db, userLike, subcollectionName) {
  return collection(db, 'users', getUserDocId(userLike), subcollectionName);
}

export function getUserSubdocRef(db, userLike, subcollectionName, documentId) {
  return doc(db, 'users', getUserDocId(userLike), subcollectionName, String(documentId));
}

export async function ensureUserProfileDocument(db, profile, fallbackUsername = '') {
  const normalized = normalizeProfile(profile, fallbackUsername);
  if (!normalized?.username) return null;

  const { docId, manager_id, ...payload } = normalized;
  const targetDocId = normalized.uid || docId || normalized.username;
  const profilePayload = {
    ...payload,
    uid: normalized.uid || targetDocId,
  };

  await setDoc(doc(db, 'users', targetDocId), profilePayload, { merge: true });
  await setDoc(doc(db, 'usernames', normalized.username), {
    uid: normalized.uid || targetDocId,
    username: normalized.username,
    updated_at: new Date(),
  }, { merge: true });

  return {
    ...profilePayload,
    username: normalized.username,
    docId: targetDocId,
  };
}

export const ensureUsernameProfileDocument = ensureUserProfileDocument;
