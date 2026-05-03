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
  const [subscribedIds, setSubscribedIds] = useState([]);
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
    const unsub = subscribeToSubscribedTournaments(user, (data, rawIds) => {
      setSubscribedTournaments(data);
      if (rawIds) setSubscribedIds(rawIds);
    });
    return () => unsub();
  }, [user?.username]);

  // ─── Merge ───────────────────────────────────────────────────────────────
  const tournaments = useMemo(() => {
    if (results) {
      Object.keys(results).forEach((resId) => {
        if (!isNaN(resId) || resId.length < 5) {
          const resData = results[resId];
          if (resData && resData.tournamentName && resData.tournamentDates) {
            const generateSlug = (name, dates) => {
              if (!name || !dates) return null;
              const slug = name.toLowerCase()
                  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]/g, "-")
                  .replace(/-+/g, "-")
                  .replace(/^-|-$/g, "");
              const dateStr = dates.replace(/[^0-9]/g, "");
              return `${slug}_${dateStr}`;
            };
            const newId = generateSlug(resData.tournamentName, resData.tournamentDates);
            if (newId && !results[newId]) {
              results[newId] = resData;
            }
          }
        }
      });
    }

    const cleanPreferences = { ...preferences };
    if (results && cleanPreferences.hiddenIds) {
      cleanPreferences.hiddenIds = cleanPreferences.hiddenIds.filter(id => !results[id] && !results[String(id)]);
    }

    let merged = mergeTournaments(baseTournaments, customTournaments, cleanPreferences, user);
    const hiddenIds = cleanPreferences?.hiddenIds || [];
    subscribedTournaments.forEach(st => {
      if (hiddenIds.includes(st.id) || hiddenIds.includes(String(st.id))) return;
      const alreadyPresent = merged.some(t => 
        String(t.id) === String(st.id) ||
        (t.name && st.name && t.name.toLowerCase() === st.name.toLowerCase() && t.dates === st.dates)
      );
      if (!alreadyPresent) merged.push(st);
    });
    if (results) {
      Object.keys(results).forEach((resId) => {
        const resData = results[resId];
        if (!resData) return;
        const alreadyExists = merged.some(t => 
          String(t.id) === String(resId) ||
          (t.name && resData.tournamentName && t.name.toLowerCase() === resData.tournamentName.toLowerCase() && t.dates === resData.tournamentDates)
        );
        if (!alreadyExists && String(resId).length === 8) {
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

    const seen = new Set();
    const uniqueMerged = [];
    merged.forEach(t => {
      const normalizeStr = (s) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").trim() : "";
      const key = `${normalizeStr(t.name)}_${normalizeStr(t.dates)}`;
      if (seen.has(key)) return;
      seen.add(key);
      uniqueMerged.push(t);
    });

    return uniqueMerged;
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
    
    if (preferences?.hiddenIds) {
      const isHidden = preferences.hiddenIds.some(id => String(id) === String(tournament.id));
      if (isHidden) {
        const newHidden = preferences.hiddenIds.filter(id => String(id) !== String(tournament.id));
        handleUpdatePreferences(null, newHidden);
      }
    }
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
    // Also remove from subscribed_tournaments to completely remove any duplicate link
    if (user && id) {
      await leaveTournament(user, id);
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
    subscribedIds,
  };
}
