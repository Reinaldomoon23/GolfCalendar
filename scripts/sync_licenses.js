
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from 'fs';

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

// Known licenses
const manualLicenses = {
    "nicole": "CB65996143",
    "txell": "CB22984122",
    "ona": "CB01912504",
    "valentina": "CB01965090",
    "maria": "CB65415931",
    "sofia": "CB65036032",
    "david": "CB65968149",
    "adriana": "CB05956982",
    "jordi": "CB65995986"
};

async function sync() {
    console.log("Restaurando licencias en Firestore...");
    for (const username in manualLicenses) {
        const license = manualLicenses[username];
        console.log(`Actualizando ${username} -> ${license}`);
        await setDoc(doc(db, "users", username), {
            federation_id: license
        }, { merge: true });
    }
    console.log("Sync finalizado con éxito.");
}

sync().catch(console.error);
