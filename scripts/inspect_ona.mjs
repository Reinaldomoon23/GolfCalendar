import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

async function inspectOna() {
    try {
        await signInWithEmailAndPassword(auth, "ona@golfteam.app", "Martinez");
        const resultsRef = collection(db, 'users', 'VyOk3RwUVAc8xPLIJeolMlCErK72', 'results');
        const snap = await getDocs(resultsRef);
        
        console.log("Documents found for Ona:");
        snap.forEach(d => {
            const data = d.data();
            console.log(`ID: ${d.id} | Name: ${data.tournamentName || data.name || data.tournament} | Date: ${data.dates || data.date}`);
        });
    } catch (e) { console.error(e); }
}
inspectOna();
