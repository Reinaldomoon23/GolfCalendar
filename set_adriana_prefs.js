
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

const updatePrefs = async () => {
    try {
        await setDoc(doc(db, "users", "adriana", "settings", "preferences"), {
            // Only include official/important groups. Exclude 'club' and 'merit'.
            groups: ['valedero', 'grand_prix', 'rfeg', 'fcg', 'juvenil', 'amateur', 'WAGR'],
            hiddenIds: [] // Can add specific IDs here if needed
        });
        console.log("Preferences for 'adriana' updated to exclude Club/Merit.");
    } catch (e) {
        console.error("Error updating prefs: ", e);
    }
    process.exit(0);
};

updatePrefs();
