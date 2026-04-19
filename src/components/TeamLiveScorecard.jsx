import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Info } from 'lucide-react';
import ProfileImage from './ProfileImage';
import {
    fetchUserProfileByUsername,
    getUserDocId,
    getUserSubdocRef
} from '../utils/userProfiles';
import { collection, onSnapshot } from 'firebase/firestore';
import tournamentsData from '../data/tournaments.json';
import { generateTournamentDeterministicId } from '../services/tournaments.service';

export default function TeamLiveScorecard() {
    const { id: eventId } = useParams();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const playersStr = searchParams.get('players');
    const playersList = playersStr ? playersStr.split(',') : [];

    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState({});
    const [tournament, setTournament] = useState(null);
    const [results, setResults] = useState({});
    const [error, setError] = useState(null);
    const [selectedRound, setSelectedRound] = useState(null);

    const CORE_PLAYERS = ['nicole', 'txell', 'ona', 'maria', 'sofia', 'adriana', 'mariaros', 'jordi'];

    // Fetch unified users info from Firestore
    useEffect(() => {
        const fetchUsers = async () => {
            const listToLoad = playersList.length > 0 ? playersList : CORE_PLAYERS;
            try {
                const matchedProfiles = {};
                for (const p of listToLoad) {
                    const profile = await fetchUserProfileByUsername(db, p);
                    if (profile) {
                        matchedProfiles[p] = profile;
                    }
                }
                setProfiles(matchedProfiles);
            } catch (err) {
                console.error("Error fetching user profiles from Firestore", err);
            }
        };
        fetchUsers();
    }, [playersStr]);

    // Fetch tournament (from one of the players, assume same data for now, or official)
    useEffect(() => {
        const listToLoad = playersList.length > 0 ? playersList : CORE_PLAYERS;
        if (listToLoad.length === 0) return;
        const mainPlayer = listToLoad[0];
        const mainPlayerProfile = profiles[mainPlayer];

        const fetchTournament = async () => {
            let foundTournament = null;
            
            try {
                // Try custom first for that player
                const customRef = getUserSubdocRef(db, mainPlayerProfile || mainPlayer, 'custom_tournaments', eventId);
                const customSnap = await getDoc(customRef);
                if (customSnap.exists()) {
                    foundTournament = { id: customSnap.id, ...customSnap.data() };
                }
            } catch (err) {
                /* ignore permission errors */
            }

            if (!foundTournament) {
                try {
                    // Try official
                    const offRef = doc(db, 'tournaments', eventId);
                    const offSnap = await getDoc(offRef);
                    if (offSnap.exists()) {
                        foundTournament = { id: offSnap.id, ...offSnap.data() };
                    }
                } catch (err) {
                    /* ignore permission errors */
                }
            }

            if (!foundTournament) {
                // Fallback basic
                foundTournament = { id: eventId, name: 'Torneo en Seguimiento' };
            }
            
            setTournament(foundTournament);
        };
        fetchTournament();
    }, [eventId, playersStr, profiles]);

    // Setup Realtime listeners for all requested players
    useEffect(() => {
        const unsubscribes = [];
        const listToLoad = playersList.length > 0 ? playersList : CORE_PLAYERS;

        listToLoad.forEach(player => {
            const playerProfile = profiles[player];
            
            // Listen to ALL results of the user to find by name match
            const resultsRef = collection(db, 'users', getUserDocId(playerProfile || player), 'results');
            
            const unsub = onSnapshot(resultsRef, (snap) => {
                const tournamentNameLower = (tournament?.name || '').toLowerCase().trim();
                
                let bestMatch = null;
                
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    const dName = (data.tournamentName || '').toLowerCase().trim();
                    const dId = doc.id;
                    
                    // Match by ID or by Name
                    const isIdMatch = (dId === eventId);
                    const isNameMatch = tournamentNameLower && dName.includes(tournamentNameLower);
                    const isReverseNameMatch = dName && tournamentNameLower.includes(dName);
                    
                    if (isIdMatch || isNameMatch || isReverseNameMatch) {
                        bestMatch = { id: dId, ...data };
                    }
                });

                if (bestMatch) {
                    // Salamanca par fix
                    if (bestMatch.scorecards) {
                        Object.keys(bestMatch.scorecards).forEach(ridx => {
                            const sc = bestMatch.scorecards[ridx];
                            if (sc.pars && sc.pars[14] === 5 && (bestMatch.tournamentCourse||'').toLowerCase().includes('salamanca forum')) {
                                sc.pars[14] = 4;
                            }
                        });
                    }
                    setResults(prev => ({ ...prev, [player]: bestMatch }));
                } else {
                    setResults(prev => ({ ...prev, [player]: null }));
                }
                setLoading(false);
            }, (err) => {
                console.error(`Error listening to ${player}:`, err);
                setLoading(false);
            });
            
            unsubscribes.push(unsub);
        });

        return () => unsubscribes.forEach(u => u());
    }, [eventId, playersStr, profiles, tournament?.name]);

    const getScoreColor = (strokes, par) => {
        if (!strokes || !par) return 'transparent';
        const diff = strokes - par;
        if (diff <= -2) return '#fcd34d'; // Eagle (Yellow)
        if (diff === -1) return '#ef4444'; // Birdie (Red)
        if (diff === 0) return '#94a3b8'; // Par (Gray shape)
        if (diff === 1) return '#0ea5e9'; // Bogey (Blue)
        if (diff >= 2) return '#1d4ed8'; // Double+ (Dark Blue)
        return 'transparent';
    };

    if (!playersStr) return <div>Faltan jugadores en el enlace (ej: ?players=nicole,maria)</div>;

    if (loading) return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
            color: '#f8fafc',
            fontFamily: '"Inter", -apple-system, sans-serif',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: -400px 0; }
                    100% { background-position: 400px 0; }
                }
                @keyframes livePulse {
                    0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
                    50% { opacity: 0.8; transform: scale(1.15); box-shadow: 0 0 0 8px rgba(16,185,129,0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .skeleton-block {
                    background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
                    background-size: 400px 100%;
                    animation: shimmer 1.4s infinite;
                    border-radius: 6px;
                }
            `}</style>

            {/* Header skeleton */}
            <div style={{
                background: '#1e293b',
                padding: '1rem',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        backgroundColor: '#10b981',
                        animation: 'livePulse 1.5s infinite'
                    }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.1em' }}>
                        CONECTANDO EN DIRECTO...
                    </span>
                </div>
                <div className="skeleton-block" style={{ width: '180px', height: '18px', marginTop: '4px' }} />
                <div className="skeleton-block" style={{ width: '120px', height: '13px' }} />
            </div>

            {/* Player skeleton cards */}
            <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                {(playersList.length > 0 ? playersList : ['', '']).map((_, idx) => (
                    <div key={idx} style={{
                        marginBottom: '3rem',
                        animation: `fadeInUp 0.5s ease ${idx * 0.15}s both`
                    }}>
                        {/* Player header skeleton */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            marginBottom: '1rem', paddingBottom: '0.75rem',
                            borderBottom: '2px solid #334155'
                        }}>
                            <div className="skeleton-block" style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
                            <div className="skeleton-block" style={{ width: '160px', height: '22px', borderRadius: '8px' }} />
                        </div>

                        {/* Scorecard skeleton */}
                        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '1.5rem' }}>
                            {/* Round header row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div className="skeleton-block" style={{ width: '80px', height: '20px' }} />
                                <div className="skeleton-block" style={{ width: '60px', height: '32px', borderRadius: '8px' }} />
                            </div>
                            {/* Two rows of holes */}
                            {[0, 1].map(row => (
                                <div key={row} style={{
                                    border: '1px solid #334155', borderRadius: '8px',
                                    overflow: 'hidden', marginBottom: '10px'
                                }}>
                                    <div style={{ display: 'flex', background: '#0f172a', padding: '8px 0', gap: '4px', justifyContent: 'space-around' }}>
                                        <div className="skeleton-block" style={{ width: '40px', height: '12px', margin: '0 4px' }} />
                                        {[...Array(9)].map((_, i) => (
                                            <div key={i} className="skeleton-block" style={{ flex: 1, height: '12px', margin: '0 2px' }} />
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', background: '#334155', padding: '8px 0', gap: '4px', justifyContent: 'space-around' }}>
                                        <div className="skeleton-block" style={{ width: '40px', height: '24px', margin: '0 4px', borderRadius: '4px' }} />
                                        {[...Array(9)].map((_, i) => (
                                            <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                                <div className="skeleton-block" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Spinner central */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '1rem', color: '#475569' }}>
                    <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        border: '2px solid #334155',
                        borderTopColor: '#10b981',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <span style={{ fontSize: '0.85rem' }}>Cargando datos en vivo...</span>
                    <div style={{ marginTop: '20px', fontSize: '0.75rem', opacity: 0.5 }}>v2.5.0</div>
                    <button 
                        onClick={() => window.location.reload(true)}
                        style={{ marginTop: '10px', background: '#334155', border: '1px solid #475569', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                        Reiniciar Cargar ↻
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
            color: '#f8fafc',
            fontFamily: '"Inter", -apple-system, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                background: '#1e293b',
                padding: '1rem',
                borderBottom: '1px solid #334155',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.1em' }}>MULTI-EN DIRECTO</span>
                </div>
                <h1 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>
                    {tournament?.name || 'Cargando Torneo...'}
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0 0' }}>{tournament?.course}</p>
                
                {/* Round Switcher Tabs */}
                {(() => {
                    const parseDateHelper = (dateStr) => {
                        if (!dateStr) return { days: 1 };
                        const parts = dateStr.split(' - ');
                        if (parts.length === 0) return { days: 1 };
                        const d1Part = parts[0].split('/');
                        const d2Part = parts.length > 1 ? parts[1].split('/') : d1Part;
                        const d1 = new Date(d1Part[2], d1Part[1] - 1, d1Part[0]).setHours(0, 0, 0, 0);
                        const d2 = new Date(d2Part[2], d2Part[1] - 1, d2Part[0]).setHours(0, 0, 0, 0);
                        return { days: Math.min(10, Math.max(1, Math.round((d2 - d1) / (24 * 60 * 60 * 1000)) + 1)) };
                    };
                    const numRounds = parseDateHelper(tournament?.dates || '').days;
                    if (numRounds <= 1) return null;
                    const rounds = Array.from({ length: numRounds }, (_, i) => String(i));
                    
                    return (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '4px' }}>
                            {rounds.map(rk => {
                                const isActive = (selectedRound === null && rk === '0') || selectedRound === rk;
                                return (
                                    <button
                                        key={rk}
                                        onClick={() => setSelectedRound(rk)}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            border: isActive ? '1px solid #3b82f6' : '1px solid #334155',
                                            background: isActive ? '#3b82f6' : '#1e293b',
                                            color: isActive ? 'white' : '#94a3b8',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        RONDA {parseInt(rk) + 1}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>

            <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
                {playersList.map(player => {
                    const result = results[player];
                    const profile = profiles[player] || { full_name: player };

                    return (
                        <div key={player} style={{ marginBottom: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #334155' }}>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ fontSize: '1.4rem', margin: 0, color: 'white' }}>{profile.full_name || profile.username || player}</h2>
                                    {profile.club && <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>{profile.club}</p>}
                                </div>
                            </div>
                            {(() => {
                                // Synthesize a dummy result if none exists yet, to allow showing empty rounds
                                let activeResult = result;
                                if (!activeResult && tournament) {
                                    activeResult = {
                                        tournamentName: tournament.name,
                                        tournamentCourse: tournament.course || tournament.location || '',
                                        tournamentDates: tournament.dates || '',
                                        tournamentPar: tournament.par || null,
                                        scorecards: {},
                                        rounds: {}
                                    };
                                }

                                if (!activeResult) {
                                    return (
                                        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '16px', textAlign: 'center', color: '#94a3b8' }}>
                                            <p>Todavía no hay resultados registrados para esta jugadora en este torneo.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div>
                                        {/* Render all rounds or just active? For multi, let's render all active rounds they have */}
                                        {(() => {
                                            const parseDateHelper = (dateStr) => {
                                                if (!dateStr) return { days: 1 };
                                                const parts = dateStr.split(' - ');
                                                if (parts.length === 0) return { days: 1 };
                                                const d1Part = parts[0].split('/');
                                                const d2Part = parts.length > 1 ? parts[1].split('/') : d1Part;
                                                const d1 = new Date(d1Part[2], d1Part[1] - 1, d1Part[0]).setHours(0, 0, 0, 0);
                                                const d2 = new Date(d2Part[2], d2Part[1] - 1, d2Part[0]).setHours(0, 0, 0, 0);
                                                return { days: Math.min(10, Math.max(1, Math.round((d2 - d1) / (24 * 60 * 60 * 1000)) + 1)) };
                                            };

                                            // Ensure scorecards exist
                                            if (!activeResult.scorecards) activeResult.scorecards = {};

                                            // Determine total expected rounds
                                            const dateInfo = parseDateHelper(tournament?.dates || '');
                                            const expectedRounds = dateInfo.days;

                                            const allPossibleKeys = new Set(Object.keys(activeResult.scorecards));
                                            for (let i = 0; i < expectedRounds; i++) allPossibleKeys.add(String(i));
                                            const roundsKeys = Array.from(allPossibleKeys).sort((a, b) => parseInt(a) - parseInt(b));

                                            if (roundsKeys.length === 0) return <p style={{ color: '#94a3b8', padding: '1rem' }}>Sin tarjetas.</p>;

                                            // Find active round
                                            const urlRoundRaw = searchParams.get('r') || searchParams.get('round');
                                            let activeRIdx = null;

                                            // 1. URL Parameter Priority
                                            if (urlRoundRaw !== null) {
                                                const requestedIdx = parseInt(urlRoundRaw);
                                                if (roundsKeys.includes(String(requestedIdx))) {
                                                    activeRIdx = String(requestedIdx);
                                                }
                                            }

                                            // 2. Logic-based detection
                                            if (activeRIdx === null) {
                                                activeRIdx = roundsKeys[0];
                                                for (let i = roundsKeys.length - 1; i >= 0; i--) {
                                                    const rIdx = roundsKeys[i];
                                                    const card = activeResult?.scorecards?.[rIdx];
                                                    if (!card) continue;
                                                    let playedHoles = 0;
                                                    let matchPars = true;
                                                    for (let h = 0; h < 18; h++) {
                                                        const s = String(card.strokes?.[h] || '');
                                                        const p = String(card.pars?.[h] || '');
                                                        if (s !== '' && s !== '-') playedHoles++;
                                                        if (s !== p) matchPars = false;
                                                    }
                                                    if ((playedHoles > 0 && !(playedHoles === 18 && matchPars)) || (activeResult?.rounds?.[parseInt(rIdx)] > 0)) {
                                                        activeRIdx = rIdx;
                                                        break;
                                                    }
                                                }
                                            }

                                            // 3. Fallback to last round available
                                            if (activeRIdx === null && roundsKeys.length > 0) {
                                                activeRIdx = roundsKeys[roundsKeys.length - 1];
                                            }

                                            // Calculate cumulative total for tournament
                                            let cumulativeScore = 0;
                                            let cumulativePar = 0;
                                            let totalHolesPlayed = 0;

                                            roundsKeys.forEach(key => {
                                                const sc = activeResult?.scorecards?.[key];
                                                if (!sc?.strokes) return;
                                                for (let i = 0; i < 18; i++) {
                                                    const strokeStr = String(sc.strokes?.[i] || '');
                                                    if (strokeStr !== '' && strokeStr !== '-') {
                                                        const s = parseInt(strokeStr);
                                                        if (!isNaN(s) && s > 0) {
                                                            cumulativeScore += s;
                                                            const p = parseInt(sc.pars?.[i]);
                                                            cumulativePar += (!isNaN(p) && p > 0 ? p : 4);
                                                            totalHolesPlayed++;
                                                        }
                                                    }
                                                }
                                            });

                                        const cumulativeDiff = cumulativeScore - cumulativePar;
                                        const cumulativeDiffStr = cumulativeDiff > 0 ? `+${cumulativeDiff}` : cumulativeDiff < 0 ? `${cumulativeDiff}` : 'E';
                                        const cumulativeDiffColor = cumulativeDiff > 0 ? '#ef4444' : cumulativeDiff < 0 ? '#10b981' : '#94a3b8';

                                        // Target Diff Logic
                                        let targetDiffRender = null;
                                        if (tournament?.target_score !== undefined && tournament?.target_score !== null) {
                                            const ts = parseInt(tournament.target_score);
                                            const tDiff = cumulativeDiff - ts;
                                            const tDiffStr = tDiff > 0 ? `+${tDiff}` : tDiff < 0 ? `${tDiff}` : 'E';
                                            const tDiffColor = tDiff > 0 ? '#ef4444' : tDiff < 0 ? '#10b981' : '#f1f5f9';
                                            targetDiffRender = (
                                                <div style={{ paddingLeft: '15px', borderLeft: '1px solid rgba(255,255,255,0.2)', marginLeft: '10px' }}>
                                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Obj ({ts > 0 ? `+${ts}` : ts})</div>
                                                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: tDiffColor }}>
                                                        {tDiffStr}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // If a specific round is selected globally, show only that.
                                        // Otherwise, show only the latest/active one to keep multi-view readable.
                                        const displayRounds = selectedRound !== null ? [selectedRound] : [activeRIdx];

                                        return (
                                            <>
                                                {((roundsKeys.length > 1 || targetDiffRender !== null) && totalHolesPlayed > 0) && (
                                                    <div style={{
                                                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                                                        borderRadius: '16px',
                                                        padding: '1.2rem',
                                                        marginBottom: '1.5rem',
                                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                                                        border: '1px solid #3b82f6'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem', fontWeight: '800' }}>
                                                                📊 TOTAL ACUMULADO
                                                            </h3>
                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                                    <span style={{ fontSize: '1.8rem', fontWeight: '900', color: 'white' }}>
                                                                        {cumulativeScore}
                                                                    </span>
                                                                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: cumulativeDiffColor }}>
                                                                        ({cumulativeDiffStr})
                                                                    </span>
                                                                </div>
                                                                {targetDiffRender}
                                                            </div>
                                                        </div>
                                                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '15px' }}>
                                                            <span>Par: {cumulativePar}</span>
                                                            <span>Hoyos: {totalHolesPlayed}/{roundsKeys.length * 18}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {displayRounds.map((rIdx) => {
                                            const roundStr = parseInt(rIdx);
                                            const card = activeResult?.scorecards?.[rIdx];

                                            let playedStrokes = 0;
                                            let playedPar = 0;
                                            let holesPlayed = 0;

                                            for (let i = 0; i < 18; i++) {
                                                const strokeStr = String(card.strokes?.[i] || '');
                                                if (strokeStr !== '' && strokeStr !== '-') {
                                                    const s = parseInt(strokeStr);
                                                    if (!isNaN(s) && s > 0) {
                                                        playedStrokes += s;
                                                        const p = parseInt(card.pars?.[i]);
                                                        playedPar += (!isNaN(p) && p > 0 ? p : 4);
                                                        holesPlayed++;
                                                    }
                                                }
                                            }

                                            const manualStrokesTotal = activeResult?.rounds?.[roundStr];
                                            const displayTotal = holesPlayed > 0 ? playedStrokes : manualStrokesTotal;

                                            let diffStr = 'E';
                                            let diffColor = '#94a3b8';

                                            if (holesPlayed > 0) {
                                                const diff = playedStrokes - playedPar;
                                                diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'E';
                                                diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#94a3b8';
                                            } else {
                                                if (!displayTotal || displayTotal === '') {
                                                    diffStr = '-';
                                                    diffColor = '#94a3b8';
                                                } else {
                                                    const totalPar = (card.pars || []).reduce((a, b) => a + (parseInt(b) || 0), 0) || 72;
                                                    const diff = displayTotal - totalPar;
                                                    diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'E';
                                                    diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#94a3b8';
                                                }
                                            }

                                            return (
                                                <div key={rIdx} style={{
                                                    background: '#1e293b',
                                                    borderRadius: '16px',
                                                    padding: '1.5rem',
                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                                        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>Ronda {roundStr + 1}</h3>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                            <span style={{ fontSize: '2rem', fontWeight: '900', color: 'white' }}>{displayTotal || '-'}</span>
                                                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: diffColor }}>
                                                                ({diffStr})
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Scorecard Table */}
                                                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '10px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            {/* First 9 Holes */}
                                                            <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '100%', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                                                                {/* Row: Headers */}
                                                                <div style={{ display: 'flex', background: '#0f172a', fontWeight: 'bold', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                                    <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', flexShrink: 0, textAlign: 'center', boxSizing: 'border-box' }}>Hoyo</div>
                                                                    {[...Array(9)].map((_, i) => (
                                                                        <div key={i} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                            {i + 1}
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Row: Score */}
                                                                <div style={{ display: 'flex', background: '#334155', fontSize: '1rem', fontWeight: 'bold' }}>
                                                                    <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #1e293b', flexShrink: 0, textAlign: 'center', color: 'white', boxSizing: 'border-box' }}>Score</div>
                                                                    {[...Array(9)].map((_, i) => {
                                                                        const stroke = card.strokes?.[i] || '';
                                                                        const par = parseInt(card.pars?.[i]) || 0;
                                                                        const scoreNum = parseInt(stroke);
                                                                        const isValidScore = stroke !== '' && stroke !== '-' && scoreNum > 0;
                                                                        const bgColor = isValidScore ? getScoreColor(scoreNum, par) : 'transparent';

                                                                        return (
                                                                            <div key={i} style={{
                                                                                flex: '1 1 0%',
                                                                                padding: '6px 2px',
                                                                                borderRight: i < 8 ? '1px solid #1e293b' : 'none',
                                                                                display: 'flex',
                                                                                justifyContent: 'center',
                                                                                alignItems: 'center',
                                                                                boxSizing: 'border-box',
                                                                                minWidth: 0
                                                                            }}>
                                                                                <div style={{
                                                                                    width: '24px',
                                                                                    height: '24px',
                                                                                    display: 'flex',
                                                                                    justifyContent: 'center',
                                                                                    alignItems: 'center',
                                                                                    borderRadius: bgColor !== 'transparent' && scoreNum - par <= 0 ? '50%' : '2px', // Circles for par or better, square for bogeys
                                                                                    backgroundColor: bgColor,
                                                                                    color: isValidScore ? 'white' : '#64748b',
                                                                                }}>
                                                                                    {stroke === '-' ? '' : stroke}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>

                                                            {/* Second 9 Holes */}
                                                            <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '100%', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                                                                <div style={{ display: 'flex', background: '#0f172a', fontWeight: 'bold', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                                    <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', flexShrink: 0, textAlign: 'center', boxSizing: 'border-box' }}>Hoyo</div>
                                                                    {[...Array(9)].map((_, i) => (
                                                                        <div key={i + 9} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                            {i + 10}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div style={{ display: 'flex', background: '#334155', fontSize: '1rem', fontWeight: 'bold' }}>
                                                                    <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #1e293b', flexShrink: 0, textAlign: 'center', color: 'white', boxSizing: 'border-box' }}>Score</div>
                                                                    {[...Array(9)].map((_, i) => {
                                                                        const stroke = card.strokes?.[i + 9] || '';
                                                                        const par = parseInt(card.pars?.[i + 9]) || 0;
                                                                        const scoreNum = parseInt(stroke);
                                                                        const isValidScore = stroke !== '' && stroke !== '-' && scoreNum > 0;
                                                                        const bgColor = isValidScore ? getScoreColor(scoreNum, par) : 'transparent';

                                                                        return (
                                                                            <div key={i + 9} style={{
                                                                                flex: '1 1 0%',
                                                                                padding: '6px 2px',
                                                                                borderRight: i < 8 ? '1px solid #1e293b' : 'none',
                                                                                display: 'flex',
                                                                                justifyContent: 'center',
                                                                                alignItems: 'center',
                                                                                boxSizing: 'border-box',
                                                                                minWidth: 0
                                                                            }}>
                                                                                <div style={{
                                                                                    width: '24px',
                                                                                    height: '24px',
                                                                                    display: 'flex',
                                                                                    justifyContent: 'center',
                                                                                    alignItems: 'center',
                                                                                    borderRadius: bgColor !== 'transparent' && scoreNum - par <= 0 ? '50%' : '2px', // Circles for par or better, square for bogeys
                                                                                    backgroundColor: bgColor,
                                                                                    color: isValidScore ? 'white' : '#64748b',
                                                                                }}>
                                                                                    {stroke === '-' ? '' : stroke}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        </>
                                        );
                                    })()}
                                </div>
                            );
                        })()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
