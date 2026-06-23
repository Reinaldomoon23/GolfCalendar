import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  fetchUserProfileByUsername,
  getUserDocId,
  getUserProfileRef,
  getUserSubcollectionRef,
} from '../utils/userProfiles';

function normalizeUsername(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeSearchText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function profileSummary(profile) {
  return {
    uid: getUserDocId(profile),
    username: profile?.username || '',
    full_name: profile?.full_name || profile?.displayName || profile?.username || '',
    photo_url: profile?.photo_url || '',
  };
}

function normalizeNamePart(value = '') {
  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeFederationId(value = '') {
  return String(value).trim().replace(/\s+/g, '').toUpperCase();
}

export function getCommunityProfileStatus(user) {
  const firstName = normalizeNamePart(user?.first_name);
  const lastName1 = normalizeNamePart(user?.last_name_1);
  const lastName2 = normalizeNamePart(user?.last_name_2);
  const federationId = normalizeFederationId(user?.federation_id);

  return {
    isComplete: Boolean(firstName && lastName1 && lastName2 && federationId.length >= 4),
    firstName,
    lastName1,
    lastName2,
    federationId,
  };
}

export async function saveCommunityProfile(user, fields) {
  const firstName = normalizeNamePart(fields?.first_name);
  const lastName1 = normalizeNamePart(fields?.last_name_1);
  const lastName2 = normalizeNamePart(fields?.last_name_2);
  const federationId = normalizeFederationId(fields?.federation_id);

  if (!firstName || !lastName1 || !lastName2) {
    throw new Error('Nombre y dos apellidos son obligatorios.');
  }
  if (federationId.length < 4) {
    throw new Error('La licencia federativa debe tener al menos 4 caracteres.');
  }

  const fullName = `${firstName} ${lastName1} ${lastName2}`;
  const searchText = normalizeSearchText(`${fullName} ${user?.username || ''} ${federationId}`);
  const payload = {
    first_name: firstName,
    last_name_1: lastName1,
    last_name_2: lastName2,
    full_name: fullName,
    federation_id: federationId,
    profile_completed: true,
    profile_completed_at: new Date().toISOString(),
    search_text: searchText,
    updated_at: new Date().toISOString(),
  };

  await setDoc(getUserProfileRef(db, user), payload, { merge: true });

  return {
    ...user,
    ...payload,
  };
}

function pairId(uidA, uidB) {
  return [uidA, uidB].map(String).sort().join('__');
}

function requestId(fromUid, toUid) {
  return `${fromUid}__${toUid}`;
}

export async function searchUserForFriendship(currentUser, username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  if (normalized === normalizeUsername(currentUser?.username)) {
    throw new Error('No puedes añadirte a ti misma.');
  }

  const profile = await fetchUserProfileByUsername(db, normalized);
  if (!profile) {
    throw new Error('No se ha encontrado ninguna jugadora con ese usuario.');
  }

  return profileSummary(profile);
}

export async function searchUsersForFriendship(currentUser, searchTerm) {
  const normalizedTerm = normalizeSearchText(searchTerm);
  const normalizedCompactTerm = normalizeUsername(searchTerm);
  if (!normalizedTerm) return [];

  const currentUid = getUserDocId(currentUser);
  const currentUsername = normalizeUsername(currentUser?.username);
  const matches = new Map();

  try {
    const byUsername = await fetchUserProfileByUsername(db, normalizedCompactTerm);
    if (byUsername) {
      matches.set(getUserDocId(byUsername), byUsername);
    }
  } catch {
    // Continue with collection search; username lookup already reports not-found to callers elsewhere.
  }

  const usersSnapshot = await getDocs(collection(db, 'users'));
  usersSnapshot.docs.forEach((userDoc) => {
    const profile = { docId: userDoc.id, ...userDoc.data() };
    const uid = getUserDocId(profile);
    const username = normalizeUsername(profile.username);
    const fullName = normalizeSearchText(profile.full_name || profile.displayName || '');
    const structuredName = normalizeSearchText([
      profile.first_name,
      profile.last_name_1,
      profile.last_name_2,
    ].filter(Boolean).join(' '));
    const federationId = normalizeSearchText(profile.federation_id || '');
    const searchText = normalizeSearchText(profile.search_text || '');
    const haystack = `${username} ${fullName} ${structuredName} ${federationId} ${searchText}`.trim();

    if (
      uid &&
      uid !== currentUid &&
      username !== currentUsername &&
      haystack.includes(normalizedTerm)
    ) {
      matches.set(uid, profile);
    }
  });

  return Array.from(matches.values())
    .filter((profile) => {
      const uid = getUserDocId(profile);
      return uid && uid !== currentUid && normalizeUsername(profile.username) !== currentUsername;
    })
    .map(profileSummary)
    .sort((a, b) => String(a.full_name || a.username).localeCompare(String(b.full_name || b.username)))
    .slice(0, 20);
}

export async function sendFriendRequest(currentUser, targetProfile) {
  const fromUid = getUserDocId(currentUser);
  const toUid = getUserDocId(targetProfile);
  if (!fromUid || !toUid) throw new Error('Faltan datos de usuario.');
  if (fromUid === toUid) throw new Error('No puedes enviarte una solicitud a ti misma.');

  const friendshipRef = doc(db, 'friendships', pairId(fromUid, toUid));
  const outgoingRef = doc(db, 'friend_requests', requestId(fromUid, toUid));
  const reverseRef = doc(db, 'friend_requests', requestId(toUid, fromUid));

  const [friendshipSnap, outgoingSnap, reverseSnap] = await Promise.all([
    getDoc(friendshipRef),
    getDoc(outgoingRef),
    getDoc(reverseRef),
  ]);

  if (friendshipSnap.exists()) throw new Error('Ya sois amigas.');
  if (outgoingSnap.exists() && outgoingSnap.data()?.status === 'pending') {
    throw new Error('Ya has enviado una solicitud a esta jugadora.');
  }
  if (reverseSnap.exists() && reverseSnap.data()?.status === 'pending') {
    throw new Error('Esta jugadora ya te ha enviado una solicitud. Puedes aceptarla.');
  }

  await setDoc(outgoingRef, {
    from_uid: fromUid,
    to_uid: toUid,
    from_user: profileSummary(currentUser),
    to_user: profileSummary(targetProfile),
    status: 'pending',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return outgoingRef.id;
}

export function subscribeToFriends(user, onUpdate) {
  const uid = getUserDocId(user);
  if (!uid) return () => {};

  const q = query(collection(db, 'friendships'), where('members', 'array-contains', uid));
  return onSnapshot(q, (snapshot) => {
    const friends = snapshot.docs.map((friendDoc) => {
      const data = friendDoc.data();
      const otherUid = (data.members || []).find((memberUid) => memberUid !== uid);
      return {
        id: friendDoc.id,
        uid: otherUid,
        ...(data.member_profiles?.[otherUid] || {}),
        created_at: data.created_at,
      };
    }).filter((friend) => friend.uid);

    friends.sort((a, b) => String(a.full_name || a.username).localeCompare(String(b.full_name || b.username)));
    onUpdate(friends);
  }, (error) => {
    console.error('[friends] Could not subscribe to friends:', error);
    onUpdate([]);
  });
}

export function subscribeToIncomingFriendRequests(user, onUpdate) {
  const uid = getUserDocId(user);
  if (!uid) return () => {};

  const q = query(collection(db, 'friend_requests'), where('to_uid', '==', uid));

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs
      .map((requestDoc) => ({
        id: requestDoc.id,
        ...requestDoc.data(),
      }))
      .filter((request) => request.status === 'pending');
    requests.sort((a, b) => String(a.from_user?.full_name || a.from_user?.username).localeCompare(String(b.from_user?.full_name || b.from_user?.username)));
    onUpdate(requests);
  }, (error) => {
    console.error('[friends] Could not subscribe to incoming requests:', error);
    onUpdate([]);
  });
}

export function subscribeToOutgoingFriendRequests(user, onUpdate) {
  const uid = getUserDocId(user);
  if (!uid) return () => {};

  const q = query(collection(db, 'friend_requests'), where('from_uid', '==', uid));

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs
      .map((requestDoc) => ({
        id: requestDoc.id,
        ...requestDoc.data(),
      }))
      .filter((request) => request.status === 'pending');
    onUpdate(requests);
  }, (error) => {
    console.error('[friends] Could not subscribe to outgoing requests:', error);
    onUpdate([]);
  });
}

export async function acceptFriendRequest(currentUser, request) {
  const currentUid = getUserDocId(currentUser);
  if (!currentUid || request?.to_uid !== currentUid) {
    throw new Error('No puedes aceptar esta solicitud.');
  }

  const fromUid = request.from_uid;
  const friendshipRef = doc(db, 'friendships', pairId(currentUid, fromUid));
  const requestRef = doc(db, 'friend_requests', request.id);
  const memberProfiles = {
    [currentUid]: profileSummary(currentUser),
    [fromUid]: request.from_user,
  };

  const batch = writeBatch(db);
  batch.set(friendshipRef, {
    members: [currentUid, fromUid].sort(),
    member_profiles: memberProfiles,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });
  batch.update(requestRef, {
    status: 'accepted',
    updated_at: serverTimestamp(),
  });
  await batch.commit();
}

export async function rejectFriendRequest(currentUser, request) {
  const currentUid = getUserDocId(currentUser);
  if (!currentUid || request?.to_uid !== currentUid) {
    throw new Error('No puedes rechazar esta solicitud.');
  }

  await updateDoc(doc(db, 'friend_requests', request.id), {
    status: 'rejected',
    updated_at: serverTimestamp(),
  });
}

export async function removeFriend(currentUser, friend) {
  const currentUid = getUserDocId(currentUser);
  const friendUid = friend?.uid;
  if (!currentUid || !friendUid) throw new Error('Faltan datos de amistad.');
  await deleteDoc(doc(db, 'friendships', pairId(currentUid, friendUid)));
}

export async function loadFriendSchedule(friend) {
  if (!friend?.uid) return [];
  const snapshot = await getDocs(getUserSubcollectionRef(db, friend, 'subscribed_tournaments'));
  return snapshot.docs.map((scheduleDoc) => ({
    id: scheduleDoc.id,
    friend_uid: friend.uid,
    friend_username: friend.username,
    friend_name: friend.full_name || friend.username,
    ...scheduleDoc.data(),
  }));
}
