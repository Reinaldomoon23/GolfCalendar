import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, query, where } from 'firebase/firestore';
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

async function migrateAll() {
    for (const user of USERS) {
        try {
            const email = `${user.u}@golfteam.app`;
            console.log(`\n--- Working on: ${user.u} ---`);
            
            const userCred = await signInWithEmailAndPassword(auth, email, user.p);
            const uid = userCred.user.uid;
            
            const resultsRef = collection(db, 'users', uid, 'results');
            const snap = await getDocs(resultsRef);
            
            let sourceDoc = null;
            snap.forEach(d => {
                const data = d.data();
                if ((data.tournamentName || '').toLowerCase().includes('torremirona')) {
                    sourceDoc = data;
                }
            });

            if (sourceDoc) {
                console.log(`Found Torremirona data for ${user.u}. Migrating to ${TARGET_ID}...`);
                await setDoc(doc(db, 'users', uid, 'results', TARGET_ID), {
                    ...sourceDoc,
                    id: TARGET_ID,
                    tournamentId: TARGET_ID
                });
                console.log(`SUCCESS: ${user.u} is now linked to ${TARGET_ID}`);
            } else {
                console.log(`No Torremirona data found for ${user.u}.`);
            }
        } catch (err) {
            console.error(`FAILED for ${user.u}:`, err.message);
        }
    }
}

migrateAll();
