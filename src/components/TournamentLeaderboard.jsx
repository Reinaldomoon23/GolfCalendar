import React, { useEffect, useState } from 'react';
import { Trophy, Users, Clock, TrendingUp } from 'lucide-react';
import { subscribeToLeaderboard } from '../services/leaderboard.service';
import ProfileImage from './ProfileImage';

/**
 * TournamentLeaderboard
 *
 * Displays a real-time centralized leaderboard for a shared tournament.
 * Data is pulled from `tournaments/{tournamentId}/participants`.
 *
 * @param {string} tournamentId
 * @param {number} par - Tournament par (for vs-par display)
 * @param {string} currentUsername - Logged-in user's username (to highlight their row)
 */
export default function TournamentLeaderboard({ tournamentId, par = 72, currentUsername }) {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('total');

    useEffect(() => {
        if (!tournamentId) return;

        const unsub = subscribeToLeaderboard(tournamentId, (data) => {
            setParticipants(data);
            setLoading(false);
        });

        return () => unsub();
    }, [tournamentId]);

    const formatVsPar = (vspar) => {
        if (vspar === null || vspar === undefined) return '-';
        if (vspar === 0) return 'E';
        return vspar > 0 ? `+${vspar}` : `${vspar}`;
    };

    const getVsParColor = (vspar) => {
        if (vspar === null || vspar === undefined) return '#94a3b8';
        if (vspar < 0) return '#10b981'; // Under par → green
        if (vspar === 0) return '#3b82f6'; // Even → blue
        return '#ef4444'; // Over par → red
    };

    const maxRounds = Math.max(
        0,
        ...participants.map((p) => Array.isArray(p.rounds) ? p.rounds.length : 0)
    );
    const roundTabs = Array.from({ length: maxRounds }, (_, idx) => idx);

    const getDisplayScore = (participant) => {
        if (viewMode === 'total') return participant.total || null;
        const roundIdx = Number(viewMode);
        return Array.isArray(participant.rounds) ? Number(participant.rounds[roundIdx]) || null : null;
    };

    const hasDisplayResult = (participant) => (
        viewMode === 'total'
            ? (
                participant.hasScore === true ||
                Number(getDisplayScore(participant)) > 0 ||
                Number(participant.roundsPlayed) > 0
            )
            : Number(getDisplayScore(participant)) > 0
    );

    const getDisplayVsPar = (participant) => {
        if (viewMode === 'total') return participant.vspar;
        const score = getDisplayScore(participant);
        const roundIdx = Number(viewMode);
        const roundPar = Array.isArray(participant.roundPars) ? Number(participant.roundPars[roundIdx]) : 0;
        return score ? score - (roundPar || par) : null;
    };

    const sortedParticipants = [...participants].sort((a, b) => {
        const scoreA = getDisplayScore(a);
        const scoreB = getDisplayScore(b);
        const hasA = hasDisplayResult(a);
        const hasB = hasDisplayResult(b);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (!hasA && !hasB) {
            return String(a.fullName || a.username).localeCompare(String(b.fullName || b.username));
        }
        return scoreA - scoreB;
    });

    const withScores = sortedParticipants.filter(p => hasDisplayResult(p));
    const withoutScores = sortedParticipants.filter(p => !hasDisplayResult(p));

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <div style={{
                    width: '40px', height: '40px', border: '3px solid #e2e8f0',
                    borderTopColor: '#3b82f6', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite', margin: '0 auto 12px auto'
                }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Cargando clasificación...</p>
            </div>
        );
    }

    if (participants.length === 0) {
        return (
            <div style={{
                textAlign: 'center', padding: '48px 24px',
                background: 'linear-gradient(135deg, #f8fafc, #f0f9ff)',
                borderRadius: '16px', border: '1px dashed #bae6fd'
            }}>
                <div style={{
                    width: '64px', height: '64px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    borderRadius: '20px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 16px auto',
                    boxShadow: '0 8px 20px rgba(59,130,246,0.25)'
                }}>
                    <Trophy size={32} color="white" />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1e293b', fontWeight: '700' }}>
                    Sin clasificación aún
                </h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                    Sé la primera en registrar tu resultado para aparecer aquí.
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Header Stats */}
            <div style={{
                display: 'flex', gap: '12px', marginBottom: '4px',
                flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '0.8rem', color: '#64748b', fontWeight: '600'
                    }}>
                        <Users size={14} color="#3b82f6" />
                        <span>{participants.length} participantes</span>
                    </div>
                    {withScores.length > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.8rem', color: '#64748b', fontWeight: '600'
                        }}>
                            <TrendingUp size={14} color="#10b981" />
                            <span>{withScores.length} con resultado</span>
                        </div>
                    )}
                </div>
                {roundTabs.length > 1 && (
                    <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
                        <button
                            type="button"
                            onClick={() => setViewMode('total')}
                            style={{
                                border: 'none',
                                borderRadius: '8px',
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                color: viewMode === 'total' ? 'white' : '#64748b',
                                background: viewMode === 'total' ? 'var(--color-primary)' : 'transparent'
                            }}
                        >
                            Total
                        </button>
                        {roundTabs.map((roundIdx) => (
                            <button
                                key={roundIdx}
                                type="button"
                                onClick={() => setViewMode(String(roundIdx))}
                                style={{
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    color: viewMode === String(roundIdx) ? 'white' : '#64748b',
                                    background: viewMode === String(roundIdx) ? 'var(--color-primary)' : 'transparent'
                                }}
                            >
                                R{roundIdx + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Leaderboard Table */}
            <div style={{
                background: 'white', borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
                {/* Table Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 60px 72px 72px',
                    gap: '8px',
                    padding: '10px 16px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#64748b'
                }}>
                    <span style={{ textAlign: 'center' }}>Pos</span>
                    <span>Jugadora</span>
                    <span style={{ textAlign: 'center' }}>Rondas</span>
                    <span style={{ textAlign: 'center' }}>{viewMode === 'total' ? 'Total' : `R${Number(viewMode) + 1}`}</span>
                    <span style={{ textAlign: 'center' }}>vs Par</span>
                </div>

                {/* Rows with Scores */}
                {withScores.map((p, idx) => {
                    const isCurrentUser = p.username === currentUsername;
                    const isFirst = idx === 0;
                    const score = getDisplayScore(p);
                    const vspar = getDisplayVsPar(p);

                    return (
                        <div
                            key={p.username}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '36px 1fr 60px 72px 72px',
                                gap: '8px',
                                padding: '12px 16px',
                                alignItems: 'center',
                                borderBottom: '1px solid #f1f5f9',
                                background: isCurrentUser
                                    ? 'linear-gradient(90deg, rgba(59,130,246,0.05), rgba(59,130,246,0.02))'
                                    : 'white',
                                borderLeft: isCurrentUser ? '3px solid #3b82f6' : '3px solid transparent',
                                transition: 'background 0.2s'
                            }}
                        >
                            {/* Position */}
                            <div style={{ textAlign: 'center' }}>
                                {isFirst ? (
                                    <span style={{ fontSize: '1.1rem' }}>🏆</span>
                                ) : idx === 1 ? (
                                    <span style={{ fontSize: '1rem' }}>🥈</span>
                                ) : idx === 2 ? (
                                    <span style={{ fontSize: '1rem' }}>🥉</span>
                                ) : (
                                    <span style={{
                                        fontSize: '0.8rem', fontWeight: '700',
                                        color: '#94a3b8'
                                    }}>{idx + 1}</span>
                                )}
                            </div>

                            {/* Player Name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <ProfileImage
                                    username={p.username}
                                    size={28}
                                    style={{ borderRadius: '50%', flexShrink: 0 }}
                                />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{
                                        fontWeight: isCurrentUser ? '800' : '600',
                                        fontSize: '0.9rem',
                                        color: isCurrentUser ? '#3b82f6' : '#1e293b',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}>
                                        {p.fullName || p.username}
                                    </div>
                                    {isCurrentUser && (
                                        <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: '700' }}>TÚ</div>
                                    )}
                                </div>
                            </div>

                            {/* Rounds Played */}
                            <div style={{
                                textAlign: 'center', fontSize: '0.85rem',
                                color: '#64748b', fontWeight: '600'
                            }}>
                                {p.roundsPlayed || 0}
                            </div>

                            {/* Total Strokes */}
                            <div style={{
                                textAlign: 'center', fontSize: '0.95rem',
                                fontWeight: '700', color: '#1e293b'
                            }}>
                                {score || '-'}
                            </div>

                            {/* vs Par */}
                            <div style={{
                                textAlign: 'center',
                                fontSize: '0.9rem',
                                fontWeight: '800',
                                color: getVsParColor(vspar),
                                background: vspar === null ? 'transparent' : `${getVsParColor(vspar)}15`,
                                borderRadius: '8px',
                                padding: '2px 6px'
                            }}>
                                {formatVsPar(vspar)}
                            </div>
                        </div>
                    );
                })}

                {/* Separator if there are players without scores */}
                {withoutScores.length > 0 && withScores.length > 0 && (
                    <div style={{
                        padding: '6px 16px',
                        background: '#f8fafc',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Clock size={12} />
                        Sin resultados
                    </div>
                )}

                {/* Rows without scores */}
                {withoutScores.map((p) => {
                    const isCurrentUser = p.username === currentUsername;
                    return (
                        <div
                            key={p.username}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '36px 1fr 60px 72px 72px',
                                gap: '8px',
                                padding: '10px 16px',
                                alignItems: 'center',
                                borderBottom: '1px solid #f1f5f9',
                                opacity: 0.6,
                                background: isCurrentUser ? 'rgba(59,130,246,0.03)' : 'white',
                                borderLeft: isCurrentUser ? '3px solid #3b82f6' : '3px solid transparent',
                            }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>—</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <ProfileImage
                                    username={p.username}
                                    size={28}
                                    style={{ borderRadius: '50%', flexShrink: 0 }}
                                />
                                <div style={{
                                    fontWeight: '600', fontSize: '0.9rem', color: '#64748b',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {p.fullName || p.username}
                                    {isCurrentUser && (
                                        <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#3b82f6', fontWeight: '700' }}>TÚ</span>
                                    )}
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                                        Sin resultados
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>0</div>
                            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>—</div>
                            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>—</div>
                        </div>
                    );
                })}
            </div>

            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                Clasificación en tiempo real · Stroke play · Menor número de golpes gana
            </p>
        </div>
    );
}
