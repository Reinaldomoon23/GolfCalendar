/**
 * AuthContext - Authentication and Session Management
 *
 * Provides:
 * - User authentication state
 * - Session owner tracking
 * - Linked users management
 * - Login/Logout handlers
 * - User switching functionality
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { IS_MULTI, DEFAULT_PREFERENCES } from '../config/app';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // State that will be reset when switching users
  const [results, setResults] = useState({});
  const [customTournaments, setCustomTournaments] = useState([]);
  const [preferences, setPreferences] = useState({ ...DEFAULT_PREFERENCES });
  const [handicap, setHandicap] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Auth hook with callbacks
  const {
    user,
    setUser,
    sessionOwner,
    linkedUsers,
    setLinkedUsers,
    authReady,
    handleLogin,
    handleLogout,
    handleSwitchUser,
    handleReturnToOwner,
    resetSessionState,
  } = useAuth({
    setResults,
    setCustomTournaments,
    setPreferences,
    setHandicap,
    setPdfUrl,
  });

  const value = {
    // Auth state
    user,
    setUser,
    sessionOwner,
    linkedUsers,
    setLinkedUsers,
    authReady,

    // Auth handlers
    handleLogin,
    handleLogout,
    handleSwitchUser,
    handleReturnToOwner,
    resetSessionState,

    // User data state (managed by auth)
    results,
    setResults,
    customTournaments,
    setCustomTournaments,
    preferences,
    setPreferences,
    handicap,
    setHandicap,
    pdfUrl,
    setPdfUrl,

    // Derived state
    isMultiMode: IS_MULTI,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
