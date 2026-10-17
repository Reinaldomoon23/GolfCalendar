import fs from 'node:fs/promises';
import { Bytes, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, getProjectId } from './firebaseAdmin.js';

function parseArgs(argv) {
  const options = {
    file: '',
    apply: false,
    merge: false,
  };

  argv.forEach((arg) => {
    if (arg === '--apply') options.apply = true;
    if (arg === '--merge') options.merge = true;
    if (arg.startsWith('--file=')) options.file = arg.slice('--file='.length);
  });

  if (!options.file) {
    throw new Error('Falta --file=firestore_backups/firestore-backup-....json');
  }

  return options;
}

function deserializeValue(db, value) {
  if (Array.isArray(value)) return value.map((item) => deserializeValue(db, item));

  if (value && typeof value === 'object') {
    if (value.__type === 'Timestamp') {
      return new Timestamp(value.seconds, value.nanoseconds);
    }
    if (value.__type === 'GeoPoint') {
      return new GeoPoint(value.latitude, value.longitude);
    }
    if (value.__type === 'Bytes') {
      return Bytes.fromBase64String(value.base64);
    }
    if (value.__type === 'DocumentReference') {
      return db.doc(value.path);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deserializeValue(db, item)])
    );
  }

  return value;
}

async function readExistingCount(db, paths) {
  let existing = 0;
  for (let i = 0; i < paths.length; i += 30) {
    const chunk = paths.slice(i, i + 30);
    const snapshots = await db.getAll(...chunk.map((docPath) => db.doc(docPath)));
    existing += snapshots.filter((snapshot) => snapshot.exists).length;
  }
  return existing;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = getAdminDb();
  const backup = JSON.parse(await fs.readFile(options.file, 'utf8'));
  const documents = Array.isArray(backup.documents) ? backup.documents : [];

  if (backup.projectId && backup.projectId !== getProjectId()) {
    console.warn(`[restore] Aviso: backup de ${backup.projectId}, proyecto actual ${getProjectId()}`);
  }

  if (documents.length === 0) {
    throw new Error('El backup no contiene documentos.');
  }

  const paths = documents.map((document) => document.path);
  const existingCount = await readExistingCount(db, paths);

  console.log(`[restore] Archivo: ${options.file}`);
  console.log(`[restore] Creado: ${backup.createdAt || 'desconocido'}`);
  console.log(`[restore] Documentos en backup: ${documents.length}`);
  console.log(`[restore] Documentos que ya existen: ${existingCount}`);
  console.log(`[restore] Modo: ${options.apply ? 'APPLY' : 'DRY-RUN'}${options.merge ? ' + merge' : ''}`);

  if (!options.apply) {
    console.log('[restore] No se ha escrito nada. Ejecuta con --apply para restaurar.');
    return;
  }

  let written = 0;
  for (let i = 0; i < documents.length; i += 400) {
    const batch = db.batch();
    const chunk = documents.slice(i, i + 400);

    chunk.forEach((document) => {
      const documentRef = db.doc(document.path);
      const documentData = deserializeValue(db, document.data);
      if (options.merge) {
        batch.set(documentRef, documentData, { merge: true });
      } else {
        batch.set(documentRef, documentData);
      }
    });

    await batch.commit();
    written += chunk.length;
    console.log(`[restore] Escritos ${written}/${documents.length}`);
  }

  console.log(`[restore] OK: ${written} documentos restaurados`);
}

main().catch((error) => {
  console.error('[restore] ERROR:', error.message);
  process.exit(1);
});
