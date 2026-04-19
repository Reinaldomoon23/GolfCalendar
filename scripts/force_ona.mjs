import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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
const auth = getAuth(app);

async function forceOnaUpdate() {
    try {
        await signInWithEmailAndPassword(auth, "ona@golfteam.app", "Martinez");
        const uid = auth.currentUser.uid;
        
        console.log("Updating Ona's legacy tournament card (ID 4)...");
        
        // We update her result document for ID 4 to include the centralized ID
        // This might trigger the 'COINCIDE' logic even in the old version
        const ref = doc(db, 'users', uid, 'results', '4');
        await updateDoc(ref, {
            linkedTo: "FG43TF92",
            tournamentId: "FG43TF92",
            centralized: true
        });
        
        console.log("SUCCESS: Ona's legacy card updated with link to FG43TF92");
    } catch (e) {
        console.error("Error updating Ona:", e.message);
    }
}
forceOnaUpdate();
