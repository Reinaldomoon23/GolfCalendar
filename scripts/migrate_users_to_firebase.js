/**
 * Script de migración: users.json → Firebase Auth + Firestore
 *
 * Este script:
 * 1. Lee users.json
 * 2. Crea usuarios en Firebase Authentication
 * 3. Guarda perfiles en Firestore
 *
 * IMPORTANTE: Solo ejecutar UNA VEZ
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0",
    authDomain: "golfscorings-e4338.firebaseapp.com",
    projectId: "golfscorings-e4338",
    storageBucket: "golfscorings-e4338.firebasestorage.app",
    messagingSenderId: "987034024177",
    appId: "1:987034024177:web:560e69822800f3a613d150"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Leer users.json
const usersPath = path.join(__dirname, '../public/api/users.json');
const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

// Contraseñas reales de los usuarios (proporcionadas por Reinaldo)
const userPasswords = {
    nicole: 'Nicochi',
    txell: 'alosalos',
    ona: 'Martinez',
    maria: 'Boixader',  // Misma que David (padre)
    sofia: 'Boixader',  // Misma que David (padre)
    david: 'Boixader',
    adriana: 'Montolio',
    jordi: 'Garcia'
    // valentina: ELIMINADA - no migrar este usuario
};

async function migrateUsers() {
    console.log('🚀 Iniciando migración de usuarios a Firebase...\n');

    const results = {
        success: [],
        failed: [],
        credentials: []
    };

    for (const [username, userData] of Object.entries(usersData)) {
        // Saltar usuario valentina (eliminado)
        if (username === 'valentina') {
            console.log(`⏭️  Saltando usuario: ${username} (eliminado)`);
            continue;
        }

        // Saltar usuarios sin contraseña definida
        if (!userPasswords[username]) {
            console.log(`⚠️  Saltando usuario: ${username} (sin contraseña definida)`);
            results.failed.push({ username, error: 'Sin contraseña definida' });
            continue;
        }

        try {
            console.log(`📝 Migrando usuario: ${username}`);

            // Generar email (Firebase Auth requiere email)
            const email = `${username}@golfteam.app`;
            const password = userPasswords[username];

            // 1. Crear usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Actualizar perfil con nombre
            await updateProfile(user, {
                displayName: userData.full_name
            });

            // 3. Guardar datos adicionales en Firestore
            await setDoc(doc(db, 'users', username), {
                uid: user.uid,
                username: username,
                email: email,
                full_name: userData.full_name,
                federation_id: userData.federation_id || '',
                photo_url: userData.photo_url || '',
                handicap_url: userData.handicap_url || '',
                role: userData.role || 'user',
                managed_users: userData.managed_users || [],
                created_at: new Date(),
                migrated_from_php: true
            });

            console.log(`✅ Usuario ${username} migrado exitosamente (UID: ${user.uid})`);

            results.success.push(username);
            results.credentials.push({
                username,
                email,
                password,
                uid: user.uid
            });

        } catch (error) {
            console.error(`❌ Error migrando ${username}:`, error.message);
            results.failed.push({ username, error: error.message });
        }
    }

    // Guardar credenciales en archivo temporal
    const credentialsPath = path.join(__dirname, '../MIGRATION_CREDENTIALS.json');
    fs.writeFileSync(
        credentialsPath,
        JSON.stringify(results.credentials, null, 2)
    );

    console.log('\n📊 Resumen de migración:');
    console.log(`✅ Exitosos: ${results.success.length}`);
    console.log(`❌ Fallidos: ${results.failed.length}`);
    console.log(`\n🔑 Credenciales guardadas en: MIGRATION_CREDENTIALS.json`);
    console.log('\n⚠️  IMPORTANTE: Envía las credenciales a cada usuario y elimina el archivo después.\n');

    if (results.failed.length > 0) {
        console.log('\n❌ Usuarios que fallaron:');
        results.failed.forEach(f => console.log(`   - ${f.username}: ${f.error}`));
    }

    process.exit(0);
}

migrateUsers().catch(error => {
    console.error('💥 Error fatal en migración:', error);
    process.exit(1);
});
