import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Info } from 'lucide-react';

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

    // Fetch unified users info
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const baselink = import.meta.env.BASE_URL.replace(/\/$/, '');
                const res = await fetch(`${baselink}/api/users.json?t=${Date.now()}`);
                const data = await res.json();
                
                const matchedProfiles = {};
                playersList.forEach(p => {
                    if (data[p]) matchedProfiles[p] = data[p];
                });
                setProfiles(matchedProfiles);
            } catch (err) {
                console.error("Error fetching user profiles", err);
            }
        };
        fetchUsers();
    }, [playersStr]);

    // Fetch tournament (from one of the players, assume same data for now, or official)
    useEffect(() => {
        if (playersList.length === 0) return;
        const mainPlayer = playersList[0];

        const fetchTournament = async () => {
            try {
                // Try custom first for that player
                const customRef = doc(db, 'users', mainPlayer, 'custom_tournaments', eventId);
                const customSnap = await getDoc(customRef);
                if (customSnap.exists()) {
                    setTournament({ id: customSnap.id, ...customSnap.data() });
                    return;
                }

                // Try official
                const offRef = doc(db, 'tournaments', eventId);
                const offSnap = await getDoc(offRef);
                if (offSnap.exists()) {
                    setTournament({ id: offSnap.id, ...offSnap.data() });
                    return;
                }
                
                // Fallback basic
                setTournament({ id: eventId, name: 'Torneo en Seguimiento' });

            } catch (err) {
                console.error("Error fetching event info", err);
            }
        };
        fetchTournament();
    }, [eventId, playersStr]);

    // Setup Realtime listeners for all requested players
    useEffect(() => {
        const unsubscribes = [];

        playersList.forEach(player => {
            const ref = doc(db, 'users', player, 'results', eventId);
            const unsub = onSnapshot(ref, (snap) => {
                if (snap.exists()) {
                    setResults(prev => ({ ...prev, [player]: snap.data() }));
                } else {
                    setResults(prev => ({ ...prev, [player]: null }));
                }
                setLoading(false);
            }, (err) => {
                console.error(`Error listening to ${player}:`, err);
                setError(prev => ({ ...prev, [player]: 'Error de conexión en vivo.' }));
            });
            unsubscribes.push(unsub);
        });

        return () => {
            unsubscribes.forEach(fn => fn());
        };
    }, [eventId, playersStr]);

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
    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>Cargando datos en vivo de múltiples jugadoras...</div>;

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
            </div>

            <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
                {playersList.map(player => {
                    const result = results[player];
                    const profile = profiles[player] || { full_name: player };
                    
                    return (
                        <div key={player} style={{ marginBottom: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #334155' }}>
                                <img src={profile.photo_url || `https://ui-avatars.com/api/?name=${player}&background=random`} alt={player} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #fff' }} />
                                <h2 style={{ fontSize: '1.4rem', margin: 0, color: 'white' }}>{profile.full_name || profile.username || player}</h2>
                            </div>

                            {!result ? (
                                <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '16px', textAlign: 'center', color: '#94a3b8' }}>
                                    <p>Todavía no hay resultados registrados para esta jugadora en este torneo.</p>
                                </div>
                            ) : (
                                <div>
                                    {/* Render all rounds or just active? For multi, let's render all active rounds they have */}
                                    {(() => {
                                        const roundsKeys = Object.keys(result.scorecards || {});
                                        if (roundsKeys.length === 0) return <p style={{ color: '#94a3b8', padding: '1rem' }}>Sin tarjetas.</p>;

                                        // Find active round
                                        let activeRIdx = roundsKeys[0];
                                        for (let i = roundsKeys.length - 1; i >= 0; i--) {
                                            const rIdx = roundsKeys[i];
                                            const card = result.scorecards[rIdx];
                                            let playedHoles = 0;
                                            let matchPars = true;
                                            for (let h = 0; h < 18; h++) {
                                                const s = String(card.strokes?.[h] || '');
                                                const p = String(card.pars?.[h] || '');
                                                if (s !== '' && s !== '-') playedHoles++;
                                                if (s !== p) matchPars = false;
                                            }
                                            if ((playedHoles > 0 && !(playedHoles === 18 && matchPars)) || (result.rounds?.[parseInt(rIdx)] > 0)) {
                                                activeRIdx = rIdx;
                                                break;
                                            }
                                        }

                                        // We just render the active round for now to keep it compact
                                        const displayRounds = [activeRIdx];

                                        return displayRounds.map((rIdx) => {
                                            const roundStr = parseInt(rIdx);
                                            const card = result.scorecards[rIdx];

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

                                            const manualStrokesTotal = result.rounds?.[roundStr];
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
                                        });
                                    })()}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
