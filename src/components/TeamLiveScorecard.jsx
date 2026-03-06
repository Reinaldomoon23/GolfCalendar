import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Info } from 'lucide-react';

const R2_PUBLIC_URL = "https://pub-23c281cf1ae04def9102341cf7d87837.r2.dev";

const getPhotoUrl = (photoPath, username) => {
    if (!photoPath) return `https://ui-avatars.com/api/?name=${username || 'Golf'}`;
    if (photoPath.startsWith('http')) return photoPath;
    const fileName = photoPath.split('/').pop() || 'profile.jpg';
    return `${R2_PUBLIC_URL}/${fileName}`;
};

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

    // Fetch unified users info from Firestore
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const matchedProfiles = {};
                for (const p of playersList) {
                    const userSnap = await getDoc(doc(db, "users", p));
                    if (userSnap.exists()) {
                        matchedProfiles[p] = { ...userSnap.data(), username: p };
                    }
                }
                setProfiles(matchedProfiles);
            } catch (err) {
                console.error("Error fetching user profiles from Firestore", err);
            }
        };
        if (playersList.length > 0) fetchUsers();
    }, [playersList.join(',')]);

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
                    const data = snap.data();

                    // HOTFIX: Salamanca Forum Golf hole 15 par correction
                    if (data.scorecards) {
                        Object.keys(data.scorecards).forEach(rIdx => {
                            const card = data.scorecards[rIdx];
                            if (card.pars && card.pars[14] === 5) {
                                // Verify course name
                                const courseName = (data.tournamentCourse || tournament?.course || '').toLowerCase();
                                if (courseName.includes('salamanca forum')) {
                                    card.pars[14] = 4;
                                }
                            }
                        });
                    }

                    setResults(prev => ({ ...prev, [player]: data }));
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
            </div>

            <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
                {playersList.map(player => {
                    const result = results[player];
                    const profile = profiles[player] || { full_name: player };

                    return (
                        <div key={player} style={{ marginBottom: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #334155' }}>
                                <img src={getPhotoUrl(profile.photo_url, profile.full_name || player)} alt={player} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #fff', objectFit: 'cover' }} />
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
