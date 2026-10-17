/**
 * Profile Service
 *
 * Handles user profile operations: photo upload, profile updates,
 * legacy profile recovery, and Firestore sync helpers.
 */

import { auth, db } from '../firebase';
import { getUserProfileRef } from '../utils/userProfiles';
import { getDoc, setDoc } from 'firebase/firestore';

const MAX_AVATAR_BYTES = 700 * 1024;
const MAX_AVATAR_DIMENSION = 320;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('El navegador no puede procesar la imagen'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo comprimir la imagen'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.82);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('El archivo no es una imagen válida'));
    };
    image.src = objectUrl;
  });
}

// ─── Photo ────────────────────────────────────────────────────────────────────

/**
 * Compresses a photo in the browser and persists it as a small data URL in
 * the authenticated user's Firestore profile. This keeps avatar uploads
 * compatible with Firebase Spark, without requiring Firebase Storage.
 *
 * @param {File} file - The image File object to upload
 * @param {object} user - Current user profile (needs `username`)
 * @returns {Promise<string>} - The new public photo URL
 * @throws {Error} If upload or Firestore write fails
 */
export async function uploadProfilePhoto(file, user) {
  if (!file || !user?.username) throw new Error('File and user are required');
  if (!auth.currentUser?.uid) throw new Error('Debes iniciar sesión para subir una foto');
  if (!file.type?.startsWith('image/')) throw new Error('Selecciona un archivo de imagen');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen no puede superar 5 MB');

  const compressedAvatar = await resizeAvatar(file);
  if (compressedAvatar.size > MAX_AVATAR_BYTES) {
    throw new Error('La imagen comprimida sigue siendo demasiado grande');
  }
  const newPhotoUrl = await readFileAsDataUrl(compressedAvatar);

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
export async function updateUserProfile(user, { fullName, federationId, email, current_handicap, club }) {
  if (!user) throw new Error('User is required');

  const firestorePayload = {
    full_name: fullName,
    federation_id: federationId,
    email,
  };

  if (current_handicap !== undefined) {
    firestorePayload.current_handicap = current_handicap;
  }
  if (club !== undefined) {
    firestorePayload.club = club;
  }

  await setDoc(getUserProfileRef(db, user), firestorePayload, { merge: true });

  return {
    ...user,
    ...firestorePayload
  };
}

// ─── Legacy Recovery ──────────────────────────────────────────────────────────

/**
 * Reloads the authenticated user's profile from Firestore without consulting
 * the legacy public JSON file.
 *
 * @param {object} user - Current user profile
 * @returns {Promise<object>} - Updated user profile with recovered data
 * @throws {Error} If user not found in legacy data
 */
export async function recoverLegacyProfile(user) {
  if (!user?.username) throw new Error('Username is required');

  const snapshot = await getDoc(getUserProfileRef(db, user));
  if (!snapshot.exists()) throw new Error('No se encontró el perfil en Firebase');
  return { ...user, ...snapshot.data() };
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
