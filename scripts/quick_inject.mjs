import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

async function inject() {
  try {
    await setDoc(doc(db, 'tournaments', 'FG43TF92'), {
        id: "FG43TF92",
        name: "Torremirona Cup (Infantil/Aleví/Benjamí)",
        dates: "14/02/2026 - 15/02/2026",
        course: "Torremirona",
        organizer: "Torremirona Golf Club",
        country: "España",
        circuit: "FCG",
        category: "Juvenil",
        qualifications: ["Grand Prix", "Valedera"],
        groups: ["club", "grand-prix"]
    });
    console.log('SUCCESS: FG43TF92 Injectado en Firestore Global');
  } catch (e) {
    console.error('ERROR:', e);
  }
}
inject();
