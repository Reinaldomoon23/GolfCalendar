import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, getDocs, where } from "firebase/firestore";

const app = initializeApp({
    apiKey: "AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0",
    projectId: "golfscorings-e4338"
});
const db = getFirestore(app);

async function check() {
  const usersSnap = await getDocs(query(collection(db, 'users'), where('username', '==', 'jordi')));
  if (usersSnap.empty) { console.log('User jordi not found'); process.exit(0); }
  
  const userDoc = usersSnap.docs[0];
  console.log('Jordi Federation ID:', userDoc.data().federation_id);
  
  const historySnap = await getDocs(collection(db, `users/${userDoc.id}/handicap_history`));
  const history = historySnap.docs.map(d => d.data());
  history.sort((a, b) => b.date.localeCompare(a.date));
  
  console.log('History:', history.length, 'entries');
  console.log(history.slice(0, 15));
  process.exit(0);
}
check();
