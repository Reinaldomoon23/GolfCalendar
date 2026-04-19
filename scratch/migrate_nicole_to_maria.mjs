import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0',
    authDomain: 'golfscorings-e4338.firebaseapp.com',
    projectId: 'golfscorings-e4338',
    storageBucket: 'golfscorings-e4338.firebasestorage.app',
    messagingSenderId: '987034024177',
    appId: '1:987034024177:web:560e69822800f3a613d150'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const NICOLE_UID = 'kuiR2CBrCYeKH4lkEGqCIkOKI3H2';
const MARIA_UID  = 'PJXYMRB36jTkWkFY7v1k8Sz7kRj2';

function isMerit(t) {
    return t.type === 'merit' || String(t.name || '').toUpperCase().includes('ORDEN DE MERITO');
}

async function main() {
    // Fetch Nicole's tournaments
    const nicoleSnap = await getDocs(collection(db, 'users', NICOLE_UID, 'custom_tournaments'));
    const nicole = nicoleSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    console.log(`Nicole: ${nicole.length} tournaments`);

    // Fetch Maria's existing tournaments
    const mariaSnap = await getDocs(collection(db, 'users', MARIA_UID, 'custom_tournaments'));
    const mariaIds = new Set(mariaSnap.docs.map(d => d.id));
    console.log(`Maria already has: ${mariaIds.size} tournaments`);

    const toSkip = nicole.filter(t => isMerit(t));
    const toCopy = nicole.filter(t => !isMerit(t));

    console.log(`\nSkipping (Orden de Merito): ${toSkip.length}`);
    toSkip.forEach(t => console.log(`  SKIP: [${t._docId}] ${t.name}`));

    console.log(`\nTo copy: ${toCopy.length}`);
    let copied = 0;
    let skippedExists = 0;

    for (const t of toCopy) {
        const docId = t._docId;
        const { _docId, ...data } = t;

        if (mariaIds.has(docId)) {
            console.log(`  EXISTS: [${docId}] ${data.name} — overwriting with latest data`);
        } else {
            console.log(`  COPY: [${docId}] ${data.name}`);
        }

        await setDoc(doc(db, 'users', MARIA_UID, 'custom_tournaments', docId), data);
        copied++;
    }

    console.log(`\n✅ Done. Copied/updated ${copied} tournaments to Maria Ros.`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
