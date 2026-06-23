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
  resolveCanonicalTournamentId,
} from '../services/tournaments.service';
import { deleteResult } from '../services/results.service';
import { buildLegacyTournamentId } from '../utils/tournamentIds';

const SEASONS_DATA = {
  '2026': () => import('../data/seasons/tournaments_2026.json').then(m => m.default),
  '2025': () => Promise.resolve([])
};

/**
 * @param {object|null} user - Active user profile
 */
export function useTournaments(user, preferences, handleUpdatePreferences, results, options = {}) {
  const isDisabled = options?.disabled === true;
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
    if (isDisabled) {
      setBaseTournaments([]);
      return;
    }
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
  }, [currentSeason, isDisabled]);

  // ─── Subscribe to official tournaments (Live overrides) ───────────────────
  useEffect(() => {
    if (isDisabled) return;
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
  }, [isDisabled]);

  // ─── Subscribe to user's custom tournaments ───────────────────────────────
  useEffect(() => {
    if (isDisabled) return;
    if (!user?.username) return;
    const unsub = subscribeToCustomTournaments(user, setCustomTournaments);
    return () => unsub();
  }, [user?.username, isDisabled]);

  // ─── Normalization (Migration) ─────────────────────────────────────────────
  useEffect(() => {
    if (isDisabled) return;
    if (user && customTournaments.length > 0 && results && !hasNormalized.current) {
      hasNormalized.current = true;
      normalizeUserTournaments(user, customTournaments, results);
    }
  }, [user?.username, customTournaments.length, !!results, isDisabled]);

  // ─── Subscribe to shared community tournaments ────────────────────────────
  useEffect(() => {
    if (isDisabled) return;
    const unsub = subscribeToSharedTournaments((shared) => {
      const othersShared = shared.filter(t => t.sharedBy !== user?.username && t.sharedBy !== user?.uid);
      setSharedTournaments(othersShared);
    });
    return () => unsub();
  }, [user?.username, user?.uid, isDisabled]);

  // ─── Subscribe to tournaments the user has joined ─────────────────────────
  useEffect(() => {
    if (isDisabled) return;
    if (!user?.username) return;
    const unsub = subscribeToSubscribedTournaments(user, (data, rawIds) => {
      setSubscribedTournaments(data);
      if (rawIds) setSubscribedIds(rawIds);
    });
    return () => unsub();
  }, [user?.username, isDisabled]);

  // ─── Merge ───────────────────────────────────────────────────────────────
  const tournaments = useMemo(() => {
    if (isDisabled) return [];
    if (results) {
      Object.keys(results).forEach((resId) => {
        if (!isNaN(resId) || resId.length < 5) {
          const resData = results[resId];
          if (resData && resData.tournamentName && resData.tournamentDates) {
            const newId = buildLegacyTournamentId(resData.tournamentName, resData.tournamentDates);
            if (newId && !results[newId]) {
              results[newId] = resData;
            }
          }
        }
      });
    }

    const cleanPreferences = { ...preferences };

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
  }, [baseTournaments, customTournaments, subscribedTournaments, preferences, user?.username, results, isDisabled]);

  useEffect(() => {
    if (isDisabled) {
      setAvailableSeasons(['2026', '2025']);
      return;
    }
    setAvailableSeasons(getAvailableSeasons(tournaments));
  }, [tournaments.length, isDisabled]);

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
    const canonicalId = resolveCanonicalTournamentId(id);
    const customTournament = customTournaments.find((t) =>
      String(t.id) === String(id) || String(t.id) === String(canonicalId)
    );

    if (customTournament) {
      if (user) await deleteCustomTournament(user, canonicalId);
      // DO NOT hide official tournaments if we just deleted a custom one with the same ID
    } else {
      const nextHidden = new Set((preferences.hiddenIds || []).map(String));
      nextHidden.add(String(canonicalId));
      if (id) nextHidden.add(String(id));
      await Promise.resolve(handleUpdatePreferences(null, Array.from(nextHidden)));
    }

    // Also remove from subscribed_tournaments to completely remove any duplicate link
    if (user && canonicalId) {
      await leaveTournament(user, canonicalId);
    }

    if ((results[id] || results[canonicalId]) && user) {
      await deleteResult(user, canonicalId);
      if (String(id) !== String(canonicalId) && results[id]) {
        await deleteResult(user, id);
      }
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
