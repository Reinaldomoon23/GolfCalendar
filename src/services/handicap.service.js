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
import { setDoc, collection, addDoc, query, orderBy, onSnapshot, getDocs, writeBatch, doc } from 'firebase/firestore';
import { IS_MULTI } from '../config/app';
import { getUserDocId } from '../utils/userProfiles';
import { API_ENDPOINTS } from '../config/api';

const HANDICAP_API_BASE = API_ENDPOINTS.handicap;

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

  const url = `${HANDICAP_API_BASE}?license=${user.federation_id || ''}&t=${Date.now()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();

  return {
    handicap: data.handicap || null,
    pdfUrl: data.pdf_url || null,
    history: data.history || [],
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

  // Sync historical data to Firestore if it returned any
  if (result.history && result.history.length > 0 && getUserDocId(user)) {
    // We execute this in the background without blocking the return
    syncHistoricalDataToFirestore(user, result.history);
  }

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
  if (getUserDocId(user)) {
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

// ─── Handicap History (Firestore) ──────────────────────────────────────────────

/**
 * Syncs historical data to Firestore avoiding duplicates.
 */
export async function syncHistoricalDataToFirestore(user, fetchedHistory) {
  if (!user || !getUserDocId(user) || !Array.isArray(fetchedHistory) || fetchedHistory.length === 0) return;
  const docId = getUserDocId(user);
  
  try {
    const historyRef = collection(db, `users/${docId}/handicap_history`);
    
    // Get existing dates
    const snapshot = await getDocs(query(historyRef));
    const existingDates = new Set();
    snapshot.forEach(d => {
      if (d.data().date) existingDates.add(d.data().date);
    });

    const batch = writeBatch(db);
    let addedCount = 0;

    fetchedHistory.forEach(entry => {
      if (entry.date && !existingDates.has(entry.date)) {
        const newDocRef = doc(historyRef); // auto ID
        batch.set(newDocRef, {
          date: entry.date,
          handicap: parseFloat(entry.handicap) || null,
          source: entry.source || 'rfeg_pdf',
          tournament: entry.tournament || null,
          tournament_id: null,
          createdAt: new Date().toISOString(),
        });
        addedCount++;
        existingDates.add(entry.date);
      }
    });

    if (addedCount > 0) {
      await batch.commit();
      console.log(`[handicap-history] Synced ${addedCount} new historical entries to Firestore.`);
    }
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      console.error('[handicap-history] Failed to sync historical data:', err);
    } else {
      console.warn('[handicap-history] Permission denied to sync historical data.');
    }
  }
}

/**
 * Appends a new handicap history entry to Firestore.
 * Uses today's date as document ID to avoid duplicates on same day.
 *
 * @param {object} user - User profile
 * @param {object} entry - { date, handicap, source, tournament, tournament_id }
 * @returns {Promise<void>}
 */
export async function appendHandicapHistoryEntry(user, entry) {
  if (!user || !getUserDocId(user)) return;

  const docId = getUserDocId(user);
  const historyRef = collection(db, `users/${docId}/handicap_history`);

  try {
    await addDoc(historyRef, {
      date: entry.date,
      handicap: parseFloat(entry.handicap) || null,
      source: entry.source || 'rfeg_pdf',
      tournament: entry.tournament || null,
      tournament_id: entry.tournament_id || null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Silently handle permission errors - Firestore rules may not allow access yet
    if (err?.code === 'permission-denied') {
      console.warn('[handicap-history] Insufficient permissions to save history - update Firestore rules');
    } else {
      console.error('[handicap-history] Failed to append entry:', err);
    }
  }
}

/**
 * Subscribes to handicap history changes in Firestore.
 * Returns unsubscribe function.
 *
 * @param {object} user - User profile
 * @param {Function} callback - Called with array of history entries sorted by date (newest first)
 * @returns {Function} unsubscribe function
 */
export function subscribeToHandicapHistory(user, callback) {
  if (!user || !getUserDocId(user)) {
    callback([]);
    return () => {};
  }

  const docId = getUserDocId(user);
  const historyRef = collection(db, `users/${docId}/handicap_history`);
  const q = query(historyRef, orderBy('date', 'desc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(entries);
  }, (err) => {
    // Silently handle permission errors - Firestore rules may not allow access yet
    if (err?.code === 'permission-denied') {
      console.warn('[handicap-history] Insufficient permissions - waiting for rule update');
    } else {
      console.error('[handicap-history] Subscription error:', err);
    }
    callback([]);
  });

  return unsubscribe;
}

/**
 * Gets the most recent handicap history entry.
 * Used to check if handicap value changed.
 *
 * @param {array} history - Array of history entries
 * @returns {object|null}
 */
export function getMostRecentHistoryEntry(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  // History comes sorted by date desc, so first is most recent
  return history[0];
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
