/**
 * UserDataContext - User Data Management
 *
 * Provides:
 * - Results management (CRUD operations)
 * - Tournaments data and filtering
 * - User preferences
 * - Real-time Firestore synchronization
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { useTournaments } from '../hooks/useTournaments';
import { getUserDocId } from '../utils/userProfiles';
import {
  subscribeToPreferences,
  subscribeToResults,
  saveResult,
  saveAllResults,
  deleteResult,
  savePreferences
} from '../services/results.service';
import {
  updateParticipantScore,
  isSharedTournamentId,
} from '../services/leaderboard.service';

const UserDataContext = createContext(null);

export function UserDataProvider({ children }) {
  const {
    user,
    results,
    setResults,
    customTournaments,
    setCustomTournaments,
    preferences,
    setPreferences,
  } = useAuthContext();

  const activeUserDocId = getUserDocId(user);

  // ── Preferences handlers ────────────────────────────────────────────────
  const handleUpdatePreferences = async (newGroups, newHiddenIds) => {
    const newPrefs = {
      ...preferences,
      groups: newGroups || preferences.groups,
      hiddenIds: newHiddenIds || preferences.hiddenIds,
    };
    setPreferences(newPrefs);
    if (user) {
      try {
        await savePreferences(user, newPrefs);
      } catch (err) {
        console.error('[prefs] Error saving:', err);
      }
    }
  };

  const handleUpdateTheme = async (orgName, color) => {
    const newPrefs = {
      ...preferences,
      themes: { ...preferences.themes, [orgName]: { bg: color, border: color } },
    };
    setPreferences(newPrefs);
    if (user) {
      try {
        await savePreferences(user, newPrefs);
      } catch (err) {
        console.error('[prefs] Error saving theme:', err);
      }
    }
  };

  // ── Tournaments hook ────────────────────────────────────────────────────
  const {
    tournaments,
    filteredTournaments,
    currentSeason,
    setCurrentSeason,
    availableSeasons,
    handleAddTournament,
    handleUpdateTournament,
    handleDeleteTournament,
  } = useTournaments(user, preferences, handleUpdatePreferences, results);

  // ── Results handlers ────────────────────────────────────────────────────
  const handleUpdateResults = async (newResults) => {
    setResults(newResults);
    if (!user) return;
    try {
      await saveAllResults(user, newResults);
    } catch (err) {
      console.error('[results] Error saving all results:', err);
    }
  };

  const handleSaveSpecificResult = async (id, data) => {
    if (!user) return;
    setResults((prev) => ({ ...prev, [id]: data }));
    await saveResult(user, id, data);
    // Silently sync to centralized leaderboard for shared tournaments
    if (isSharedTournamentId(id)) {
      updateParticipantScore(user, id, data).catch((err) =>
        console.warn('[leaderboard] Could not update participant score:', err)
      );
    }
  };

  const handleDeleteResult = async (id) => {
    if (!user) return;
    try {
      setResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await deleteResult(user, id);
    } catch (err) {
      console.error('[results] Error deleting result:', err);
    }
  };

  // ── Real-time sync: Results & Preferences ───────────────────────────────
  useEffect(() => {
    if (!user?.username || !activeUserDocId) return;

    const unsubPrefs = subscribeToPreferences(user, (data) => {
      setPreferences((prev) => ({ ...prev, ...data, themes: data.themes || {} }));
    });

    // Special case for user "jordi"
    if (user.username === 'jordi') {
      const meritHiddenIds = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 103, 104, 105, 110];
      setPreferences({ groups: ['club'], hiddenIds: meritHiddenIds, themes: {} });
    }

    // Special case for "mariaros" to hide Orden de Merito
    if (user.username?.toLowerCase() === 'mariaros' || user.full_name?.toLowerCase().includes('maria ros')) {
        const meritIdsToHide = [1, 5, 7, 10, 13, 18, 19, 20, 21, 24, 25, 26];
        setPreferences(prev => ({
            ...prev,
            hiddenIds: Array.from(new Set([...(prev.hiddenIds || []), ...meritIdsToHide]))
        }));
    }

    const unsubResults = subscribeToResults(user, setResults);

    return () => {
      unsubPrefs();
      unsubResults();
    };
  }, [activeUserDocId, user?.username]);

  const value = {
    // Tournaments
    tournaments,
    filteredTournaments,
    currentSeason,
    setCurrentSeason,
    availableSeasons,
    handleAddTournament,
    handleUpdateTournament,
    handleDeleteTournament,

    // Results
    results,
    handleUpdateResults,
    handleSaveSpecificResult,
    handleDeleteResult,

    // Preferences
    preferences,
    handleUpdatePreferences,
    handleUpdateTheme,

    // Custom tournaments
    customTournaments,
    setCustomTournaments,
  };

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within UserDataProvider');
  }
  return context;
}
