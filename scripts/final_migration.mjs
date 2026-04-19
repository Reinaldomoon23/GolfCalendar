import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
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

const TARGET_ID = "FG43TF92";
const USERS = [
    { u: 'nicole', p: 'Nicochi' },
    { u: 'txell', p: 'alosalos' },
    { u: 'ona', p: 'Martinez' },
    { u: 'maria', p: 'Boixader' },
    { u: 'sofia', p: 'Boixader' },
    { u: 'adriana', p: 'Montolio' },
    { u: 'jordi', p: 'Garcia' }
];

async function migrate() {
    for (const user of USERS) {
        try {
            console.log(`\nProcessing ${user.u}...`);
            await signInWithEmailAndPassword(auth, `${user.u}@golfteam.app`, user.p);
            const uid = auth.currentUser.uid;
            
            const resultsRef = collection(db, 'users', uid, 'results');
            const snap = await getDocs(resultsRef);
            
            let dataToMigrate = null;
            snap.forEach(d => {
                const data = d.data();
                // Check by ID 4 OR by Name
                if (d.id === '4' || (data.tournamentName || data.name || '').toLowerCase().includes('torremirona')) {
                    dataToMigrate = data;
                }
            });

            // Also check custom_tournaments
            if (!dataToMigrate) {
                const customRef = collection(db, 'users', uid, 'custom_tournaments');
                const snap2 = await getDocs(customRef);
                snap2.forEach(d => {
                    const data = d.data();
                    if (data.name?.toLowerCase().includes('torremirona')) {
                        dataToMigrate = data;
                    }
                });
            }

            if (dataToMigrate) {
                console.log(`Found data. Migrating to ${TARGET_ID}...`);
                await setDoc(doc(db, 'users', uid, 'results', TARGET_ID), {
                    ...dataToMigrate,
                    id: TARGET_ID,
                    tournamentId: TARGET_ID,
                    tournamentName: "Torremirona Cup (Infantil/Aleví/Benjamí)"
                });
                console.log(`SUCCESS for ${user.u}`);
            } else {
                console.log(`No data found for ${user.u}`);
            }
        } catch (e) { console.log(`Err: ${e.message}`); }
    }
}
migrate();
