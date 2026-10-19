import { deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUserSubcollectionRef, getUserSubdocRef } from '../utils/userProfiles';

export function subscribeToTrainingTests(user, onUpdate) {
  if (!user) return () => {};
  return onSnapshot(getUserSubcollectionRef(db, user, 'training_tests'), (snapshot) => {
    const sessions = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    onUpdate(sessions);
  }, (error) => {
    console.warn('[training-tests] Subscription failed:', error);
    onUpdate([]);
  });
}

export async function saveTrainingTest(user, session) {
  if (!user || !session?.id) throw new Error('User and session id are required');
  await setDoc(getUserSubdocRef(db, user, 'training_tests', session.id), { ...session, updatedAt: new Date().toISOString() });
}

export async function deleteTrainingTest(user, sessionId) {
  if (!user || !sessionId) throw new Error('User and session id are required');
  await deleteDoc(getUserSubdocRef(db, user, 'training_tests', sessionId));
}
