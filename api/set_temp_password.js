import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'golfscorings-e4338';

function parseServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (rawJson) {
    return JSON.parse(rawJson);
  }

  if (rawBase64) {
    return JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8'));
  }

  if (
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw new Error('Firebase Admin no esta configurado en el servidor.');
  }

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || PROJECT_ID,
  });
}

function sendJson(res, status, payload) {
  return res.status(status).json(payload);
}

function normalizePassword(value) {
  const password = String(value || '').trim();
  if (password.length < 8) {
    const error = new Error('La contraseña temporal debe tener al menos 8 caracteres.');
    error.statusCode = 400;
    throw error;
  }
  return password;
}

async function assertAdmin(db, authAdmin, authorizationHeader) {
  const token = String(authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    const error = new Error('Falta token de autenticacion.');
    error.statusCode = 401;
    throw error;
  }

  const decoded = await authAdmin.verifyIdToken(token);
  const adminDoc = await db.collection('users').doc(decoded.uid).get();
  const adminData = adminDoc.exists ? adminDoc.data() : null;

  if (adminData?.role !== 'admin') {
    const error = new Error('Solo un administrador puede asignar contraseñas temporales.');
    error.statusCode = 403;
    throw error;
  }

  return decoded;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Metodo no permitido.' });
  }

  try {
    getAdminApp();
    const authAdmin = getAuth();
    const db = getFirestore();
    const admin = await assertAdmin(db, authAdmin, req.headers.authorization);

    const { uid, password } = req.body || {};
    const targetUid = String(uid || '').trim();
    if (!targetUid) {
      return sendJson(res, 400, { error: 'Falta uid del usuario.' });
    }

    const temporaryPassword = normalizePassword(password);

    await authAdmin.updateUser(targetUid, {
      password: temporaryPassword,
    });

    await db.collection('users').doc(targetUid).set({
      temporary_password_assigned_at: new Date().toISOString(),
      temporary_password_assigned_by: admin.uid,
      must_change_password: true,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    return sendJson(res, 200, {
      ok: true,
      uid: targetUid,
    });
  } catch (error) {
    console.error('[set_temp_password] Error:', error);
    return sendJson(res, error.statusCode || 500, {
      error: error.message || 'Error asignando contraseña temporal.',
    });
  }
}
