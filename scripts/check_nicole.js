
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0",
    authDomain: "golfscorings-e4338.firebaseapp.com",
    projectId: "golfscorings-e4338",
    storageBucket: "golfscorings-e4338.firebasestorage.app",
    messagingSenderId: "987034024177",
    appId: "1:987034024177:web:560e69822800f3a613d150"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkNicole() {
    console.log("Checking Nicole Data...");
    const snap = await getDoc(doc(db, "users", "nicole"));
    console.log(JSON.stringify(snap.data(), null, 2));
}

checkNicole();
