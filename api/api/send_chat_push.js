import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const PROJECT_ID = 'golfscorings-e4338';

function parseServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (rawJson) return JSON.parse(rawJson);
  if (rawBase64) return JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8'));
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  return null;
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

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

async function getAuthenticatedSender(authAdmin, authorizationHeader) {
  const token = String(authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    const error = new Error('Falta token de autenticacion.');
    error.statusCode = 401;
    throw error;
  }
  return authAdmin.verifyIdToken(token);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo no permitido.' });

  try {
    getAdminApp();
    const authAdmin = getAuth();
    const db = getFirestore();
    const messaging = getMessaging();
    const decoded = await getAuthenticatedSender(authAdmin, req.headers.authorization);

    const { chatId, recipientUid, senderName, body } = req.body || {};
    const cleanChatId = String(chatId || '').trim();
    const cleanRecipientUid = String(recipientUid || '').trim();
    const cleanBody = String(body || '').trim().slice(0, 180);

    if (!cleanChatId || !cleanRecipientUid || !cleanBody) {
      return sendJson(res, 400, { error: 'Faltan datos de notificacion.' });
    }

    const chatSnap = await db.collection('chats').doc(cleanChatId).get();
    const chat = chatSnap.exists ? chatSnap.data() : null;
    if (!chat || !Array.isArray(chat.members) || !chat.members.includes(decoded.uid) || !chat.members.includes(cleanRecipientUid)) {
      return sendJson(res, 403, { error: 'No puedes enviar notificaciones para este chat.' });
    }

    const tokensSnap = await db.collection('users').doc(cleanRecipientUid).collection('push_tokens').where('enabled', '==', true).get();
    const tokens = tokensSnap.docs
      .map((tokenDoc) => tokenDoc.data()?.token || tokenDoc.id)
      .filter(Boolean);

    if (tokens.length === 0) {
      return sendJson(res, 200, { ok: true, sent: 0 });
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: senderName ? `Mensaje de ${String(senderName).slice(0, 60)}` : 'Nuevo mensaje',
        body: cleanBody,
      },
      data: {
        chatId: cleanChatId,
        url: 'https://reinaldomoon.top/GolfTeam/friends',
        body: cleanBody,
      },
      webpush: {
        fcmOptions: {
          link: 'https://reinaldomoon.top/GolfTeam/friends',
        },
      },
    });

    const invalidTokens = [];
    response.responses.forEach((item, index) => {
      if (!item.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(item.error?.code)) {
        invalidTokens.push(tokens[index]);
      }
    });

    await Promise.all(invalidTokens.map((token) => (
      db.collection('users').doc(cleanRecipientUid).collection('push_tokens').doc(token).delete().catch(() => {})
    )));

    return sendJson(res, 200, {
      ok: true,
      sent: response.successCount,
      failed: response.failureCount,
      pruned: invalidTokens.length,
    });
  } catch (error) {
    console.error('[send_chat_push] Error:', error);
    return sendJson(res, error.statusCode || 500, {
      error: error.message || 'Error enviando push.',
    });
  }
}
