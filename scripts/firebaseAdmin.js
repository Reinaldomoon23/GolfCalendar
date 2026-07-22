import fs from 'node:fs';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_PROJECT_ID = 'golfscorings-e4338';

function resolveCredential() {
  const serviceAccountInput = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountInput) {
    const serviceAccount = serviceAccountInput.trim().startsWith('{')
      ? JSON.parse(serviceAccountInput)
      : JSON.parse(fs.readFileSync(serviceAccountInput, 'utf8'));
    return cert(serviceAccount);
  }

  return applicationDefault();
}

export function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: resolveCredential(),
      projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID,
    });
  }

  return getFirestore();
}

export function getProjectId() {
  return process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
}
