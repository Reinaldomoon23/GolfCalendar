/* global process, Buffer */
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getFirebaseAdminServices, sendJson, verifyBearerToken } from './_firebase_admin.js';

export const config = { api: { bodyParser: false } };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DEFAULT_PUBLIC_URL = 'https://pub-23c281cf1ae04def9102341cf7d87837.r2.dev';

function normalizeUsername(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 80);
}

function getR2Config() {
  const configValues = {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.VITE_R2_SECRET_ACCESS_KEY,
    endpoint: process.env.R2_ENDPOINT || process.env.VITE_R2_ENDPOINT,
    bucketName: process.env.R2_BUCKET_NAME || process.env.VITE_R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || DEFAULT_PUBLIC_URL,
  };
  if (!configValues.accessKeyId || !configValues.secretAccessKey || !configValues.endpoint || !configValues.bucketName) {
    const error = new Error('Cloudflare R2 no esta configurado en el servidor.');
    error.statusCode = 503;
    throw error;
  }
  return configValues;
}

async function readRawBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_PHOTO_BYTES) {
      const error = new Error('La imagen supera el limite de 5 MB.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function resolveTargetProfile(dbAdmin, username) {
  const usernameMapping = await dbAdmin.collection('usernames').doc(username).get();
  const mappedUid = usernameMapping.exists ? usernameMapping.data()?.uid : '';
  if (mappedUid) {
    const mappedProfile = await dbAdmin.collection('users').doc(mappedUid).get();
    if (mappedProfile.exists) return mappedProfile;
  }

  const directProfile = await dbAdmin.collection('users').doc(username).get();
  if (directProfile.exists) return directProfile;

  const querySnapshot = await dbAdmin.collection('users').where('username', '==', username).limit(1).get();
  return querySnapshot.empty ? null : querySnapshot.docs[0];
}

function assertCanUpdateProfile(actorProfile, decoded, targetProfile, targetUsername) {
  const actor = actorProfile.exists ? actorProfile.data() : {};
  const target = targetProfile.data();
  const isOwner = targetProfile.id === decoded.uid || target?.uid === decoded.uid;
  const isManager = Array.isArray(actor?.managed_users) && actor.managed_users.includes(targetUsername);
  const isAdmin = actor?.role === 'admin';
  if (!isOwner && !isManager && !isAdmin) {
    const error = new Error('No puedes cambiar la foto de este perfil.');
    error.statusCode = 403;
    throw error;
  }
}

function getPreviousR2Key(photoUrl, publicUrl) {
  try {
    const photo = new URL(String(photoUrl || ''));
    const base = new URL(publicUrl);
    if (photo.origin !== base.origin) return '';
    return decodeURIComponent(photo.pathname.replace(/^\/+/, ''));
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo no permitido.' });

  try {
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('image/jpeg')) {
      return sendJson(res, 415, { error: 'La foto debe enviarse como JPEG.' });
    }

    const username = normalizeUsername(req.query?.username);
    if (!username) return sendJson(res, 400, { error: 'Falta username valido.' });

    const { authAdmin, dbAdmin } = getFirebaseAdminServices();
    const decoded = await verifyBearerToken(authAdmin, req.headers.authorization);
    const [actorProfile, targetProfile] = await Promise.all([
      dbAdmin.collection('users').doc(decoded.uid).get(),
      resolveTargetProfile(dbAdmin, username),
    ]);
    if (!targetProfile) return sendJson(res, 404, { error: 'Perfil no encontrado.' });
    assertCanUpdateProfile(actorProfile, decoded, targetProfile, username);

    const body = await readRawBody(req);
    if (body.length === 0) return sendJson(res, 400, { error: 'La imagen esta vacia.' });

    const r2 = getR2Config();
    const client = new S3Client({
      region: 'auto',
      endpoint: r2.endpoint,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    });
    const canonicalKey = `${username}.jpg`;
    const canonicalUrl = `${r2.publicUrl.replace(/\/$/, '')}/${canonicalKey}`;
    const previousPhotoUrl = targetProfile.data()?.photo_url || '';
    const previousKey = getPreviousR2Key(previousPhotoUrl, r2.publicUrl);

    await client.send(new PutObjectCommand({
      Bucket: r2.bucketName,
      Key: canonicalKey,
      Body: body,
      ContentType: 'image/jpeg',
      CacheControl: 'no-cache, must-revalidate',
      Metadata: { username },
    }));

    const updatedAt = new Date().toISOString();
    await targetProfile.ref.set({
      photo_url: canonicalUrl,
      photo_updated_at: updatedAt,
      updated_at: updatedAt,
    }, { merge: true });

    let previousDeleted = false;
    if (previousKey && previousKey !== canonicalKey) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: r2.bucketName, Key: previousKey }));
        previousDeleted = true;
      } catch (deleteError) {
        console.warn('[upload_profile_photo] Previous photo cleanup failed:', deleteError.message);
      }
    }

    return sendJson(res, 200, {
      ok: true,
      photo_url: canonicalUrl,
      photo_updated_at: updatedAt,
      previous_deleted: previousDeleted,
    });
  } catch (error) {
    console.error('[upload_profile_photo] Error:', error);
    return sendJson(res, error.statusCode || 500, { error: error.message || 'Error subiendo la foto.' });
  }
}
