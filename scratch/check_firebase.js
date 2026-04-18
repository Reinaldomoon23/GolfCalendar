import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from 'fs';

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

async function checkMapping(username) {
  console.log(`Checking mapping for: ${username}`);
  const ref = doc(db, 'usernames', username.toLowerCase());
  const snap = await getDoc(ref);
  if (snap.exists()) {
    console.log('Mapping found:', snap.data());
  } else {
    console.log('Mapping NOT found.');
  }
}

checkMapping('ona');
checkMapping('nicole');
