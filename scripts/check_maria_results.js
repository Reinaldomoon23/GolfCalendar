/**
 * Script para verificar cuántos resultados tiene María en Firestore
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

async function checkMariaResults() {
    console.log('🔍 Verificando datos de María Boixader...\n');

    try {
        // 1. Buscar todos los documentos de usuarios para encontrar a María
        console.log('1️⃣ Buscando perfil de María...');
        const usersSnapshot = await getDocs(collection(db, 'users'));

        let mariaDoc = null;
        let mariaDocId = null;

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.username === 'maria') {
                mariaDoc = data;
                mariaDocId = doc.id;
                console.log(`✅ Encontrada María en: users/${doc.id}`);
                console.log(`   - Username: ${data.username}`);
                console.log(`   - Full Name: ${data.full_name}`);
                console.log(`   - UID: ${data.uid}`);
                console.log(`   - Federation ID: ${data.federation_id}`);
            }
        });

        if (!mariaDoc) {
            console.log('❌ No se encontró perfil de María');
            process.exit(1);
        }

        // 2. Verificar resultados en la ubicación del documento
        console.log(`\n2️⃣ Verificando resultados en users/${mariaDocId}/results...`);
        const resultsSnapshot = await getDocs(collection(db, 'users', mariaDocId, 'results'));

        console.log(`📊 Total de resultados: ${resultsSnapshot.size}`);

        if (resultsSnapshot.size > 0) {
            console.log('\n📋 Lista de resultados:');
            resultsSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`\n   • ID: ${doc.id}`);
                console.log(`     - Score: ${data.score || 'N/A'}`);
                console.log(`     - Date: ${data.date || 'N/A'}`);
                console.log(`     - Tournament: ${data.tournament_name || 'N/A'}`);
                if (data.scorecards) {
                    const roundsCount = Object.keys(data.scorecards).length;
                    console.log(`     - Rounds: ${roundsCount}`);
                }
            });
        }

        // 3. Verificar torneos custom
        console.log(`\n3️⃣ Verificando torneos custom en users/${mariaDocId}/custom_tournaments...`);
        const customSnapshot = await getDocs(collection(db, 'users', mariaDocId, 'custom_tournaments'));
        console.log(`🏆 Total de torneos custom: ${customSnapshot.size}`);

        if (customSnapshot.size > 0) {
            console.log('\n📋 Lista de torneos custom:');
            customSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`\n   • ${data.name || doc.id}`);
                console.log(`     - Dates: ${data.dates || 'N/A'}`);
                console.log(`     - Location: ${data.location || data.course || 'N/A'}`);
            });
        }

        // 4. Verificar settings
        console.log(`\n4️⃣ Verificando settings en users/${mariaDocId}/settings...`);
        const settingsSnapshot = await getDocs(collection(db, 'users', mariaDocId, 'settings'));
        console.log(`⚙️  Total de documentos de settings: ${settingsSnapshot.size}`);

        // 5. Verificar si David tiene managed_users
        console.log('\n5️⃣ Verificando perfil de David (manager)...');
        const davidSnapshot = await getDocs(collection(db, 'users'));

        davidSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.username === 'david') {
                console.log(`✅ Encontrado David en: users/${doc.id}`);
                console.log(`   - Managed Users: ${JSON.stringify(data.managed_users || [])}`);
                console.log(`   - Role: ${data.role || 'N/A'}`);
            }
        });

        console.log('\n' + '='.repeat(60));
        console.log('RESUMEN');
        console.log('='.repeat(60));
        console.log(`María Doc ID: ${mariaDocId}`);
        console.log(`Resultados: ${resultsSnapshot.size}`);
        console.log(`Torneos Custom: ${customSnapshot.size}`);
        console.log(`Settings: ${settingsSnapshot.size}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

checkMariaResults();
