/**
 * Script de diagnóstico para María Boixader
 *
 * Verifica dónde están almacenados los datos de María en Firestore
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

async function diagnoseMaria() {
    console.log('🔍 Diagnosticando datos de María Boixader...\n');

    // 1. Buscar perfil en users/maria
    console.log('1️⃣ Buscando perfil en users/maria...');
    try {
        const mariaUsernameDoc = await getDoc(doc(db, 'users', 'maria'));
        if (mariaUsernameDoc.exists()) {
            const data = mariaUsernameDoc.data();
            console.log('✅ Encontrado en users/maria:');
            console.log('   - UID:', data.uid);
            console.log('   - Username:', data.username);
            console.log('   - Full Name:', data.full_name);
            console.log('   - Federation ID:', data.federation_id);
            console.log('   - Canonical UID:', data.canonical_uid || '(no migrado)');
            console.log('   - Legacy Alias:', data.legacy_alias || false);

            // Buscar resultados en users/maria/results
            console.log('\n📊 Buscando resultados en users/maria/results...');
            const resultsSnapshot = await getDocs(collection(db, 'users', 'maria', 'results'));
            console.log(`   - Encontrados: ${resultsSnapshot.size} resultados`);
            if (resultsSnapshot.size > 0) {
                resultsSnapshot.forEach(doc => {
                    console.log(`      • ${doc.id}`);
                });
            }

            // Buscar torneos custom
            console.log('\n🏆 Buscando torneos custom en users/maria/custom_tournaments...');
            const customSnapshot = await getDocs(collection(db, 'users', 'maria', 'custom_tournaments'));
            console.log(`   - Encontrados: ${customSnapshot.size} torneos`);

            // Buscar settings
            console.log('\n⚙️ Buscando settings en users/maria/settings...');
            const settingsSnapshot = await getDocs(collection(db, 'users', 'maria', 'settings'));
            console.log(`   - Encontrados: ${settingsSnapshot.size} documentos`);

            // Si hay canonical_uid, buscar en la ubicación canónica
            if (data.canonical_uid) {
                console.log(`\n2️⃣ Datos migrados a ubicación canónica: users/${data.canonical_uid}`);
                console.log('   Verificando datos en ubicación canónica...');

                const canonicalDoc = await getDoc(doc(db, 'users', data.canonical_uid));
                if (canonicalDoc.exists()) {
                    console.log('✅ Perfil canónico encontrado');

                    const canonicalResults = await getDocs(collection(db, 'users', data.canonical_uid, 'results'));
                    console.log(`   - Resultados en ubicación canónica: ${canonicalResults.size}`);

                    const canonicalCustom = await getDocs(collection(db, 'users', data.canonical_uid, 'custom_tournaments'));
                    console.log(`   - Torneos custom en ubicación canónica: ${canonicalCustom.size}`);
                }
            } else if (data.uid && data.uid !== 'maria') {
                console.log(`\n2️⃣ UID detectado: ${data.uid}`);
                console.log('   Verificando datos en users/${uid}...');

                const uidDoc = await getDoc(doc(db, 'users', data.uid));
                if (uidDoc.exists()) {
                    console.log('✅ Perfil en users/${uid} encontrado');

                    const uidResults = await getDocs(collection(db, 'users', data.uid, 'results'));
                    console.log(`   - Resultados en users/${uid}: ${uidResults.size}`);
                    if (uidResults.size > 0) {
                        uidResults.forEach(doc => {
                            console.log(`      • ${doc.id}`);
                        });
                    }

                    const uidCustom = await getDocs(collection(db, 'users', data.uid, 'custom_tournaments'));
                    console.log(`   - Torneos custom en users/${uid}: ${uidCustom.size}`);
                } else {
                    console.log('❌ No se encontró perfil en users/${uid}');
                }
            }
        } else {
            console.log('❌ No se encontró perfil en users/maria');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    // 3. Buscar mapping de username
    console.log('\n3️⃣ Verificando mapping en usernames/maria...');
    try {
        const usernameMapping = await getDoc(doc(db, 'usernames', 'maria'));
        if (usernameMapping.exists()) {
            const data = usernameMapping.data();
            console.log('✅ Mapping encontrado:');
            console.log('   - UID:', data.uid);
            console.log('   - Username:', data.username);
            console.log('   - Updated At:', data.updated_at);
        } else {
            console.log('❌ No se encontró mapping en usernames/maria');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    // 4. Verificar perfil de David (manager)
    console.log('\n4️⃣ Verificando perfil de David (manager)...');
    try {
        const davidDoc = await getDoc(doc(db, 'users', 'david'));
        if (davidDoc.exists()) {
            const data = davidDoc.data();
            console.log('✅ Perfil de David encontrado:');
            console.log('   - UID:', data.uid);
            console.log('   - Managed Users:', data.managed_users || []);
            console.log('   - Role:', data.role);

            // Verificar en users/{david_uid}
            if (data.canonical_uid || (data.uid && data.uid !== 'david')) {
                const davidUid = data.canonical_uid || data.uid;
                console.log(`\n   Verificando users/${davidUid}...`);
                const davidUidDoc = await getDoc(doc(db, 'users', davidUid));
                if (davidUidDoc.exists()) {
                    const davidUidData = davidUidDoc.data();
                    console.log('   ✅ Perfil canónico de David:');
                    console.log('      - Managed Users:', davidUidData.managed_users || []);
                }
            }
        } else {
            console.log('❌ No se encontró perfil de David en users/david');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('RESUMEN DEL DIAGNÓSTICO');
    console.log('='.repeat(60));
    console.log('Si ves resultados en users/maria/results pero NO en users/{uid}/results,');
    console.log('entonces necesitas ejecutar el script de migración de ownership.');
    console.log('\nComando: node scripts/migrate_user_ownership_to_uid.js');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
}

diagnoseMaria().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
});
