
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

const updateUser = async () => {
    try {
        await setDoc(doc(db, "users", "adriana"), {
            password_hash: "a81908e0db55c985c3100398316fd44b", // MD5 of 'montolio' (lowercase)
            role: "user"
        }, { merge: true });
        console.log("User 'adriana' updated with lowercase password hash.");
    } catch (e) {
        console.error("Error updating user: ", e);
    }
    process.exit(0);
};

updateUser();
