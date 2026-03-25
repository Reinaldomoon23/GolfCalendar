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

  // Lookup by username mapping (usernames/{username} → uid → users/{uid})
  try {
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
  } catch (err) {
    console.warn('[userProfiles] Username mapping lookup failed:', err.code || err.message);
  }

  // Direct lookup: users/{username}
  try {
    const directRef = doc(db, 'users', normalizedUsername);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      const directProfile = directSnap.data();

      if (directProfile?.uid && directProfile.uid !== normalizedUsername) {
        try {
          const canonicalSnap = await getDoc(doc(db, 'users', directProfile.uid));
          if (canonicalSnap.exists()) {
            return normalizeProfile(canonicalSnap.data(), normalizedUsername, canonicalSnap.id);
          }
        } catch (err) {
          console.warn('[userProfiles] Canonical uid lookup failed:', err.code || err.message);
        }
      }

      return normalizeProfile(directProfile, normalizedUsername, directSnap.id);
    }
  } catch (err) {
    console.warn('[userProfiles] Direct username lookup failed:', err.code || err.message);
  }

  // Fallback: query by username field (may fail if rules don't allow collection scans)
  try {
    const fallbackQuery = query(
      collection(db, 'users'),
      where('username', '==', normalizedUsername)
    );
    const fallbackSnap = await getDocs(fallbackQuery);

    if (!fallbackSnap.empty) {
      const match = fallbackSnap.docs.find((candidate) => candidate.id === candidate.data()?.uid)
        || fallbackSnap.docs[0];
      return normalizeProfile(match.data(), normalizedUsername, match.id);
    }
  } catch (err) {
    console.warn('[userProfiles] Fallback query failed (may be a rules issue):', err.code || err.message);
  }

  return null;
}

export async function fetchUserProfileByUid(db, uid, email = '') {
  if (!uid) return null;

  // Primary lookup: user document stored at users/{uid}
  try {
    const directSnap = await getDoc(doc(db, 'users', uid));
    if (directSnap.exists()) {
      return normalizeProfile(directSnap.data(), inferUsernameFromEmail(email), directSnap.id);
    }
  } catch (err) {
    console.warn('[userProfiles] Direct uid lookup failed:', err.code || err.message);
  }

  // Secondary: collection query (may fail if rules don't allow collection scans)
  try {
    const byUid = query(collection(db, 'users'), where('uid', '==', uid));
    const uidSnap = await getDocs(byUid);

    if (!uidSnap.empty) {
      const match = uidSnap.docs[0];
      const fallbackUsername = inferUsernameFromEmail(email);
      return normalizeProfile(match.data(), fallbackUsername, match.id);
    }
  } catch (err) {
    console.warn('[userProfiles] UID query failed (may be a rules issue):', err.code || err.message);
  }

  // Tertiary: try resolving by username inferred from email
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

  // Write the user profile document (primary operation)
  try {
    await setDoc(doc(db, 'users', targetDocId), profilePayload, { merge: true });
  } catch (err) {
    console.error('[userProfiles] Could not write user profile to Firestore:', err.code || err.message);
    // If the profile already exists in memory (resolved), continue anyway
    // This can happen if security rules block writes to other users' profiles
  }

  // Write the username->uid mapping (secondary operation, may be blocked by restrictive rules)
  // We wrap this separately so it does NOT break the login flow if rules deny it
  try {
    await setDoc(doc(db, 'usernames', normalized.username), {
      uid: normalized.uid || targetDocId,
      username: normalized.username,
      updated_at: new Date(),
    }, { merge: true });
  } catch (err) {
    // This is expected to fail when Firestore rules restrict writes to /usernames/
    // The login flow should still succeed using the user profile document
    console.warn('[userProfiles] Could not update username mapping (may be blocked by rules):', err.code || err.message);
  }

  return {
    ...profilePayload,
    username: normalized.username,
    docId: targetDocId,
  };
}

export const ensureUsernameProfileDocument = ensureUserProfileDocument;
