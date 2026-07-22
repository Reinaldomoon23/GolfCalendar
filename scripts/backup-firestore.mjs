import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bytes, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, getProjectId } from './firebaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'firestore_backups');

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    collections: null,
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--out=')) options.outputDir = path.resolve(arg.slice('--out='.length));
    if (arg.startsWith('--collections=')) {
      options.collections = arg
        .slice('--collections='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
  });

  return options;
}

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function serializeValue(value) {
  if (value instanceof Timestamp) {
    return {
      __type: 'Timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }

  if (value instanceof GeoPoint) {
    return {
      __type: 'GeoPoint',
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (value instanceof Bytes) {
    return {
      __type: 'Bytes',
      base64: value.toBase64(),
    };
  }

  if (value?.path && value?.firestore) {
    return {
      __type: 'DocumentReference',
      path: value.path,
    };
  }

  if (Array.isArray(value)) return value.map(serializeValue);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)])
    );
  }

  return value;
}

async function exportCollection(collectionRef, documents) {
  const snapshot = await collectionRef.get();
  console.log(`[backup] ${collectionRef.path}: ${snapshot.size} docs`);

  for (const docSnap of snapshot.docs) {
    documents.push({
      path: docSnap.ref.path,
      data: serializeValue(docSnap.data()),
    });

    const subcollections = await docSnap.ref.listCollections();
    for (const subcollectionRef of subcollections) {
      await exportCollection(subcollectionRef, documents);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = getAdminDb();
  const projectId = getProjectId();
  const createdAt = new Date();
  const documents = [];

  const rootCollections = options.collections
    ? options.collections.map((collectionId) => db.collection(collectionId))
    : await db.listCollections();

  if (rootCollections.length === 0) {
    throw new Error('No se encontraron colecciones para exportar.');
  }

  console.log(`[backup] Proyecto: ${projectId}`);
  console.log(`[backup] Colecciones raiz: ${rootCollections.map((collectionRef) => collectionRef.id).join(', ')}`);

  for (const collectionRef of rootCollections) {
    await exportCollection(collectionRef, documents);
  }

  const payload = {
    schemaVersion: 1,
    projectId,
    createdAt: createdAt.toISOString(),
    rootCollections: rootCollections.map((collectionRef) => collectionRef.id),
    documentCount: documents.length,
    documents,
  };

  await fs.mkdir(options.outputDir, { recursive: true });
  const outputPath = path.join(options.outputDir, `firestore-backup-${timestampForFilename(createdAt)}.json`);
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));

  console.log(`[backup] OK: ${documents.length} documentos exportados`);
  console.log(`[backup] Archivo: ${outputPath}`);
}

main().catch((error) => {
  console.error('[backup] ERROR:', error.message);
  process.exit(1);
});
