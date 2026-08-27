import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getAdminDb } from './firebaseAdmin.js';
import { CANONICAL_PROFILE_PHOTO_FILES } from '../src/utils/profilePhotos.js';

const applyChanges = process.argv.includes('--apply');
const confirmed = process.argv.includes('--yes');
const minimumAgeDays = Number(process.env.R2_ORPHAN_MIN_AGE_DAYS || 7);
const publicUrl = process.env.R2_PUBLIC_URL
  || 'https://pub-23c281cf1ae04def9102341cf7d87837.r2.dev';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}.`);
  return value;
}

function normalizeUsername(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 80);
}

function keyFromPublicUrl(value) {
  try {
    const candidate = new URL(String(value || ''));
    const base = new URL(publicUrl);
    return candidate.origin === base.origin
      ? decodeURIComponent(candidate.pathname.replace(/^\/+/, ''))
      : '';
  } catch {
    return '';
  }
}

async function listAllObjects(client, bucketName) {
  const objects = [];
  let continuationToken;
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    }));
    objects.push(...(response.Contents || []));
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

const client = new S3Client({
  region: 'auto',
  endpoint: requireEnv('R2_ENDPOINT'),
  credentials: {
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  },
});
const bucketName = requireEnv('R2_BUCKET_NAME');
const db = getAdminDb();
const usersSnapshot = await db.collection('users').get();
const protectedKeys = new Set(Object.values(CANONICAL_PROFILE_PHOTO_FILES));

for (const userDoc of usersSnapshot.docs) {
  const profile = userDoc.data();
  const referencedKey = keyFromPublicUrl(profile.photo_url);
  if (referencedKey) protectedKeys.add(referencedKey);
  const username = normalizeUsername(profile.username);
  if (username) protectedKeys.add(`${username}.jpg`);
}

const objects = await listAllObjects(client, bucketName);
const cutoff = Date.now() - minimumAgeDays * 24 * 60 * 60 * 1000;
const orphaned = objects.filter((object) => {
  if (!object.Key || protectedKeys.has(object.Key)) return false;
  if (!/\.(?:jpe?g|png|webp|gif)$/i.test(object.Key)) return false;
  return !object.LastModified || object.LastModified.getTime() < cutoff;
});

console.log(JSON.stringify({
  mode: applyChanges ? 'apply' : 'dry-run',
  bucket: bucketName,
  users: usersSnapshot.size,
  totalObjects: objects.length,
  protectedObjects: protectedKeys.size,
  orphanCandidates: orphaned.length,
  minimumAgeDays,
}, null, 2));

for (const object of orphaned) {
  console.log(`${object.Key}\t${object.Size || 0}\t${object.LastModified?.toISOString() || 'unknown'}`);
}

if (applyChanges && !confirmed) {
  throw new Error('Para borrar, repite con --apply --yes despues de revisar el dry-run.');
}

if (applyChanges) {
  for (const object of orphaned) {
    await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: object.Key }));
  }
  console.log(`Eliminados ${orphaned.length} objetos huerfanos.`);
}
