import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const app = initializeApp({
    apiKey: "AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0",
    projectId: "golfscorings-e4338"
});
const db = getFirestore(app);

async function check() {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => d.data());
  for (const u of users.slice(0,5)) {
    console.log(u.username, u.federation_id);
  }
  process.exit(0);
}
check();
