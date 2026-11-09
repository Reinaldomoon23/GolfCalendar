import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import process from 'node:process';

const PROJECT_ID = 'golfscorings-e4338';
const RFEG_ORIGIN = 'https://rfegolfstats.es';

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

export function getRfegAdminServices() {
  if (getApps().length === 0) {
    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
    initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id || PROJECT_ID });
  }
  return { auth: getAuth(), db: getFirestore() };
}

export async function verifyRfegRequestUser(authorizationHeader) {
  const token = String(authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    const error = new Error('AUTH_REQUIRED');
    error.statusCode = 401;
    throw error;
  }
  const { auth } = getRfegAdminServices();
  return auth.verifyIdToken(token);
}

export function getRfegOrigin() {
  return RFEG_ORIGIN;
}

function getEncryptionKey() {
  const encoded = String(process.env.RFEGSTATS_CREDENTIALS_KEY || '').trim();
  if (!encoded) {
    const error = new Error('RFEGSTATS_ENCRYPTION_KEY_MISSING');
    error.statusCode = 503;
    throw error;
  }
  const key = /^[a-f0-9]{64}$/i.test(encoded)
    ? Buffer.from(encoded, 'hex')
    : Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    const error = new Error('RFEGSTATS_ENCRYPTION_KEY_INVALID');
    error.statusCode = 503;
    throw error;
  }
  return key;
}

export function assertRfegEncryptionConfigured() {
  getEncryptionKey();
}

export function encryptRfegCredentials(credentials) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptRfegCredentials(encrypted) {
  if (encrypted?.version !== 1) throw new Error('RFEGSTATS_CREDENTIAL_VERSION_UNSUPPORTED');
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

function mergeSetCookies(cookieMap, headers) {
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : String(headers.get('set-cookie') || '').split(/,(?=\s*[^;,]+=)/g);
  setCookies.forEach((setCookie) => {
    const firstPart = String(setCookie).split(';', 1)[0];
    const separator = firstPart.indexOf('=');
    if (separator > 0) cookieMap.set(firstPart.slice(0, separator).trim(), firstPart.slice(separator + 1).trim());
  });
}

function cookieHeader(cookieMap) {
  return [...cookieMap.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

export async function rfegRequest(session, path, options = {}) {
  const target = new URL(path, RFEG_ORIGIN);
  if (target.origin !== RFEG_ORIGIN) throw new Error('RFEGSTATS_ORIGIN_REJECTED');
  const timeout = AbortSignal.timeout(20000);
  let response = await fetch(target, {
    ...options,
    headers: {
      'User-Agent': session.userAgent,
      ...(session.cookies.size ? { Cookie: cookieHeader(session.cookies) } : {}),
      ...(options.headers || {}),
    },
    redirect: 'manual',
    signal: timeout,
  });
  mergeSetCookies(session.cookies, response.headers);
  let redirects = 0;
  while (response.status >= 300 && response.status < 400 && response.headers.get('location') && redirects < 5) {
    const nextUrl = new URL(response.headers.get('location'), target).toString();
    if (new URL(nextUrl).origin !== RFEG_ORIGIN) throw new Error('RFEGSTATS_ORIGIN_REJECTED');
    response = await fetch(nextUrl, {
      headers: {
        'User-Agent': session.userAgent,
        Cookie: cookieHeader(session.cookies),
        ...(options.headers || {}),
      },
      redirect: 'manual',
      signal: timeout,
    });
    mergeSetCookies(session.cookies, response.headers);
    redirects += 1;
  }
  return response;
}

export async function createRfegStatsSession(username, password) {
  const cookieMap = new Map();
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

  const loginPage = await fetch(`${RFEG_ORIGIN}/`, {
    headers: { 'User-Agent': userAgent },
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  mergeSetCookies(cookieMap, loginPage.headers);

  const form = new URLSearchParams({ 'signin[username]': username, 'signin[password]': password });
  const loginResponse = await fetch(`${RFEG_ORIGIN}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
      'Referer': `${RFEG_ORIGIN}/`,
      ...(cookieMap.size ? { Cookie: cookieHeader(cookieMap) } : {}),
    },
    body: form,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  mergeSetCookies(cookieMap, loginResponse.headers);

  if (!cookieMap.size) {
    const error = new Error('RFEGSTATS_LOGIN_FAILED');
    error.statusCode = 401;
    throw error;
  }

  const session = { cookies: cookieMap, userAgent };
  const dashboard = await rfegRequest(session, '/estadisticas/dashboard');
  const body = await dashboard.text();

  const hasLoginForm = /name=["']signin\[username\]["']/i.test(body) || /<title>\s*RFEG\s*-\s*Login/i.test(body);
  const hasAuthenticatedNavigation = /href=["'][^"']*\/logout/i.test(body) && /Rondas|Resumen/i.test(body);
  if (!dashboard.ok || hasLoginForm || !hasAuthenticatedNavigation) {
    const error = new Error('RFEGSTATS_LOGIN_FAILED');
    error.statusCode = 401;
    throw error;
  }
  return session;
}

export async function validateRfegStatsLogin(username, password) {
  await createRfegStatsSession(username, password);
  return true;
}
