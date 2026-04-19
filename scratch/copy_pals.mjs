import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';

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

async function main() {
    // 1. Resolve source (Ona)
    let onaUid = 'ona'; // Fallback
    const onaUsernameSnap = await getDoc(doc(db, 'usernames', 'ona'));
    if (onaUsernameSnap.exists()) onaUid = onaUsernameSnap.data().uid;
    console.log('Ona UID:', onaUid);

    // 2. Resolve target (Txell)
    let txellUid = 'txell'; // Fallback
    const txellUsernameSnap = await getDoc(doc(db, 'usernames', 'txell'));
    if (txellUsernameSnap.exists()) txellUid = txellUsernameSnap.data().uid;
    console.log('Txell UID:', txellUid);

    // 3. Find the Pals tournament in Ona's collection
    const onaTournamentsSnap = await getDocs(collection(db, 'users', onaUid, 'custom_tournaments'));
    const palsTourney = onaTournamentsSnap.docs.find(d => 
        (d.data().name || '').toLowerCase().includes('pals') || 
        (d.data().course || '').toLowerCase().includes('pals')
    );

    if (!palsTourney) {
        console.error('Pals tournament not found in Ona\'s profile.');
        // Let's list some to see
        onaTournamentsSnap.docs.forEach(d => console.log('Found:', d.data().name));
        process.exit(1);
    }

    console.log('Found Pals Tournament:', palsTourney.data().name, 'ID:', palsTourney.id);

    // 4. Copy tournament to Txell
    await setDoc(doc(db, 'users', txellUid, 'custom_tournaments', palsTourney.id), palsTourney.data());
    console.log('Tournament copied to Txell.');

    // 5. Check if we should copy results (Optional, but often implied)
    // Actually, usually they just want the tournament to be in the other person's list.
    // I'll check if there's a result for this tournament in Ona's profile.
    const onaResultSnap = await getDoc(doc(db, 'users', onaUid, 'results', palsTourney.id));
    if (onaResultSnap.exists()) {
        console.log('Found result in Ona profile. Copying only metadata to Txell result (not the actual strokes/scores unless they are identical, which is unlikely for a different player).');
        const onaResult = onaResultSnap.data();
        // Create a clean result for Txell with same tournament metadata but NO SCORES
        const txellResult = {
            tournamentId: palsTourney.id,
            tournamentName: onaResult.tournamentName,
            tournamentCourse: onaResult.tournamentCourse,
            tournamentDates: onaResult.tournamentDates,
            tournamentPar: onaResult.tournamentPar || 72,
            rounds: [],
            stableford: [],
            scorecards: {},
            updated_at: new Date()
        };
        await setDoc(doc(db, 'users', txellUid, 'results', palsTourney.id), txellResult);
        console.log('Result metadata created for Txell.');
    }

    process.exit(0);
}

main().catch(console.error);
