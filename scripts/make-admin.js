#!/usr/bin/env node

/**
 * Script para asignar rol admin a un usuario existente en Firestore.
 *
 * Uso:
 *   node scripts/make-admin.js email@ejemplo.com
 *   node scripts/make-admin.js username
 */

import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, query, updateDoc, where } from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase.js';

const app = initializeApp(firebaseConfig, 'make-admin-script');
const db = getFirestore(app);

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

async function findUser(identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const field = normalizedIdentifier.includes('@') ? 'email' : 'username';
  const snapshot = await getDocs(
    query(collection(db, 'users'), where(field, '==', normalizedIdentifier))
  );

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0];
}

async function makeAdmin(identifier) {
  const userDoc = await findUser(identifier);

  if (!userDoc) {
    throw new Error(`No se encontró ningún usuario para "${identifier}"`);
  }

  const userData = userDoc.data();
  const normalizedUsername = normalizeIdentifier(userData.username);

  await updateDoc(doc(db, 'users', userDoc.id), {
    role: 'admin',
    updated_at: new Date().toISOString()
  });

  console.log(`✅ Usuario actualizado a admin`);
  console.log(`   UID/docId: ${userDoc.id}`);
  console.log(`   Username: ${userData.username || '(sin username)'}`);
  console.log(`   Email: ${userData.email || '(sin email)'}`);

  if (normalizedUsername) {
    console.log(`   Acceso esperado: /admin con ${normalizedUsername}`);
  }
}

const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Uso: node scripts/make-admin.js email@ejemplo.com');
  process.exit(1);
}

makeAdmin(identifier)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`❌ Error al asignar rol admin: ${error.message}`);
    process.exit(1);
  });
