
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

const updateLicense = async () => {
    try {
        await setDoc(doc(db, "users", "adriana"), {
            federation_id: "CB00Example" // Placeholder to test persistence
        }, { merge: true });
        console.log("License for 'adriana' updated to 'CB00Example'.");
    } catch (e) {
        console.error("Error updating license: ", e);
    }
    process.exit(0);
};

updateLicense();
