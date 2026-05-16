import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Users, ExternalLink, Calendar, MapPin, ChevronLeft } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { subscribeToLeaderboard } from '../services/leaderboard.service';
import { getTournamentIdCandidates, resolveCanonicalTournamentId } from '../services/tournaments.service';
import tournamentsData from '../data/tournaments.json';
import ProfileImage from './ProfileImage';

export default function PublicLeaderboardView() {
    const { id } = useParams();
    const canonicalId = resolveCanonicalTournamentId(id);
    const navigate = useNavigate();
    const [tournament, setTournament] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!canonicalId) return;

        // 1. Fetch Tournament Metadata
        const fetchTournament = async () => {
            let foundTournament = null;
            const candidates = getTournamentIdCandidates(canonicalId);

            for (const candidateId of candidates) {
                try {
                    const snap = await getDoc(doc(db, 'shared_tournaments', candidateId));
                    if (snap.exists()) {
                        foundTournament = { id: snap.id, ...snap.data() };
                        break;
                    }
                } catch (err) {
                    console.warn('[PublicLeaderboard] shared_tournaments unavailable:', err.code || err.message);
                }

                try {
                    const offSnap = await getDoc(doc(db, 'tournaments', candidateId));
                    if (offSnap.exists()) {
                        foundTournament = { id: offSnap.id, ...offSnap.data() };
                        break;
                    }
                } catch (err) {
                    console.warn('[PublicLeaderboard] tournaments unavailable:', err.code || err.message);
                }
            }

            if (!foundTournament) {
                const localTournament = tournamentsData.find((t) =>
                    getTournamentIdCandidates(t).some((candidateId) => candidates.includes(candidateId))
                );

                if (localTournament) {
                    foundTournament = {
                        ...localTournament,
                        id: canonicalId,
                    };
                }
            }

            setTournament(foundTournament);
        };

        const unsubscribe = subscribeToLeaderboard(canonicalId, (data) => {
            setParticipants(data);
            setLoading(false);
        });

        fetchTournament();
        return () => unsubscribe();
    }, [canonicalId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!tournament && !loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Torneo no encontrado</h2>
                <p>El enlace podría ser incorrecto o el torneo ya no está disponible.</p>
                <button onClick={() => navigate('/')} className="btn btn-primary">Ir al inicio</button>
            </div>
        );
    }

    const getActiveRoundIndex = (dates) => {
        const parts = String(dates || '').split(' - ');
        const parse = (value) => {
            const [day, month, year] = String(value || '').split('/').map(Number);
            if (!day || !month || !year) return null;
            return new Date(year, month - 1, day).setHours(0, 0, 0, 0);
        };
        const start = parse(parts[0]);
        if (!start) return null;

        const today = new Date().setHours(0, 0, 0, 0);
        const roundIdx = Math.floor((today - start) / (24 * 60 * 60 * 1000));
        const maxIdx = Math.max(0, parts.length > 1 ? Math.floor((parse(parts[1]) - start) / (24 * 60 * 60 * 1000)) : 0);
        return roundIdx >= 0 && roundIdx <= maxIdx ? roundIdx : null;
    };

    const activeRoundIdx = getActiveRoundIndex(tournament?.dates);
    const hasRoundResult = (participant, roundIdx) => {
        if (roundIdx === null) {
            return (
                participant.hasScore === true ||
                Number(participant.total) > 0 ||
                Number(participant.total_strokes) > 0 ||
                Number(participant.roundsPlayed) > 0
            );
        }
        return Number(participant.rounds?.[roundIdx]) > 0;
    };
    const rankedParticipants = participants
        .filter((participant) => hasRoundResult(participant, activeRoundIdx))
        .sort((a, b) => Number(a.total || a.total_strokes || 999) - Number(b.total || b.total_strokes || 999));
    const noResultParticipants = participants
        .filter((participant) => !hasRoundResult(participant, activeRoundIdx))
        .sort((a, b) => String(a.fullName || a.username).localeCompare(String(b.fullName || b.username)));
    const displayParticipants = [...rankedParticipants, ...noResultParticipants];

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
            padding: '1rem',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Header Area */}
            <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto 1.5rem auto',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                padding: '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.5)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                    <button 
                        onClick={() => navigate('/')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#1e293b' }}>
                        {tournament?.name}
                    </h1>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', color: '#64748b', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={16} /> {tournament?.dates}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <MapPin size={16} /> {tournament?.course}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Users size={16} /> {participants.length} Jugadores
                    </div>
                </div>
            </div>

            {/* Leaderboard Table */}
            <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto',
                background: 'white',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ 
                    padding: '1rem 1.5rem', 
                    background: '#1e293b', 
                    color: 'white', 
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr 72px 72px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    <span>Pos</span>
                    <span>Jugadora</span>
                    <span style={{ textAlign: 'center' }}>Total</span>
                    <span style={{ textAlign: 'center' }}>vs Par</span>
                </div>

                {participants.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <Trophy size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <p>Aún no hay resultados registrados para este torneo.</p>
                    </div>
                ) : (
                    displayParticipants.map((p, idx) => {
                        const hasPlayerResult = hasRoundResult(p, activeRoundIdx);
                        const rankedIndex = rankedParticipants.findIndex((candidate) => candidate.username === p.username || candidate.id === p.id);
                        const position = rankedIndex + 1;
                        const isTop3 = hasPlayerResult && rankedIndex < 3;
                        const score = p.total || null;
                        const relative = p.vspar;
                        const relativeStr = relative === null || relative === undefined
                            ? '-'
                            : relative > 0 ? `+${relative}` : (relative === 0 ? 'E' : relative);
                        const updatedAt = p.updatedAt?.toDate ? p.updatedAt.toDate() : (p.updatedAt ? new Date(p.updatedAt) : null);

                        return (
                            <div key={p.id} style={{ 
                                display: 'grid', 
                                gridTemplateColumns: '44px 1fr 72px 72px',
                                padding: '1.2rem 1.5rem',
                                borderBottom: '1px solid #f1f5f9',
                                alignItems: 'center',
                                transition: 'background 0.2s',
                                cursor: 'pointer'
                            }}
                            onClick={() => navigate(`/live/${p.username}/${canonicalId}`)}
                            >
                                <span style={{ 
                                    fontWeight: '800', 
                                    color: isTop3 ? '#f59e0b' : '#94a3b8',
                                    fontSize: isTop3 ? '1.1rem' : '1rem'
                                }}>
                                    {hasPlayerResult ? position : '—'}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <ProfileImage username={p.username} size={32} style={{ borderRadius: '50%', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <span style={{ fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {p.fullName || p.username}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                            {hasPlayerResult && updatedAt
                                                ? `Actualizado: ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                : activeRoundIdx === null ? 'Sin resultados' : `Sin resultados R${activeRoundIdx + 1}`}
                                        </span>
                                    </div>
                                </div>
                                <span style={{ textAlign: 'center', color: '#64748b', fontWeight: '700' }}>
                                    {score || '-'}
                                </span>
                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '800', color: relative === null || relative === undefined ? '#94a3b8' : (relative <= 0 ? '#10b981' : '#ef4444') }}>
                                        {relativeStr}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer / CTA */}
            <div style={{ maxWidth: '800px', margin: '2rem auto', textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    ¿Quieres registrar tus propios resultados?
                </p>
                <button 
                    onClick={() => navigate('/')}
                    style={{ 
                        background: '#2563eb', 
                        color: 'white', 
                        padding: '12px 24px', 
                        borderRadius: '30px', 
                        border: 'none', 
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)',
                        cursor: 'pointer'
                    }}
                >
                    Unirse a RoundTracker <ExternalLink size={16} />
                </button>
            </div>
        </div>
    );
}
