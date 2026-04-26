/**
 * useTournaments Hook
 *
 * Manages tournament state: official tournaments from Firebase, custom tournaments,
 * merged tournament list, season filtering, and CRUD operations.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import tournamentsData from '../data/tournaments.json';
import {
  subscribeToOfficialTournaments,
  subscribeToCustomTournaments,
  subscribeToSharedTournaments,
  subscribeToSubscribedTournaments,
  addCustomTournament,
  updateCustomTournament,
  deleteCustomTournament,
  publishTournament,
  joinTournament,
  leaveTournament,
  normalizeUserTournaments,
  mergeTournaments,
  filterBySeason,
  getAvailableSeasons,
} from '../services/tournaments.service';
import { deleteResult } from '../services/results.service';

/**
 * @param {object|null} user - Active user profile
 * @param {object} preferences - User preferences (for group/hidden filtering)
 * @param {Function} handleUpdatePreferences - Callback to update hidden tournament IDs
 * @param {object} results - Current results map (to delete result when tournament is deleted)
 * @returns {{
 *   tournaments: object[],
 *   filteredTournaments: object[],
 *   customTournaments: object[],
 *   currentSeason: string,
 *   setCurrentSeason: Function,
 *   availableSeasons: string[],
 *   handleAddTournament: Function,
 *   handleUpdateTournament: Function,
 *   handleDeleteTournament: Function,
 * }}
 */
export function useTournaments(user, preferences, handleUpdatePreferences, results) {
  const [baseTournaments, setBaseTournaments] = useState(tournamentsData);
  const [customTournaments, setCustomTournaments] = useState([]);
  const [sharedTournaments, setSharedTournaments] = useState([]); // Community ones
  const [subscribedTournaments, setSubscribedTournaments] = useState([]); // Subscribed via reference
  const [currentSeason, setCurrentSeason] = useState('2026');
  const [availableSeasons, setAvailableSeasons] = useState(['2026']);
  const hasNormalized = useRef(false);

  // ─── Subscribe to official tournaments ────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToOfficialTournaments(setBaseTournaments);
    return () => unsub();
  }, []);

  // ─── Subscribe to user's custom tournaments ───────────────────────────────
  useEffect(() => {
    if (!user?.username) return;
    const unsub = subscribeToCustomTournaments(user, setCustomTournaments);
    return () => unsub();
  }, [user?.username]);

  // ─── Normalization (Migration) ─────────────────────────────────────────────
  useEffect(() => {
    if (user && customTournaments.length > 0 && results && !hasNormalized.current) {
      hasNormalized.current = true;
      normalizeUserTournaments(user, customTournaments, results);
    }
  }, [user?.username, customTournaments.length, !!results]);

  // ─── Subscribe to shared community tournaments ────────────────────────────
  useEffect(() => {
    const unsub = subscribeToSharedTournaments((shared) => {
      // Filter out own shared tournaments to avoid double rendering with custom
      const othersShared = shared.filter(t => t.sharedBy !== user?.username && t.sharedBy !== user?.uid);
      setSharedTournaments(othersShared);
    });
    return () => unsub();
  }, [user?.username]);

  // ─── Subscribe to tournaments the user has joined (reference model) ───────
  useEffect(() => {
    if (!user?.username) return;
    const unsub = subscribeToSubscribedTournaments(user, setSubscribedTournaments);
    return () => unsub();
  }, [user?.username]);

  // ─── Merge official + custom + subscribed + orphan results ──────────────
  const tournaments = useMemo(() => {
    // Start with the standard merge (official + custom)
    let merged = mergeTournaments(baseTournaments, customTournaments, preferences, user);

    // Inject subscribed tournaments that aren't already in the list
    subscribedTournaments.forEach(st => {
      const alreadyPresent = merged.some(t => String(t.id) === String(st.id));
      if (!alreadyPresent) merged.push(st);
    });

    // BOMB-PROOF: If there are results for an ID that isn't in our list yet (Injected Hashtags)
    // we create a "virtual" tournament card so the user can see their strokes immediately.
    if (results) {
      Object.keys(results).forEach((resId) => {
        const alreadyExists = merged.some(t => String(t.id) === String(resId));
        
        // If it's a 8-char Hashtag and doesn't exist, create it
        if (!alreadyExists && String(resId).length === 8) {
          const resData = results[resId];
          merged.push({
            id: resId,
            name: resData.tournamentName || "Torneo Centralizado",
            dates: resData.dates || "Fecha oficial",
            course: resData.course || "Campo oficial",
            type: 'official',
            isInjected: true,
            groups: ['central']
          });
        }
      });
    }

    return merged;
  }, [baseTournaments, customTournaments, subscribedTournaments, preferences, user?.username, results]);

  // ─── Available seasons ────────────────────────────────────────────────────
  useEffect(() => {
    setAvailableSeasons(getAvailableSeasons(tournaments));
  }, [tournaments.length]);

  // ─── Filtered by season ───────────────────────────────────────────────────
  const filteredTournaments = useMemo(
    () => filterBySeason(tournaments, currentSeason),
    [tournaments, currentSeason]
  );

  // ─── CRUD handlers ────────────────────────────────────────────────────────

  const handleAddTournament = async (newT, shouldPublish = false) => {
    if (!user) return;
    await addCustomTournament(user, newT);
    if (shouldPublish) {
      await publishTournament(user, newT);
    }
  };

  // Join a shared tournament (reference model — does NOT copy, stays in sync)
  const handleJoinTournament = async (tournament) => {
    if (!user) return;
    await joinTournament(user, tournament);
  };

  // Leave a shared tournament
  const handleLeaveTournament = async (tournamentId) => {
    if (!user) return;
    await leaveTournament(user, tournamentId);
  };

  const handleUpdateTournament = async (updatedT) => {
    if (!user) return;
    await updateCustomTournament(user, updatedT);
  };

  const handleDeleteTournament = async (id) => {
    const isCustom = customTournaments.some((t) => String(t.id) === String(id));

    if (isCustom) {
      if (user) await deleteCustomTournament(user, id);
    } else {
      const newHidden = [...(preferences.hiddenIds || []), id];
      handleUpdatePreferences(null, newHidden);
    }

    if (results[id] && user) {
      await deleteResult(user, id);
    }
  };

  return {
    baseTournaments,
    tournaments,
    filteredTournaments,
    customTournaments,
    subscribedTournaments,
    currentSeason,
    setCurrentSeason,
    availableSeasons,
    handleAddTournament,
    handleUpdateTournament,
    handleDeleteTournament,
    handleJoinTournament,
    handleLeaveTournament,
    sharedTournaments, // Export for discovery modal
  };
}
