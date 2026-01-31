import { useState, useEffect } from 'react';
import { Trophy, Save, Edit2, ChevronLeft, Calendar as CalendarIcon, Hash, Trash2 } from 'lucide-react';

// -------------------------------------------------------------------------
// LOGIC HELPERS
// -------------------------------------------------------------------------
const parseDateHelper = (dateStr) => {
    if (!dateStr) return { start: 0, end: 0 };
    // Format: "dd/mm/yyyy" or "dd/mm/yyyy - dd/mm/yyyy"
    const parts = dateStr.split(' - ');

    const parse = (d) => {
        const [day, month, year] = d.split('/').map(Number);
        // Create date in local time (00:00:00)
        return new Date(year, month - 1, day).getTime();
    };

    const start = parse(parts[0]);
    const end = parts.length > 1 ? parse(parts[1]) : start;
    return { start, end };
};

const getRoundDates = (dateStr) => {
    const { start, end } = parseDateHelper(dateStr);
    const dates = [];
    let current = new Date(start);
    const endDate = new Date(end);

    // Safety break to prevent infinite loops if dates are weird
    let safety = 0;
    while (current <= endDate && safety < 10) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
        safety++;
    }
    return dates;
};

export default function ResultsView({ initialTournamentId, results = {}, tournaments = [], onUpdateResults }) {
    const [selectedTournament, setSelectedTournament] = useState(null); // ID of tournament in Detail View

    // Form State
    const [formData, setFormData] = useState({
        position: '',
        rounds: [], // Array of strings (can be '72' or '3&2')
        stableford: [], // Array of numbers
        points: '',
        comments: ''
    });

    useEffect(() => {
        // If initial ID provided, use it
        if (initialTournamentId) {
            const t = tournaments.find(x => x.id === initialTournamentId);
            if (t) {
                handleOpenDetailInternal(t, results);
            }
        }
    }, [initialTournamentId]);

    // -------------------------------------------------------------------------
    // HANDLERS
    // -------------------------------------------------------------------------


    const handleOpenDetailInternal = (t, currentResults) => {
        const existing = currentResults[t.id] || {};
        const roundDates = getRoundDates(t.dates);

        const initializedRounds = roundDates.map((_, i) =>
            (existing.rounds && existing.rounds[i]) ? existing.rounds[i] : ''
        );

        const initializedStableford = roundDates.map((_, i) =>
            (existing.stableford && existing.stableford[i]) ? existing.stableford[i] : ''
        );

        setFormData({
            position: existing.position || '',
            rounds: initializedRounds,
            stableford: initializedStableford,
            stableford: initializedStableford,
            points: existing.points || '',
            comments: existing.comments || '',
            handicap: existing.handicap || ''
        });
        setSelectedTournament(t);
    };

    const handleOpenDetail = (t) => {
        handleOpenDetailInternal(t, results);
    };

    const handleBack = () => {
        setSelectedTournament(null);
    };

    const calculateStats = (rounds, stableford) => {
        // Strokes Stats
        const validScores = rounds.filter(r => r && !isNaN(r)).map(Number);
        const totalStrokes = validScores.reduce((a, b) => a + b, 0);
        const avgStrokes = validScores.length > 0 ? (totalStrokes / validScores.length).toFixed(1) : 0;

        // Stableford Stats
        const validStableford = stableford ? stableford.filter(r => r && !isNaN(r)).map(Number) : [];
        const totalStableford = validStableford.reduce((a, b) => a + b, 0);

        return {
            total: totalStrokes,
            average: avgStrokes,
            count: validScores.length,
            stablefordTotal: totalStableford
        };
    };

    const handleRoundChange = (index, field, value) => {
        const newData = [...formData[field]];
        newData[index] = value;
        setFormData(prev => ({ ...prev, [field]: newData }));
    };

    const handleSaveCurrent = () => {
        if (!selectedTournament) return;

        const stats = calculateStats(formData.rounds, formData.stableford);

        const entry = {
            position: formData.position,
            rounds: formData.rounds,
            stableford: formData.stableford, // Save stableford
            total: stats.total,
            average: stats.average,
            stablefordTotal: stats.stablefordTotal,
            points: formData.points,
            comments: formData.comments,
            handicap: formData.handicap,
            updatedAt: new Date().toISOString()
        };

        const newResults = { ...results, [selectedTournament.id]: entry };
        onUpdateResults(newResults);
        setSelectedTournament(null);
    };

    const handleDeleteResult = () => {
        if (!selectedTournament) return;

        if (window.confirm('¿Seguro que quieres borrar estos resultados?')) {
            const newResults = { ...results };
            delete newResults[selectedTournament.id];
            onUpdateResults(newResults);
            setSelectedTournament(null);
        }
    };

    // -------------------------------------------------------------------------
    // VIEW RENDERERS
    // -------------------------------------------------------------------------

    // DETAIL VIEW
    if (selectedTournament) {
        const roundDates = getRoundDates(selectedTournament.dates);
        const stats = calculateStats(formData.rounds, formData.stableford);

        return (
            <div className="detail-view fade-in">
                <button onClick={handleBack} className="btn" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ChevronLeft size={16} /> Volver
                </button>

                <div className="card" style={{ borderTop: '4px solid var(--color-primary)' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{selectedTournament.name}</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{selectedTournament.dates} • {selectedTournament.course}</p>

                    {/* Stats Summary Card */}
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>TOTAL GOLPES</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{stats.total || '-'}</span>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>MEDIA</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.average || '-'}</span>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>TOTAL STB</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>{stats.stablefordTotal || '-'}</span>
                        </div>
                    </div>

                    {/* Rounds Inputs */}
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Resultados por Ronda</h3>
                    <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                        {roundDates.map((date, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'white', border: '1px solid #eee', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontWeight: '600', display: 'block' }}>Ronda {idx + 1}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{date.toLocaleDateString()}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        type="text"
                                        placeholder="Golpes / MP"
                                        value={formData.rounds[idx] || ''}
                                        onChange={(e) => handleRoundChange(idx, 'rounds', e.target.value)}
                                        style={{ width: '100px', padding: '8px', fontSize: '1rem', textAlign: 'center', borderRadius: '6px', border: '1px solid #ccc' }}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Stb"
                                        value={formData.stableford[idx] || ''}
                                        onChange={(e) => handleRoundChange(idx, 'stableford', e.target.value)}
                                        style={{ width: '60px', padding: '8px', fontSize: '1rem', textAlign: 'center', borderRadius: '6px', border: '1px solid #ccc', background: '#f9f9f9' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Meta Inputs */}
                    <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '0.9rem' }}>Posición Final</label>
                            <input
                                type="text"
                                placeholder="Ej: T5"
                                value={formData.position}
                                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '0.9rem' }}>Handicap Inicio Torneo</label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="Ej: 14.5"
                                value={formData.handicap || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, handicap: e.target.value }))}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-outline-danger" style={{ flex: 1, padding: '12px', justifyContent: 'center', borderColor: '#ef4444', color: '#ef4444' }} onClick={handleDeleteResult}>
                            <Trash2 size={18} style={{ marginRight: '8px' }} />
                            Borrar
                        </button>
                        <button className="btn btn-primary" style={{ flex: 2, padding: '12px', justifyContent: 'center' }} onClick={handleSaveCurrent}>
                            <Save size={18} style={{ marginRight: '8px' }} />
                            Guardar Resultados
                        </button>
                    </div>

                </div>
            </div>
        );
    }

    // LIST VIEW (Default)
    const sortedList = [...tournaments].sort((a, b) => parseDateHelper(b.dates).start - parseDateHelper(a.dates).start);

    return (
        <div className="results-container">
            <div className="card" style={{ marginBottom: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, var(--color-primary) 0%, #143a22 100%)', color: 'white' }}>
                <h2 style={{ color: 'white', marginBottom: '0.5rem' }}>Resultados & Palmarés</h2>
                <p style={{ opacity: 0.9 }}>Selecciona un torneo para introducir los resultados detallados.</p>
            </div>

            <div className="results-grid" style={{ display: 'grid', gap: '1rem' }}>
                {sortedList.map(t => {
                    const result = results[t.id];
                    const hasResult = !!result;

                    return (
                        <div key={t.id} className="card fade-in"
                            style={{ cursor: 'pointer', borderLeft: hasResult ? '4px solid var(--color-accent)' : '4px solid transparent' }}
                            onClick={() => handleOpenDetail(t)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{t.name}</h3>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{t.dates}</span>
                                </div>
                                <Edit2 size={16} color="var(--color-text-muted)" />
                            </div>

                            {hasResult && (
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '1.5rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Posición</span>
                                        <div style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{result.position || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total</span>
                                        <div style={{ fontWeight: 'bold' }}>
                                            {result.total > 0 ? (
                                                <>
                                                    {result.total} <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>({result.average} avg)</span>
                                                </>
                                            ) : (
                                                <span style={{ fontSize: '0.9rem', color: '#666' }}>Match Play / Sin Golpes</span>
                                            )}
                                        </div>
                                    </div>
                                    {result.stablefordTotal > 0 && (
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Stb</span>
                                            <div style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>{result.stablefordTotal} pts</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
