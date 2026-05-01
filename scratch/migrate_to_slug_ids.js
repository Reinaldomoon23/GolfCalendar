
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";

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

function generateSlug(name, dates) {
    if (!name || !dates) return null;
    const slug = name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    const dateStr = dates.replace(/[^0-9]/g, "");
    return `${slug}_${dateStr}`;
}

async function migrate() {
    console.log("🚀 Iniciando migración de IDs numéricos a Slugs...");

    // 1. Obtener todos los usuarios
    const usersSnap = await getDocs(collection(db, "users"));
    console.log(`Analizando ${usersSnap.size} usuarios...`);

    for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userDocId = userDoc.id;
        
        // --- Migrar Resultados ---
        const resultsRef = collection(db, "users", userDocId, "results");
        const resultsSnap = await getDocs(resultsRef);
        
        for (const resDoc of resultsSnap.docs) {
            const id = resDoc.id;
            // Si el ID es numérico (o corto)
            if (!isNaN(id) || id.length < 5) {
                const data = resDoc.data();
                const newId = generateSlug(data.tournamentName, data.tournamentDates);
                
                if (newId) {
                    console.log(`[Resultados] Migrando ${userDocId}: ${id} -> ${newId}`);
                    await setDoc(doc(db, "users", userDocId, "results", newId), data);
                    await deleteDoc(doc(db, "users", userDocId, "results", id));
                }
            }
        }

        // --- Migrar Suscripciones ---
        const subRef = collection(db, "users", userDocId, "subscribed_tournaments");
        const subSnap = await getDocs(subRef);
        
        for (const subDoc of subSnap.docs) {
            const id = subDoc.id;
            if (!isNaN(id) || id.length < 5) {
                const data = subDoc.data();
                const newId = generateSlug(data.name, data.dates);
                
                if (newId) {
                    console.log(`[Suscripciones] Migrando ${userDocId}: ${id} -> ${newId}`);
                    await setDoc(doc(db, "users", userDocId, "subscribed_tournaments", newId), {
                        ...data,
                        tournamentId: newId
                    });
                    await deleteDoc(doc(db, "users", userDocId, "subscribed_tournaments", id));
                }
            }
        }
    }

    // 2. Limpiar la colección maestra de /tournaments/ si hay IDs numéricos
    const officialRef = collection(db, "tournaments");
    const officialSnap = await getDocs(officialRef);
    for (const offDoc of officialSnap.docs) {
        const id = offDoc.id;
        if (!isNaN(id) || id.length < 5) {
            console.log(`[Maestro] Eliminando ID legacy: ${id}`);
            await deleteDoc(doc(db, "tournaments", id));
        }
    }

    console.log("✅ Migración completada con éxito.");
}

migrate().catch(console.error);
