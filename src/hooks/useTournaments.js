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
  addCustomTournament,
  updateCustomTournament,
  deleteCustomTournament,
  publishTournament,
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

  // ─── Merge official + custom with filters ─────────────────────────────────
  const tournaments = useMemo(
    () => mergeTournaments(baseTournaments, customTournaments, preferences, user),
    [baseTournaments, customTournaments, preferences, user?.username]
  );

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
    currentSeason,
    setCurrentSeason,
    availableSeasons,
    handleAddTournament,
    handleUpdateTournament,
    handleDeleteTournament,
    sharedTournaments, // Export for discovery modal
  };
}
