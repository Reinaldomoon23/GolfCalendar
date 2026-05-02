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

async function check12() {
    const userId = "kuiR2CBrCYeKH4lkEGqCIkOKI3H2";
    const docSnap = await getDoc(doc(db, "users", userId, "results", "12"));
    if (docSnap.exists()) {
        const d = docSnap.data();
        console.log(`keys: ${Object.keys(d)}`);
        console.log(`tournamentName: ${d.tournamentName}`);
        console.log(`dates: ${d.dates}`);
        console.log(`tournamentDates: ${d.tournamentDates}`);
    }
}
check12().catch(console.error);
