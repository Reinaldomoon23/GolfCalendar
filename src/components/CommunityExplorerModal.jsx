import React, { useState, useMemo } from 'react';
import { X, Search, Plus, MapPin, Calendar, User, Share2, Info, Filter, LayoutGrid, List as ListIcon } from 'lucide-react';

const CATEGORIES = [
    { id: 'all', label: 'Todos', color: '#64748b' },
    { id: 'comunidad', label: 'Comunidad🌍', color: '#2563eb' },
    { id: 'juvenil', label: 'C. Juvenil', color: '#db2777' },
    { id: 'rfeg', label: 'RFEG', color: '#dc2626' },
    { id: 'fcg', label: 'FCG', color: '#d97706' },
    { id: 'adultos', label: 'Adultos', color: '#4b5563' }
];

export default function CommunityExplorerModal({ isOpen, onClose, sharedTournaments, onAdd, joinedTournaments }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    if (!isOpen) return null;

    // Filter and Group tournaments
    const filtered = useMemo(() => {
        return sharedTournaments.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               t.course.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            if (activeCategory === 'all') return true;
            if (activeCategory === 'comunidad') return t.isShared;
            
            const tGroups = t.groups || [];
            const tType = t.type || 'club';
            return tGroups.includes(activeCategory) || tType === activeCategory;
        });
    }, [sharedTournaments, searchTerm, activeCategory]);

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
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
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
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
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
                            const isJoined = joinedTournaments.some(jt => jt.id === t.id);
                            const cat = CATEGORIES.find(c => (t.groups || []).includes(c.id) || t.type === c.id) || CATEGORIES[0];
                            
                            return (
                                <div key={t.id} style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    background: 'white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    cursor: 'default',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: t.isShared ? '#2563eb' : cat.color }}></div>
                                    
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
                                            {isJoined && (
                                                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Plus size={14} style={{ transform: 'rotate(45deg)' }} /> EN TU CALENDARIO
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
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        {t.isShared && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <User size={12} style={{ color: '#64748b' }} />
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t.sharedByName}</span>
                                            </div>
                                        )}
                                        
                                        <button 
                                            disabled={isJoined}
                                            onClick={() => onAdd(t)}
                                            style={{
                                                marginLeft: 'auto',
                                                padding: '10px 20px',
                                                borderRadius: '12px',
                                                background: isJoined ? '#f1f5f9' : 'var(--color-primary)',
                                                color: isJoined ? '#94a3b8' : 'white',
                                                border: 'none',
                                                fontWeight: '700',
                                                fontSize: '0.9rem',
                                                cursor: isJoined ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {isJoined ? 'Añadido' : <><Plus size={18} /> Apuntarse</>}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Info */}
                <div style={{ padding: '16px 24px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={14} /> Los torneos añadidos mantienen su ID único para leaderboards globales.
                    </p>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8' }}>
                        {filtered.length} torneos encontrados
                    </div>
                </div>
            </div>
        </div>
    );
}
