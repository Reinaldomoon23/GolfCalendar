/**
 * useHandicap Hook
 *
 * Manages handicap state: loading from cache on user change,
 * manual refresh, and the 08:00 AM auto-refresh timer.
 */

import { useState, useEffect } from 'react';
import {
  refreshHandicap as svcRefreshHandicap,
  getHandicapFromCache,
  hasHandicapFreshCache,
  subscribeToHandicapHistory,
  appendHandicapHistoryEntry,
} from '../services/handicap.service';
import { writeSavedUser } from '../utils/cache';
import { IS_MULTI } from '../config/app';

/**
 * @param {object|null} user - Currently active user profile
 * @param {Function} setUser - State setter from useAuth (for updating cached fields on user)
 * @returns {{
 *   handicap: string|null,
 *   pdfUrl: string|null,
 *   isUpdatingHandicap: boolean,
 *   history: array,
 *   refreshHandicap: Function,
 *   handleHandicapButtonClick: Function,
 *   handleOpenHandicapPdf: Function,
 * }}
 */
export function useHandicap(user, setUser) {
  const [handicap, setHandicap] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isUpdatingHandicap, setIsUpdatingHandicap] = useState(false);
  const [history, setHistory] = useState([]);

  // ─── Apply cache to UI ────────────────────────────────────────────────────

  const applyCachedHandicap = (targetUser) => {
    const cached = getHandicapFromCache(targetUser);
    if (!cached) return false;
    setHandicap(cached.handicap);
    setPdfUrl(cached.pdfUrl);
    return true;
  };

  // ─── Main refresh function ────────────────────────────────────────────────

  const refreshHandicap = async ({ force = false, background = false } = {}) => {
    if (!user) return;

    if (!force && hasHandicapFreshCache(user)) {
      applyCachedHandicap(user);
      return;
    }

    if (!background) setIsUpdatingHandicap(true);

    try {
      const { handicap: h, pdfUrl: p, updatedUser } = await svcRefreshHandicap(user, { force });

      // Check if handicap changed and save to history
      const oldHandicap = handicap;
      if (h && h !== oldHandicap) {
        const today = new Date().toISOString().slice(0, 10);
        await appendHandicapHistoryEntry(user, {
          date: today,
          handicap: h,
          source: 'rfeg_pdf',
          tournament: null,
          tournament_id: null,
        });
      }

      setHandicap(h);
      setPdfUrl(p);
      setUser(updatedUser);
      if (IS_MULTI) writeSavedUser(updatedUser);
    } catch (err) {
      console.error('[handicap] Failed to fetch:', err);
      applyCachedHandicap(user);
    } finally {
      if (!background) setIsUpdatingHandicap(false);
    }
  };

  // ─── Subscribe to handicap history ────────────────────────────────────────

  useEffect(() => {
    if (!user?.username) {
      setHistory([]);
      return;
    }

    const unsubscribe = subscribeToHandicapHistory(user, (entries) => {
      setHistory(entries);
    });

    return () => unsubscribe();
  }, [user?.username]);

  // ─── Load from cache when user changes, then refresh if needed ──────────

  useEffect(() => {
    if (!user?.username) return;

    const hasCached = applyCachedHandicap(user);

    // If no cached data, fetch immediately; otherwise fetch in background
    if (!hasCached) {
      refreshHandicap({ force: true });
    } else {
      const timeoutId = window.setTimeout(() => {
        refreshHandicap({ background: true });
      }, 400);
      return () => window.clearTimeout(timeoutId);
    }
  }, [user?.username, user?.federation_id]);

  // ─── Auto-update at 08:00 AM ──────────────────────────────────────────────

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      if (now.getHours() === 8 && now.getMinutes() === 0) {
        refreshHandicap();
      }
    };
    const intervalId = setInterval(checkTime, 60000);
    return () => clearInterval(intervalId);
  }, [user]);

  // ─── Exposed handlers ─────────────────────────────────────────────────────

  const handleHandicapButtonClick = () => refreshHandicap({ force: true });

  const handleOpenHandicapPdf = (e) => {
    e.stopPropagation();
    if (pdfUrl) window.open(pdfUrl, '_blank');
  };

  return {
    handicap,
    setHandicap,
    pdfUrl,
    setPdfUrl,
    isUpdatingHandicap,
    history,
    refreshHandicap,
    handleHandicapButtonClick,
    handleOpenHandicapPdf,
  };
}
