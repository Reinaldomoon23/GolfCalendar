import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as fs from 'fs';

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
    const userId = "kuiR2CBrCYeKH4lkEGqCIkOKI3H2";
    const lines = [];
    lines.push("Checking results subcollection for Nicole...");
    const snap = await getDocs(collection(db, "users", userId, "results"));
    snap.forEach(doc => {
        lines.push(`Result ID: "${doc.id}" -> tournamentName: "${doc.data().tournamentName}", dates: "${doc.data().tournamentDates || doc.data().dates}"`);
    });
    fs.writeFileSync("scratch/nicole_output.txt", lines.join("\n"));
    console.log("Written to file");
}
checkNicole().catch(console.error);
