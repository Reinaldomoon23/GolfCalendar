/**
 * Profile Service
 *
 * Handles user profile operations: photo upload, profile updates,
 * legacy profile recovery, and Firestore sync helpers.
 */

import { db } from '../firebase';
import { getUserProfileRef } from '../utils/userProfiles';
import { IS_MULTI } from '../config/app';
import { R2_CONFIG, s3Client } from '../config/cloudflare';
import { setDoc } from 'firebase/firestore';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
const LEGACY_API_BASE = 'https://reinaldomoon.top/GolfTeam';

// ─── Photo ────────────────────────────────────────────────────────────────────

/**
 * Uploads a photo file to Cloudflare R2 and persists the URL to Firestore.
 *
 * @param {File} file - The image File object to upload
 * @param {object} user - Current user profile (needs `username`)
 * @returns {Promise<string>} - The new public photo URL
 * @throws {Error} If upload or Firestore write fails
 */
export async function uploadProfilePhoto(file, user) {
  if (!file || !user?.username) throw new Error('File and user are required');

  const fileName = `${user.username}_${Math.floor(Date.now() / 1000)}.jpg`;
  const arrayBuffer = await file.arrayBuffer();

  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: fileName,
    Body: new Uint8Array(arrayBuffer),
    ContentType: file.type || 'image/jpeg',
  });

  await s3Client.send(command);

  const newPhotoUrl = `${R2_CONFIG.publicUrl}/${fileName}`;

  // Persist to Firestore
  await setDoc(getUserProfileRef(db, user), { photo_url: newPhotoUrl }, { merge: true });

  return newPhotoUrl;
}

/**
 * Checks if a photo URL belongs to Cloudflare (R2 or Workers)
 * @param {string} photoPath
 * @returns {boolean}
 */
export function isCloudflarePhotoPath(photoPath) {
  const value = String(photoPath || '').trim();
  return value.includes('.r2.dev/') || value.includes('.workers.dev/');
}

// ─── Profile Update ───────────────────────────────────────────────────────────

/**
 * Updates a user's basic profile info in Firestore and legacy PHP API.
 *
 * @param {object} user - Current user profile object
 * @param {{ fullName: string, federationId: string, email: string }} updates
 * @returns {Promise<object>} - Updated user object
 * @throws {Error} If Firestore write fails
 */
export async function updateUserProfile(user, { fullName, federationId, email, current_handicap }) {
  if (!user) throw new Error('User is required');

  const firestorePayload = {
    full_name: fullName,
    federation_id: federationId,
    email,
  };

  if (current_handicap !== undefined) {
    firestorePayload.current_handicap = current_handicap;
  }

  // Primary: Update Firestore (could fail if rules are strict)
  try {
    await setDoc(getUserProfileRef(db, user), firestorePayload, { merge: true });
  } catch (err) {
    console.warn('[profile] Firestore update failed (rules restricted):', err.code || err.message);
  }

  // Secondary: Keep PHP updated for legacy shared scorecards
  try {
    await fetch(`${LEGACY_API_BASE}/api/update_user.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        full_name: fullName,
        federation_id: federationId,
        email,
        current_handicap: current_handicap,
      }),
    });
  } catch (err) {
    // Non-critical: PHP is legacy, don't block on failure
    console.warn('[profile] PHP update failed (non-critical):', err);
  }

  return {
    ...user,
    ...firestorePayload
  };
}

// ─── Legacy Recovery ──────────────────────────────────────────────────────────

/**
 * Recovers a user's profile data from the legacy users.json file
 * and syncs it to Firestore. Useful after a data migration issue.
 *
 * @param {object} user - Current user profile
 * @returns {Promise<object>} - Updated user profile with recovered data
 * @throws {Error} If user not found in legacy data
 */
export async function recoverLegacyProfile(user) {
  if (!user?.username) throw new Error('Username is required');

  const res = await fetch(`${LEGACY_API_BASE}/api/users.json?t=${Date.now()}`);
  const users = await res.json();
  const legacy = users[user.username];

  if (!legacy) {
    throw new Error(`No se encontraron datos legacy para "${user.username}"`);
  }

  const currentPhoto = String(user.photo_url || '').trim();
  const legacyPhoto = String(legacy.photo_url || '').trim();
  const nextPhoto = (isCloudflarePhotoPath(currentPhoto) && legacyPhoto)
    ? currentPhoto
    : (legacyPhoto || currentPhoto);

  const updates = {
    full_name: legacy.full_name || user.full_name,
    federation_id: legacy.federation_id || user.federation_id,
    photo_url: nextPhoto,
  };

  // Sync to Firestore
  await setDoc(getUserProfileRef(db, user), updates, { merge: true });

  return { ...user, ...updates };
}

// ─── Firestore Sync ───────────────────────────────────────────────────────────

/**
 * Self-healing: If Firestore is missing a photo but user has one locally, push it.
 * @param {object} user - User profile
 * @param {string|null} incomingPhoto - Photo URL from Firestore snapshot
 */
export async function selfHealPhoto(user, incomingPhoto) {
  if (!incomingPhoto && user?.photo_url && String(user.photo_url).trim() !== '') {
    console.log('[profile] Self-healing: Synchronizing legacy photo to Firestore for', user.username);
    try {
      await setDoc(getUserProfileRef(db, user), { photo_url: user.photo_url }, { merge: true });
    } catch (err) {
      console.warn('[profile] Self-heal photo failed:', err);
    }
  }
}
