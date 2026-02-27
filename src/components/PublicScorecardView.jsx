import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Flag, Info } from 'lucide-react';

export default function PublicScorecardView() {
    const { username, id: eventId } = useParams();

    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [tournament, setTournament] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Fetch user info
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const baselink = import.meta.env.BASE_URL.replace(/\/$/, '');
                const res = await fetch(`${baselink}/api/users.json?t=${Date.now()}`);
                const data = await res.json();
                if (data[username]) {
                    setUserProfile(data[username]);
                }
            } catch (err) {
                console.error("Error fetching user profile", err);
            }
        };
        fetchUser();
    }, [username]);

    // Fetch tournament info
    useEffect(() => {
        const fetchTournament = async () => {
            try {
                // Check official tournaments first
                const docRef = doc(db, 'tournaments', eventId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setTournament({ id: docSnap.id, ...docSnap.data() });
                } else {
                    // Check custom tournaments for this user
                    const customRef = doc(db, 'users', username, 'custom_tournaments', eventId);
                    const customSnap = await getDoc(customRef);
                    if (customSnap.exists()) {
                        setTournament({ id: customSnap.id, ...customSnap.data() });
                    } else {
                        setError('Torneo no encontrado');
                    }
                }
            } catch (err) {
                console.error("Error fetching tournament", err);
                setError('Error al cargar datos del torneo');
            }
        };
        fetchTournament();
    }, [eventId, username]);

    // Listen to live results
    useEffect(() => {
        if (!tournament) return;

        const resultRef = doc(db, 'users', username, 'results', eventId);
        const unsubscribe = onSnapshot(resultRef, (docSnap) => {
            if (docSnap.exists()) {
                setResult(docSnap.data());
            } else {
                setResult(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error listening to results", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tournament, username, eventId]);

    const getScoreColor = (strokes, par) => {
        if (!strokes || !par || strokes === '-' || strokes === 0) return 'transparent';
        const diff = strokes - (par || 4); // Default par 4 fallback
        if (diff <= -2) return '#d946ef'; // Eagle
        if (diff === -1) return '#3b82f6'; // Birdie 
        if (diff === 0) return '#10b981'; // Par
        if (diff === 1) return '#f97316'; // Bogey
        return '#ef4444'; // DB+
    };

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'white' }}>
                <h2>Ups!</h2>
                <p>{error}</p>
                <Link to="/" style={{ color: '#3b82f6' }}>Volver a la App</Link>
            </div>
        );
    }

    if (loading || !tournament) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
                <p>Cargando datos en vivo...</p>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
            paddingBottom: '3rem'
        }}>
            {/* Header */}
            <header style={{
                background: '#1e293b',
                padding: '1rem',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                            {userProfile?.photo_url && (
                                <img
                                    src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${userProfile.photo_url}`}
                                    alt="Profile"
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #10b981', objectFit: 'cover' }}
                                    onError={(e) => { e.target.onerror = null; e.target.src = "https://ui-avatars.com/api/?name=" + username }}
                                />
                            )}
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                                    EN DIRECTO 🔴
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {userProfile ? userProfile.full_name : username}
                                </div>
                            </div>
                        </div>
                        <h1 style={{ margin: 0, fontSize: '1rem', color: '#94a3b8' }}>
                            {tournament.name}
                        </h1>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                            {tournament.course}
                        </div>
                    </div>
                </div>
            </header>

            {/* Total / Summary Stats */}
            {!result ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    <Flag size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    <p>Todavía no hay resultados registrados para este torneo.</p>
                </div>
            ) : (
                <div style={{ padding: '1rem' }}>
                    <div style={{ padding: '1rem' }}>
                        {/* Summary Loop over Rounds */}
                        {(() => {
                            const roundsKeys = Object.keys(result.scorecards || {});
                            if (roundsKeys.length === 0) return null;

                            // We ONLY want to display the last played/active round
                            // Find the highest round index that actually has strokes or manual scores
                            let activeRIdx = roundsKeys[0];
                            for (let i = roundsKeys.length - 1; i >= 0; i--) {
                                const rIdx = roundsKeys[i];
                                const card = result.scorecards[rIdx];
                                const roundStr = parseInt(rIdx);
                                const roundStrokes = (card.strokes || []).reduce((a, b) => a + (parseInt(b) || 0), 0);
                                const manualStrokesTotal = result.rounds?.[roundStr];
                                if (roundStrokes > 0 || (manualStrokesTotal && manualStrokesTotal > 0)) {
                                    activeRIdx = rIdx;
                                    break;
                                }
                            }

                            // Just map over that single active round
                            return [activeRIdx].map((rIdx) => {
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
                                            playedPar += (!isNaN(p) && p > 0 ? p : 4); // default par 4 fallback
                                            holesPlayed++;
                                        }
                                    }
                                }

                                const manualStrokesTotal = result.rounds?.[roundStr];
                                const displayTotal = holesPlayed > 0 ? playedStrokes : manualStrokesTotal;

                                if (!displayTotal || displayTotal === '') return null; // Skip empty rounds

                                let diffStr = 'E';
                                let diffColor = '#94a3b8';

                                if (holesPlayed > 0) {
                                    const diff = playedStrokes - playedPar;
                                    diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'E';
                                    diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#94a3b8';
                                } else {
                                    // fallback for manual total score only
                                    const totalPar = (card.pars || []).reduce((a, b) => a + (parseInt(b) || 0), 0) || 72;
                                    const diff = displayTotal - totalPar;
                                    diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'E';
                                    diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#94a3b8';
                                }

                                return (
                                    <div key={rIdx} style={{
                                        background: '#1e293b',
                                        borderRadius: '16px',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>Ronda {roundStr + 1}</h3>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                <span style={{ fontSize: '2rem', fontWeight: '900', color: 'white' }}>{displayTotal}</span>
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
                                                        <div style={{ width: '45px', padding: '8px', borderRight: '1px solid #334155', flexShrink: 0, textAlign: 'center', boxSizing: 'border-box' }}>Hoyo</div>
                                                        {[...Array(9)].map((_, i) => (
                                                            <div key={i} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                {i + 1}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Row: Par */}
                                                    <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        <div style={{ width: '45px', padding: '8px', borderRight: '1px solid #334155', borderTop: '1px solid #334155', flexShrink: 0, textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }}>Par</div>
                                                        {[...Array(9)].map((_, i) => (
                                                            <div key={i} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', borderTop: '1px solid #334155', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                {card.pars?.[i] || '-'}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Row: Strokes */}
                                                    <div style={{ display: 'flex', background: '#334155', fontSize: '1rem', fontWeight: 'bold' }}>
                                                        <div style={{ width: '45px', padding: '8px', borderRight: '1px solid #1e293b', borderTop: '1px solid #1e293b', flexShrink: 0, textAlign: 'center', color: 'white', boxSizing: 'border-box' }}>Score</div>
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
                                                                    borderTop: '1px solid #1e293b',
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
                                                    {/* Row: Headers */}
                                                    <div style={{ display: 'flex', background: '#0f172a', fontWeight: 'bold', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        <div style={{ width: '45px', padding: '8px', borderRight: '1px solid #334155', flexShrink: 0, textAlign: 'center', boxSizing: 'border-box' }}>Hoyo</div>
                                                        {[...Array(9)].map((_, i) => (
                                                            <div key={i + 9} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                {i + 10}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Row: Par */}
                                                    <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        <div style={{ width: '45px', padding: '8px', borderRight: '1px solid #334155', borderTop: '1px solid #334155', flexShrink: 0, textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }}>Par</div>
                                                        {[...Array(9)].map((_, i) => (
                                                            <div key={i + 9} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', borderTop: '1px solid #334155', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                {card.pars?.[i + 9] || '-'}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Row: Strokes */}
                                                    <div style={{ display: 'flex', background: '#334155', fontSize: '1rem', fontWeight: 'bold' }}>
                                                        <div style={{ width: '45px', padding: '8px', borderRight: '1px solid #1e293b', borderTop: '1px solid #1e293b', flexShrink: 0, textAlign: 'center', color: 'white', boxSizing: 'border-box' }}>Score</div>
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
                                                                    borderTop: '1px solid #1e293b',
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
                </div >
            )
            }
        </div >
    );
}
