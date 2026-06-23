import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getUserDocId } from '../utils/userProfiles';

function profileSummary(profile) {
  return {
    uid: getUserDocId(profile),
    username: profile?.username || '',
    full_name: profile?.full_name || profile?.displayName || profile?.username || '',
    photo_url: profile?.photo_url || '',
  };
}

export function chatIdFor(uidA, uidB) {
  if (!uidA || !uidB) return '';
  return [uidA, uidB].map(String).sort().join('__');
}

function otherMemberId(chat, currentUid) {
  return (chat?.members || []).find((uid) => uid !== currentUid) || '';
}

export async function getOrCreateChat(currentUser, friend) {
  const currentUid = getUserDocId(currentUser);
  const friendUid = friend?.uid || getUserDocId(friend);
  if (!currentUid || !friendUid) throw new Error('Faltan datos para abrir el chat.');

  const chatId = chatIdFor(currentUid, friendUid);
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  const memberProfiles = {
    [currentUid]: profileSummary(currentUser),
    [friendUid]: profileSummary(friend),
  };

  if (!chatSnap.exists()) {
    await setDoc(chatRef, {
      members: [currentUid, friendUid].sort(),
      member_profiles: memberProfiles,
      unread_by: [],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } else {
    await setDoc(chatRef, {
      member_profiles: memberProfiles,
      updated_at: serverTimestamp(),
    }, { merge: true });
  }

  return chatId;
}

export function subscribeToChats(user, onUpdate) {
  const uid = getUserDocId(user);
  if (!uid) return () => {};

  const q = query(collection(db, 'chats'), where('members', 'array-contains', uid));
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map((chatDoc) => {
      const data = chatDoc.data();
      const friendUid = otherMemberId(data, uid);
      return {
        id: chatDoc.id,
        friend_uid: friendUid,
        friend: data.member_profiles?.[friendUid] || { uid: friendUid },
        unread: (data.unread_by || []).includes(uid),
        ...data,
      };
    });

    chats.sort((a, b) => {
      const aTime = a.last_message_at?.toMillis?.() || a.updated_at?.toMillis?.() || 0;
      const bTime = b.last_message_at?.toMillis?.() || b.updated_at?.toMillis?.() || 0;
      return bTime - aTime;
    });

    onUpdate(chats);
  }, (error) => {
    console.error('[chat] Could not subscribe to chats:', error);
    onUpdate([]);
  });
}

export function subscribeToChatMessages(chatId, currentUser, onUpdate) {
  const uid = getUserDocId(currentUser);
  if (!chatId || !uid) return () => {};

  const messagesQuery = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('created_at', 'asc'),
    limit(100)
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((messageDoc) => ({
      id: messageDoc.id,
      ...messageDoc.data(),
    }));
    onUpdate(messages);
  }, (error) => {
    console.error('[chat] Could not subscribe to messages:', error);
    onUpdate([]);
  });
}

export async function sendChatMessage(currentUser, friend, text) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return;
  if (cleanText.length > 1000) throw new Error('El mensaje es demasiado largo.');

  const currentUid = getUserDocId(currentUser);
  const friendUid = friend?.uid || getUserDocId(friend);
  const chatId = await getOrCreateChat(currentUser, friend);
  const chatRef = doc(db, 'chats', chatId);

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    text: cleanText,
    sender_uid: currentUid,
    sender_user: profileSummary(currentUser),
    created_at: serverTimestamp(),
  });

  await setDoc(chatRef, {
    last_message: {
      text: cleanText,
      sender_uid: currentUid,
      sender_username: currentUser?.username || '',
    },
    last_message_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    unread_by: arrayUnion(friendUid),
  }, { merge: true });
}

export async function markChatRead(currentUser, chatId) {
  const uid = getUserDocId(currentUser);
  if (!uid || !chatId) return;

  await updateDoc(doc(db, 'chats', chatId), {
    [`read_at.${uid}`]: serverTimestamp(),
    unread_by: arrayRemove(uid),
    updated_at: serverTimestamp(),
  });
}
