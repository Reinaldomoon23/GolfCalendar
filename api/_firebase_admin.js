/* global process, Buffer */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'golfscorings-e4338';

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  return null;
}

export function getFirebaseAdminServices() {
  if (getApps().length === 0) {
    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) throw new Error('Firebase Admin no esta configurado en el servidor.');
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || PROJECT_ID,
    });
  }
  return { authAdmin: getAuth(), dbAdmin: getFirestore() };
}

export async function verifyBearerToken(authAdmin, authorizationHeader) {
  const token = String(authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    const error = new Error('Falta token de autenticacion.');
    error.statusCode = 401;
    throw error;
  }
  return authAdmin.verifyIdToken(token);
}

export function sendJson(res, status, payload) {
  return res.status(status).json(payload);
}
