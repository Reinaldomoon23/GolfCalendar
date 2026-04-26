/**
 * useTournaments Hook
 *
 * Manages tournament state: official tournaments from Firebase, custom tournaments,
 * merged tournament list, season filtering, and CRUD operations.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
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

const SEASONS_DATA = {
  '2026': () => import('../data/seasons/tournaments_2026.json').then(m => m.default),
  '2025': () => Promise.resolve([])
};

/**
 * @param {object|null} user - Active user profile
 */
export function useTournaments(user, preferences, handleUpdatePreferences, results) {
  const [baseTournaments, setBaseTournaments] = useState([]);
  const [customTournaments, setCustomTournaments] = useState([]);
  const [sharedTournaments, setSharedTournaments] = useState([]); 
  const [subscribedTournaments, setSubscribedTournaments] = useState([]); 
  const [currentSeason, setCurrentSeason] = useState('2026');
  const [availableSeasons, setAvailableSeasons] = useState(['2026', '2025']);
  const hasNormalized = useRef(false);

  // ─── Load base data based on season ───────────────────────────────────────
  useEffect(() => {
    const loadSeason = async () => {
      try {
        const loader = SEASONS_DATA[currentSeason];
        if (loader) {
          const data = await loader();
          setBaseTournaments(data);
        } else {
          setBaseTournaments([]);
        }
      } catch (e) {
        console.error(`Failed to load tournaments for season ${currentSeason}`, e);
        setBaseTournaments([]);
      }
    };
    loadSeason();
  }, [currentSeason]);

  // ─── Subscribe to official tournaments (Live overrides) ───────────────────
  useEffect(() => {
    const unsub = subscribeToOfficialTournaments((liveTournaments) => {
      setBaseTournaments(prev => {
        const merged = [...prev];
        liveTournaments.forEach(lt => {
          const idx = merged.findIndex(t => String(t.id) === String(lt.id));
          if (idx !== -1) merged[idx] = lt;
          else merged.push(lt);
        });
        return merged;
      });
    });
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
      const othersShared = shared.filter(t => t.sharedBy !== user?.username && t.sharedBy !== user?.uid);
      setSharedTournaments(othersShared);
    });
    return () => unsub();
  }, [user?.username]);

  // ─── Subscribe to tournaments the user has joined ─────────────────────────
  useEffect(() => {
    if (!user?.username) return;
    const unsub = subscribeToSubscribedTournaments(user, setSubscribedTournaments);
    return () => unsub();
  }, [user?.username]);

  // ─── Merge ───────────────────────────────────────────────────────────────
  const tournaments = useMemo(() => {
    let merged = mergeTournaments(baseTournaments, customTournaments, preferences, user);
    subscribedTournaments.forEach(st => {
      const alreadyPresent = merged.some(t => String(t.id) === String(st.id));
      if (!alreadyPresent) merged.push(st);
    });
    if (results) {
      Object.keys(results).forEach((resId) => {
        const alreadyExists = merged.some(t => String(t.id) === String(resId));
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

  useEffect(() => {
    setAvailableSeasons(getAvailableSeasons(tournaments));
  }, [tournaments.length]);

  const filteredTournaments = useMemo(
    () => filterBySeason(tournaments, currentSeason),
    [tournaments, currentSeason]
  );

  const handleAddTournament = async (newT, shouldPublish = false) => {
    if (!user) return;
    await addCustomTournament(user, newT);
    if (shouldPublish) {
      await publishTournament(user, newT);
    }
  };

  const handleJoinTournament = async (tournament) => {
    if (!user) return;
    await joinTournament(user, tournament);
  };

  const handleLeaveTournament = async (tournamentId) => {
    if (!user) return;
    await leaveTournament(user, tournamentId);
  };

  const handleUpdateTournament = async (updatedT) => {
    if (!user) return;
    await updateCustomTournament(user, updatedT);
  };

  const handleDeleteTournament = async (id) => {
    const customTournament = customTournaments.find((t) => String(t.id) === String(id));
    if (customTournament) {
      if (user) await deleteCustomTournament(user, id);
      // DO NOT hide official tournaments if we just deleted a custom one with the same ID
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
    sharedTournaments,
  };
}
