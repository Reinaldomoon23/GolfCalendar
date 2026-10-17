/**
 * Cache Helpers
 *
 * Typed wrappers around localStorage for safe read/write operations.
 * Centralizes cache key management and serialization logic.
 */

import { HANDICAP_CACHE_KEY_PREFIX } from '../config/app';
import { getUserDocId } from './userProfiles';

// ─── Key Builders ─────────────────────────────────────────────────────────────

/**
 * Returns the localStorage key for a user's handicap cache
 * @param {object} userLike - User profile object or object with username
 * @returns {string} - Cache key or empty string if user has no identifier
 */
export function getHandicapCacheKey(userLike) {
  const suffix = getUserDocId(userLike) || userLike?.username || '';
  return suffix ? `${HANDICAP_CACHE_KEY_PREFIX}_${suffix}` : '';
}

// ─── Generic Helpers ──────────────────────────────────────────────────────────

/**
 * Safely reads and parses a value from localStorage
 * @param {string} key - localStorage key
 * @returns {any|null} - Parsed value or null if missing/invalid
 */
export function readCache(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Safely serializes and writes a value to localStorage
 * @param {string} key - localStorage key
 * @param {any} value - Value to store (must be JSON-serializable)
 */
export function writeCache(key, value) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[cache] Failed to write key "${key}":`, e);
  }
}

/**
 * Removes a key from localStorage
 * @param {string} key - localStorage key
 */
export function removeCache(key) {
  if (!key) return;
  localStorage.removeItem(key);
}

/**
 * Checks if a cache entry exists (regardless of content)
 * @param {string} key - localStorage key
 * @returns {boolean}
 */
export function hasCache(key) {
  return localStorage.getItem(key) !== null;
}

// ─── Handicap Cache ───────────────────────────────────────────────────────────

/**
 * Reads the handicap cache for a user
 * @param {object} userLike - User object
 * @returns {{ handicap: string|null, pdfUrl: string|null, fetchedAt: number }|null}
 */
export function readHandicapCache(userLike) {
  const key = getHandicapCacheKey(userLike);
  const cached = readCache(key);
  return cached && typeof cached === 'object' ? cached : null;
}

/**
 * Writes the handicap cache for a user
 * @param {object} userLike - User object
 * @param {{ handicap: string|null, pdfUrl: string|null, fetchedAt: number }} payload
 */
export function writeHandicapCache(userLike, payload) {
  const key = getHandicapCacheKey(userLike);
  writeCache(key, payload);
}

/**
 * Clears the handicap cache for a user
 * @param {object} userLike - User object
 */
export function clearHandicapCache(userLike) {
  const key = getHandicapCacheKey(userLike);
  removeCache(key);
}

/**
 * Determines if the handicap cache is still fresh
 * Cache is considered fresh if it was fetched after 08:00 today (or after midnight if before 08:00)
 * @param {number|string|object} fetchedAtValue - Timestamp of last fetch
 * @returns {boolean}
 */
export function isHandicapCacheFresh(fetchedAtValue) {
  const fetchedAt = normalizeTimestampToMs(fetchedAtValue);
  if (!fetchedAt) return false;

  const now = new Date();
  const todayAtEight = new Date(now);
  todayAtEight.setHours(8, 0, 0, 0);

  if (now < todayAtEight) {
    // Before 8am: fresh if fetched today at midnight or later
    return fetchedAt >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  // After 8am: fresh if fetched at or after 8am today
  return fetchedAt >= todayAtEight.getTime();
}

// ─── Session / User Cache ─────────────────────────────────────────────────────

const KEYS = {
  user: 'golf_tracker_user',
  linkedUsers: 'golf_tracker_linked_users',
  results: 'golf_tracker_results',
};

/** Reads the saved active user from localStorage */
export function readSavedUser() {
  return readCache(KEYS.user);
}

/** Saves the active user to localStorage */
export function writeSavedUser(user) {
  writeCache(KEYS.user, user);
}

/** Reads the saved linked users array */
export function readLinkedUsers() {
  return readCache(KEYS.linkedUsers) || [];
}

/** Saves linked users array to localStorage */
export function writeLinkedUsers(users) {
  writeCache(KEYS.linkedUsers, users);
}

/** Clears all session-related cache keys */
export function clearSessionCache() {
  removeCache(KEYS.user);
  removeCache(KEYS.linkedUsers);
  removeCache(KEYS.results);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Normalizes a timestamp value (number, ISO string, or Firestore Timestamp) to milliseconds
 * @param {number|string|object} value
 * @returns {number}
 */
function normalizeTimestampToMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return 0;
}
