import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Users, ExternalLink, Calendar, MapPin, ChevronLeft } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';

export default function PublicLeaderboardView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        // 1. Fetch Tournament Metadata
        const fetchTournament = async () => {
            try {
                const docRef = doc(db, 'shared_tournaments', id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setTournament({ id: snap.id, ...snap.data() });
                } else {
                    // Try official tournaments as fallback
                    const offRef = doc(db, 'tournaments', id);
                    const offSnap = await getDoc(offRef);
                    if (offSnap.exists()) {
                        setTournament({ id: offSnap.id, ...offSnap.data() });
                    }
                }
            } catch (err) {
                console.error("Error fetching tournament:", err);
            }
        };

        // 2. Subscribe to Participants' Results
        // We look for results that have this tournament ID
        // In this system, results are stored per user: /users/{uid}/results/{tournamentId}
        // BUT, for the leaderboard, we rely on the central collection 'tournament_results' if it exists,
        // or we query across all users (expensive).
        // REFINEMENT: Following the roadmap, we should use a query that finds all results for this ID.
        // For now, we assume results are indexed by tournamentId in a shared way or we use the 'tournament_results' collection.
        
        // According to leaderboard.service.js logic used elsewhere:
        const q = query(collection(db, 'tournament_results'), where('tournamentId', '==', id));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Sort by score (asc)
            const sorted = results.sort((a, b) => {
                const scoreA = a.total || 999;
                const scoreB = b.total || 999;
                return scoreA - scoreB;
            });
            
            setParticipants(sorted);
            setLoading(false);
        }, (error) => {
            console.error("Leaderboard subscription error:", error);
            setLoading(false);
        });

        fetchTournament();
        return () => unsubscribe();
    }, [id]);

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
                    gridTemplateColumns: '40px 1fr 60px 60px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    <span>Pos</span>
                    <span>Jugador</span>
                    <span style={{ textAlign: 'center' }}>HCP</span>
                    <span style={{ textAlign: 'center' }}>Score</span>
                </div>

                {participants.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <Trophy size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <p>Aún no hay resultados registrados para este torneo.</p>
                    </div>
                ) : (
                    participants.map((p, idx) => {
                        const isTop3 = idx < 3;
                        const score = p.total || 0;
                        const par = tournament?.par || 72;
                        const relative = score - par;
                        const relativeStr = relative > 0 ? `+${relative}` : (relative === 0 ? 'E' : relative);

                        return (
                            <div key={p.id} style={{ 
                                display: 'grid', 
                                gridTemplateColumns: '40px 1fr 60px 60px',
                                padding: '1.2rem 1.5rem',
                                borderBottom: '1px solid #f1f5f9',
                                alignItems: 'center',
                                transition: 'background 0.2s',
                                cursor: 'pointer'
                            }}
                            onClick={() => navigate(`/live/${p.username}/${id}`)}
                            >
                                <span style={{ 
                                    fontWeight: '800', 
                                    color: isTop3 ? '#f59e0b' : '#94a3b8',
                                    fontSize: isTop3 ? '1.1rem' : '1rem'
                                }}>
                                    {idx + 1}
                                </span>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: '#334155' }}>
                                        {p.displayName || p.username}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        Actualizado: {new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <span style={{ textAlign: 'center', color: '#64748b', fontWeight: '500' }}>
                                    {p.handicap || '-'}
                                </span>
                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '800', color: relative <= 0 ? '#10b981' : '#ef4444' }}>
                                        {relativeStr}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                        ({score})
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
