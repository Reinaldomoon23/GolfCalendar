/**
 * Profile Service
 *
 * Handles user profile operations: photo upload, profile updates,
 * legacy profile recovery, and Firestore sync helpers.
 */

import { db } from '../firebase';
import { auth } from '../firebase';
import { getUserProfileRef } from '../utils/userProfiles';
import { IS_MULTI } from '../config/app';
import { setDoc } from 'firebase/firestore';

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
  if (!auth.currentUser) throw new Error('Debes iniciar sesion para cambiar la foto.');

  const jpeg = await convertProfilePhotoToJpeg(file);
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${API_BASE}/api/upload_profile_photo?username=${encodeURIComponent(user.username)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    },
    body: jpeg,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.photo_url) {
    throw new Error(payload.error || 'No se pudo subir la foto.');
  }

  await invalidateProfilePhotoCache(payload.photo_url, payload.photo_updated_at);
  return payload.photo_url;
}

async function convertProfilePhotoToJpeg(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
      element.src = objectUrl;
    });
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('No se pudo preparar la foto.')),
        'image/jpeg',
        0.86
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function invalidateProfilePhotoCache(photoUrl, photoUpdatedAt) {
  const url = String(photoUrl || '').trim();
  if (!url || !url.includes('.r2.dev/')) return false;

  const storageKey = 'golf_profile_photo_versions';
  let versions = {};
  try {
    versions = JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch {
    versions = {};
  }
  const nextVersion = String(photoUpdatedAt || url);
  if (versions[url] === nextVersion) return false;
  versions[url] = nextVersion;
  try {
    localStorage.setItem(storageKey, JSON.stringify(versions));
  } catch {
    // Cache invalidation still continues when localStorage is unavailable.
  }

  if ('caches' in window) {
    const cache = await caches.open('r2-profile-photos');
    await cache.delete(url);
  }
  return true;
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
