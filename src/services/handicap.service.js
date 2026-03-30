/**
 * Handicap Service
 *
 * Handles fetching, caching, and persisting player handicap data.
 * Centralizes all handicap-related API calls and cache management.
 */

import { db } from '../firebase';
import { getUserProfileRef } from '../utils/userProfiles';
import {
  readHandicapCache,
  writeHandicapCache,
  isHandicapCacheFresh,
} from '../utils/cache';
import { setDoc } from 'firebase/firestore';
import { IS_MULTI } from '../config/app';
import { getUserDocId } from '../utils/userProfiles';

const HANDICAP_API_BASE = ''; // Internal Vercel relative path

// ─── Cache ────────────────────────────────────────────────────────────────────

/**
 * Attempts to load handicap from user object fields or localStorage cache.
 * @param {object} user - User profile object
 * @returns {{ handicap: string|null, pdfUrl: string|null }|null}
 *   Returns cached data or null if no valid cache found.
 */
export function getHandicapFromCache(user) {
  if (!user) return null;

  // First try fields directly in user profile (from Firestore sync)
  if (user.current_handicap || user.handicap_pdf_url || user.handicap_fetched_at) {
    return {
      handicap: user.current_handicap || null,
      pdfUrl: user.handicap_pdf_url || null,
    };
  }

  // Then try localStorage cache
  const cached = readHandicapCache(user);
  if (!cached) return null;

  return {
    handicap: cached.handicap || null,
    pdfUrl: cached.pdfUrl || null,
  };
}

/**
 * Checks if user has fresh handicap data (no need to refetch)
 * @param {object} user - User profile object
 * @returns {boolean}
 */
export function hasHandicapFreshCache(user) {
  if (!user) return false;
  const existingCache = readHandicapCache(user);
  const cachedFetchedAt = existingCache?.fetchedAt || user.handicap_fetched_at;
  return isHandicapCacheFresh(cachedFetchedAt);
}

// ─── API Fetch ────────────────────────────────────────────────────────────────

/**
 * Fetches the latest handicap data from the server API.
 * @param {object} user - User profile with `username` and optionally `federation_id`
 * @returns {Promise<{ handicap: string|null, pdfUrl: string|null, fetchedAt: number }>}
 * @throws {Error} If the API request fails
 */
export async function fetchHandicapFromServer(user) {
  if (!user?.username) throw new Error('User or username is required');

  const licenseParam = user.federation_id ? `&license=${user.federation_id}` : '';
  const url = `${HANDICAP_API_BASE}/api/get_handicap?username=${user.username}${licenseParam}&t=${Date.now()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();

  return {
    handicap: data.handicap || null,
    pdfUrl: data.pdf_url || null,
    fetchedAt: Date.now(),
  };
}

// ─── Main Flow ────────────────────────────────────────────────────────────────

/**
 * Refreshes the handicap for a user.
 * - If cache is fresh and `force` is false, returns cached data.
 * - Otherwise fetches from server, updates localStorage and Firestore.
 *
 * @param {object} user - Currently active user profile
 * @param {{ force?: boolean }} options
 * @returns {Promise<{
 *   handicap: string|null,
 *   pdfUrl: string|null,
 *   updatedUser: object
 * }>}
 */
export async function refreshHandicap(user, { force = false } = {}) {
  if (!user) throw new Error('No user provided');

  // Use cache if fresh (unless forced)
  if (!force && hasHandicapFreshCache(user)) {
    const cached = getHandicapFromCache(user);
    return {
      handicap: cached?.handicap ?? null,
      pdfUrl: cached?.pdfUrl ?? null,
      updatedUser: user,
    };
  }

  // Fetch from server
  const result = await fetchHandicapFromServer(user);

  // Update localStorage cache
  writeHandicapCache(user, result);

  // Build updated user object
  const updatedUser = {
    ...user,
    current_handicap: result.handicap,
    handicap_pdf_url: result.pdfUrl,
    handicap_fetched_at: result.fetchedAt,
  };

  // Persist to Firestore in background (fire-and-forget)
  if (IS_MULTI && getUserDocId(user)) {
    void setDoc(getUserProfileRef(db, user), {
      current_handicap: result.handicap,
      handicap_pdf_url: result.pdfUrl,
      handicap_fetched_at: new Date(result.fetchedAt).toISOString(),
    }, { merge: true });
  }

  return {
    handicap: result.handicap,
    pdfUrl: result.pdfUrl,
    updatedUser,
  };
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export function buildPdfUrl(username, federationId) {
  if (!federationId) return '';
  const matches = federationId.match(/(\d+)$/);
  if (matches && matches[1]) {
    const shortId = matches[1].slice(-6);
    return `https://api.rfeg.es/files/summaryhandicap/${parseInt(shortId, 10)}.pdf`;
  }
  return '';
}
