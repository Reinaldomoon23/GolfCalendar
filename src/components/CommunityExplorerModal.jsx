import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Plus, MapPin, Calendar, User, Share2, Info, Users, CheckCircle, LogOut } from 'lucide-react';
import { fetchParticipantCounts } from '../services/tournaments.service';
import { isPast } from '../utils/dateHelpers';

const CATEGORIES = [
    { id: 'all', label: 'Todos', color: '#64748b' },
    { id: 'comunidad', label: 'Comunidad 🌍', color: '#2563eb' },
    { id: 'juvenil', label: 'C. Juvenil', color: '#db2777' },
    { id: 'rfeg', label: 'RFEG', color: '#dc2626' },
    { id: 'fcg', label: 'FCG', color: '#d97706' },
    { id: 'adultos', label: 'Adultos', color: '#4b5563' }
];

export default function CommunityExplorerModal({
    isOpen,
    onClose,
    sharedTournaments,
    onAdd,        // Legacy: for custom tournaments that are NOT from shared_tournaments
    onJoin,       // New: join via reference model
    onLeave,      // New: leave (unsubscribe)
    joinedTournaments,
    subscribedTournaments = [],
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [participantCounts, setParticipantCounts] = useState({});
    const [loadingCounts, setLoadingCounts] = useState(false);
    const [joiningId, setJoiningId] = useState(null); // Loading state per card

    if (!isOpen) return null;

    // Fetch participant counts once when modal opens
    useEffect(() => {
        if (!sharedTournaments?.length) return;
        const ids = sharedTournaments.filter(t => t.isShared).map(t => String(t.id));
        if (!ids.length) return;
        setLoadingCounts(true);
        fetchParticipantCounts(ids).then(counts => {
            setParticipantCounts(counts);
            setLoadingCounts(false);
        }).catch(() => setLoadingCounts(false));
    }, [sharedTournaments?.length]);

    // Helper: is this tournament already in the user's calendar?
    const isJoinedTournament = (id) => {
        const sid = String(id);
        return (
            subscribedTournaments.some(t => String(t.id) === sid) ||
            joinedTournaments.some(jt => String(jt.id) === sid)
        );
    };

    // Filter and Group tournaments
    const filtered = useMemo(() => {
        return sharedTournaments.filter(t => {
            // 1. Ocultar torneos pasados (si la fecha de fin ya pasó)
            // A menos que ya estemos apuntados (para poder verlos/quitarlos si fuera necesario)
            const joined = subscribedTournaments.some(st => String(st.id) === String(t.id)) || 
                          joinedTournaments.some(jt => String(jt.id) === String(t.id));
            
            if (!joined && isPast(t.dates)) return false;

            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               (t.course || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            if (activeCategory === 'all') return true;
            if (activeCategory === 'comunidad') return t.isShared;
            
            const tGroups = t.groups || [];
            const tType = t.type || 'club';
            return tGroups.includes(activeCategory) || tType === activeCategory;
        });
    }, [sharedTournaments, searchTerm, activeCategory, subscribedTournaments, joinedTournaments]);

    const handleJoinClick = async (t) => {
        setJoiningId(String(t.id));
        try {
            // Use new reference-based join if available, otherwise legacy
            if (onJoin) {
                await onJoin(t);
            } else if (onAdd) {
                await onAdd(t);
            }
        } finally {
            setJoiningId(null);
        }
    };

    const handleLeaveClick = async (t) => {
        setJoiningId(String(t.id));
        try {
            if (onLeave) await onLeave(String(t.id));
        } finally {
            setJoiningId(null);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', 
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            zIndex: 2000,
            padding: '20px'
        }}>
            <div className="card fade-in" style={{ 
                width: '100%', 
                maxWidth: '800px', 
                maxHeight: '85vh', 
                display: 'flex', 
                flexDirection: 'column',
                padding: '0',
                overflow: 'hidden',
                borderRadius: '20px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                background: '#f8fafc'
            }}>
                {/* Header */}
                <div style={{ 
                    padding: '24px', 
                    background: 'white',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#0f172a', letterSpacing: '-0.025em' }}>
                            Catálogo de Torneos 🏆
                        </h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#64748b' }}>
                            Explora circuitos oficiales y eventos compartidos por la comunidad
                        </p>
                    </div>
                    <button onClick={onClose} style={{ 
                        background: '#f1f5f9', 
                        border: 'none', 
                        borderRadius: '12px', 
                        padding: '10px', 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        color: '#64748b'
                    }} onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'} 
                       onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}>
                        <X size={20} />
                    </button>
                </div>

                {/* Sub-header: Search & Categories */}
                <div style={{ padding: '0 24px 20px 24px', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', paddingTop: '16px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input 
                                type="text" 
                                placeholder="Buscar torneo, campo o circuito..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '14px 14px 14px 44px',
                                    borderRadius: '14px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                    </div>

                    <div style={{ 
                        display: 'flex', 
                        gap: '8px', 
                        overflowX: 'auto', 
                        paddingBottom: '4px',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    background: activeCategory === cat.id ? cat.color : '#f1f5f9',
                                    color: activeCategory === cat.id ? 'white' : '#64748b',
                                    border: 'none',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content: Tournament List */}
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '24px', 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                    gap: '16px',
                    alignContent: 'start'
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', gridColumn: '1/-1' }}>
                            <div style={{ 
                                width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '20px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto'
                            }}>
                                <Search size={32} style={{ color: '#94a3b8' }} />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', color: '#1e293b', marginBottom: '8px' }}>No hay resultados</h3>
                            <p style={{ color: '#64748b' }}>Prueba con otros términos o cambia la categoría.</p>
                        </div>
                    ) : (
                        filtered.map(t => {
                            const joined = isJoinedTournament(t.id);
                            const cat = CATEGORIES.find(c => (t.groups || []).includes(c.id) || t.type === c.id) || CATEGORIES[0];
                            const count = participantCounts[String(t.id)];
                            const isLoading = joiningId === String(t.id);
                            
                            return (
                                <div key={t.id} style={{
                                    border: joined ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    background: joined ? '#f0fdf4' : 'white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    cursor: 'default',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: joined ? '#10b981' : (t.isShared ? '#2563eb' : cat.color) }}></div>
                                    
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                            <span style={{ 
                                                fontSize: '0.7rem', 
                                                fontWeight: '800', 
                                                textTransform: 'uppercase', 
                                                padding: '2px 8px', 
                                                borderRadius: '6px',
                                                background: `${t.isShared ? '#2563eb' : cat.color}15`,
                                                color: t.isShared ? '#2563eb' : cat.color
                                            }}>
                                                {t.isShared ? 'COMUNIDAD 🌍' : cat.label}
                                            </span>
                                            {joined && (
                                                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <CheckCircle size={14} /> EN TU CALENDARIO
                                                </span>
                                            )}
                                        </div>

                                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                                            {t.name}
                                        </h3>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#475569' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={16} style={{ color: '#94a3b8' }} /> 
                                                <span style={{ fontWeight: '500' }}>{t.dates}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <MapPin size={16} style={{ color: '#94a3b8' }} /> 
                                                <span>{t.course}</span>
                                            </div>
                                            {/* Participant count badge */}
                                            {t.isShared && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                    <Users size={14} style={{ color: '#94a3b8' }} />
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>
                                                        {loadingCounts
                                                            ? '...'
                                                            : count !== undefined
                                                                ? `${count} ${count === 1 ? 'jugadora apuntada' : 'jugadoras apuntadas'}`
                                                                : '0 jugadoras apuntadas'
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                        {t.isShared && t.sharedByName && !joined && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <User size={12} style={{ color: '#64748b' }} />
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t.sharedByName}</span>
                                            </div>
                                        )}
                                        
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                            {joined ? (
                                                <button 
                                                    onClick={() => handleLeaveClick(t)}
                                                    disabled={isLoading}
                                                    style={{
                                                        padding: '10px 16px',
                                                        borderRadius: '12px',
                                                        background: 'white',
                                                        color: '#ef4444',
                                                        border: '1.5px solid #ef4444',
                                                        fontWeight: '700',
                                                        fontSize: '0.85rem',
                                                        cursor: isLoading ? 'wait' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        transition: 'all 0.2s',
                                                        opacity: isLoading ? 0.6 : 1,
                                                    }}
                                                >
                                                    <LogOut size={16} /> {isLoading ? '...' : 'Quitar'}
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleJoinClick(t)}
                                                    disabled={isLoading}
                                                    style={{
                                                        padding: '10px 20px',
                                                        borderRadius: '12px',
                                                        background: isLoading ? '#e2e8f0' : 'var(--color-primary)',
                                                        color: isLoading ? '#94a3b8' : 'white',
                                                        border: 'none',
                                                        fontWeight: '700',
                                                        fontSize: '0.9rem',
                                                        cursor: isLoading ? 'wait' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        transition: 'all 0.2s',
                                                        opacity: isLoading ? 0.6 : 1,
                                                    }}
                                                >
                                                    {isLoading ? '...' : <><Plus size={18} /> Apuntarse</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Info */}
                <div style={{ padding: '16px 24px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={14} /> Los torneos suscritos se sincronizan automáticamente si el organizador actualiza los datos.
                    </p>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8' }}>
                        {filtered.length} torneos encontrados
                    </div>
                </div>
            </div>
        </div>
    );
}
