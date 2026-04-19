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

async function scanTeam() {
    const members = ['nicole', 'txell', 'ona'];
    const p = { nicole: 'Nicochi', txell: 'alosalos', ona: 'Martinez' };

    for (const m of members) {
        try {
            const cred = await signInWithEmailAndPassword(auth, `${m}@golfteam.app`, p[m]);
            const uid = cred.user.uid;
            console.log(`\nScanning ${m} (${uid})...`);
            
            const resultsRef = collection(db, 'users', uid, 'results');
            const snap = await getDocs(resultsRef);
            snap.forEach(d => {
                const data = d.data();
                const name = data.tournamentName || data.name || "UNNAMED";
                if (name.toLowerCase().includes('torremirona')) {
                    console.log(`FOUND in results! ID: ${d.id} | Name: ${name}`);
                }
            });

            const customRef = collection(db, 'users', uid, 'custom_tournaments');
            const snap2 = await getDocs(customRef);
            snap2.forEach(d => {
                const data = d.data();
                if (data.name?.toLowerCase().includes('torremirona')) {
                    console.log(`FOUND in custom! ID: ${d.id} | Name: ${data.name}`);
                }
            });
        } catch (e) { console.log(`Err scanning ${m}`); }
    }
}
scanTeam();
