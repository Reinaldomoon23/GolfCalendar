import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
    const profilesSnap = await getDocs(collection(db, 'profiles'));
    profilesSnap.docs.forEach(d => {
        const data = d.data();
        console.log(`User: ${data.username} | Name: ${data.full_name} | UID: ${d.id}`);
    });
}
main();
