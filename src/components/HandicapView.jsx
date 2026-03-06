import { useState, useEffect, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, Award } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// ─── helpers ────────────────────────────────────────────────────
const fmtDate = (isoString) => {
    const d = new Date(isoString);
    // Guard against invalid dates
    if (isNaN(d)) return isoString;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const fmtDateLong = (isoString) => {
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

// ─── component ──────────────────────────────────────────────────
const HandicapView = ({ user, currentHandicap }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [source, setSource] = useState('');
    const [pdfEntries, setPdfEntries] = useState(0);
    const [error, setError] = useState('');

    // ── initial load ──────────────────────────────────────────
    useEffect(() => {
        if (!user) return;

        const lastSyncKey = `hcp_last_sync_v2_${user.username}`;
        const lastSync = localStorage.getItem(lastSyncKey);
        const today = new Date().toISOString().slice(0, 10);

        if (lastSync !== today) {
            // Haven't synced today → fetch from PDF
            loadHistory(true).then(() => {
                localStorage.setItem(lastSyncKey, today);
            });
        } else {
            // Already synced today → read stored JSON, but only keep rfeg_pdf entries
            fetch(`./api/save_handicap_history.php?username=${user.username}&t=${Date.now()}`)
                .then(r => r.json())
                .then(data => {
                    // Filter to tournament-only data (discard old daily snapshots)
                    const pdfOnly = Array.isArray(data)
                        ? data.filter(e => e.source === 'rfeg_pdf')
                        : [];

                    if (pdfOnly.length === 0) {
                        // No valid tournament data → force re-sync from PDF
                        return loadHistory(true).then(() => {
                            localStorage.setItem(lastSyncKey, today);
                        });
                    }
                    // Good data → use filtered set
                    const sorted = [...pdfOnly].sort((a, b) => a.date.localeCompare(b.date));
                    setHistory(sorted);
                    setSource('stored');
                    setLoading(false);
                })
                .catch(() => loadHistory(true));
        }
    }, [user]);

    /**
     * loadHistory(forceRefresh):
     *  - forceRefresh=false → just GET the stored JSON (fast)
     *  - forceRefresh=true  → call the PDF endpoint to re-parse RFEG and merge/update
     */
    const loadHistory = async (forceRefresh = false) => {
        if (!user) return;
        forceRefresh ? setRefreshing(true) : setLoading(true);
        setError('');

        try {
            if (forceRefresh) {
                // Hit the PDF parsing endpoint
                const license = user.license || user.federation_id || '';
                const licenseParam = license ? `&license=${encodeURIComponent(license)}` : '';
                const url = `./api/get_handicap_history_pdf.php?username=${user.username}${licenseParam}&t=${Date.now()}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.history && Array.isArray(data.history)) {
                    setHistory(data.history);
                    setSource(data.source || '');
                    setPdfEntries(data.pdf_entries || 0);
                }
                if (data.error && !data.history?.length) {
                    setError(data.error);
                }
            } else {
                // Just read stored history (cheap)
                const res = await fetch(`./api/save_handicap_history.php?username=${user.username}&t=${Date.now()}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
                    setHistory(sorted);
                    setSource('stored');
                }
            }
        } catch (err) {
            setError('Error al cargar el historial.');
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // ── displayHistory: history + current handicap as final point ──────
    // The PDF Bloque 1 shows HCP after each tournament, but the REAL current
    // handicap may differ. We append it as today's point so the chart always
    // ends at the true current value.
    const displayHistory = useMemo(() => {
        const parsed = currentHandicap
            ? parseFloat(String(currentHandicap).replace(',', '.'))
            : null;
        const today = new Date().toISOString().slice(0, 10);

        if (!history.length && parsed) {
            return [{ date: today, handicap: parsed, source: 'current' }];
        }
        if (!history.length) return [];

        const lastEntry = history[history.length - 1];
        if (parsed && (lastEntry.handicap !== parsed || lastEntry.date !== today)) {
            return [...history, { date: today, handicap: parsed, source: 'current' }];
        }
        return history;
    }, [history, currentHandicap]);

    // ── derived stats ─────────────────────────────────────────
    const stats = useMemo(() => {
        if (!displayHistory.length) return null;
        const values = displayHistory.map(h => h.handicap);
        const maxHcp = Math.max(...values);
        const minHcp = Math.min(...values);
        const bajada = Math.max(0, parseFloat((maxHcp - minHcp).toFixed(1)));
        const firstEntry = displayHistory[0];
        const lastEntry = displayHistory[displayHistory.length - 1];
        return { maxHcp, minHcp, bajada, startHcp: firstEntry.handicap, current: lastEntry.handicap, firstEntry, lastEntry };
    }, [displayHistory]);

    // ── chart ─────────────────────────────────────────────────
    const chartData = useMemo(() => ({
        labels: displayHistory.map(h => fmtDate(h.date)),
        datasets: [
            {
                label: 'Hándicap WHS',
                data: displayHistory.map(h => h.handicap),
                borderColor: '#16a34a',
                backgroundColor: (ctx) => {
                    const chart = ctx.chart;
                    const { ctx: c, chartArea } = chart;
                    if (!chartArea) return 'rgba(22,163,74,0.15)';
                    const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(22,163,74,0.30)');
                    gradient.addColorStop(1, 'rgba(22,163,74,0.02)');
                    return gradient;
                },
                tension: 0.35,
                pointRadius: history.length > 40 ? 3 : 5,
                pointHoverRadius: 8,
                pointBackgroundColor: '#16a34a',
                fill: true,
                borderWidth: 2.5,
            },
        ],
    }), [history]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15,23,42,0.92)',
                titleColor: '#94a3b8',
                bodyColor: '#f8fafc',
                padding: 12,
                callbacks: {
                    title: (items) => {
                        const idx = items[0].dataIndex;
                        const entry = displayHistory[idx];
                        return fmtDateLong(entry.date);
                    },
                    label: (item) => {
                        const idx = item.dataIndex;
                        const entry = displayHistory[idx];
                        const tourn = entry.tournament ? `  📍 ${entry.tournament}` : '';
                        const src = entry.source === 'current' ? '★ Actual' :
                            entry.source === 'rfeg_pdf' ? '(RFEG)' : '';
                        return [`  HCP: ${entry.handicap} ${src}`, tourn].filter(Boolean);
                    },
                },
            },
        },
        scales: {
            y: {
                ticks: { color: '#64748b', font: { size: 11 } },
                grid: { color: 'rgba(148,163,184,0.12)' },
                title: { display: true, text: 'Hándicap WHS', color: '#94a3b8', font: { size: 11 } },
            },
            x: {
                ticks: {
                    color: '#64748b',
                    font: { size: 10 },
                    maxRotation: 45,
                    maxTicksLimit: 12,
                },
                grid: { display: false },
            },
        },
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 600 },
    }), [displayHistory]);

    // ── render ────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="fade-in" style={{ maxWidth: 820, margin: '0 auto', paddingBottom: '4rem' }}>
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    <TrendingUp size={28} color="var(--color-primary)" className="spin-animation" style={{ display: 'inline-block', marginBottom: 12 }} />
                    <p>Cargando historial…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ maxWidth: 820, margin: '0 auto', paddingBottom: '4rem' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                <TrendingUp
                    size={26}
                    color="var(--color-primary)"
                    className={refreshing ? 'spin-animation' : ''}
                />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                    Evolución Hándicap
                </h2>
                {refreshing && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                        actualizando…
                    </span>
                )}
            </div>

            {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#ef4444', fontSize: '0.875rem' }}>
                    ⚠️ {error}
                </div>
            )}

            {/* ── Stat Cards ── */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

                    {/* Hcp Inicial */}
                    <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Inicio</p>
                        <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                            {stats.startHcp}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            {fmtDate(stats.firstEntry.date)}
                        </p>
                    </div>

                    {/* Hcp Actual */}
                    <div className="card" style={{ padding: '1rem', textAlign: 'center', border: '2px solid var(--color-primary)' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Actual</p>
                        <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
                            {currentHandicap || stats.current}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            {fmtDate(stats.lastEntry.date)}
                        </p>
                    </div>

                    {/* Mejor Hcp */}
                    <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Mejor HCP</p>
                        <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#059669', margin: 0 }}>
                            {stats.minHcp}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            mínimo histórico
                        </p>
                    </div>

                    {/* Bajada Total */}
                    <div className="card" style={{ padding: '1rem', textAlign: 'center', background: stats.bajada > 0 ? 'rgba(5,150,105,0.08)' : undefined }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <TrendingDown size={12} /> Bajada total
                        </p>
                        <p style={{ fontSize: '1.8rem', fontWeight: 700, color: stats.bajada > 0 ? '#059669' : 'var(--color-text-muted)', margin: 0 }}>
                            {stats.bajada > 0 ? `−${stats.bajada}` : '0'}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            desde el máximo
                        </p>
                    </div>

                </div>
            )}

            {/* ── Chart ── */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                        Gráfico de evolución
                    </h3>
                    {source === 'rfeg_pdf' && pdfEntries > 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', background: 'rgba(22,163,74,0.12)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                            RFEG • {pdfEntries} torneos
                        </span>
                    )}
                </div>

                {displayHistory.length > 1 ? (
                    <div style={{ height: 300 }}>
                        <Line options={chartOptions} data={chartData} />
                    </div>
                ) : (
                    <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--color-text-muted)' }}>
                        <Award size={36} strokeWidth={1.5} />
                        <p style={{ margin: 0 }}>Sin datos suficientes para el gráfico.</p>
                    </div>
                )}
            </div>

            {/* ── History Table ── */}
            {displayHistory.length > 0 && (
                <div className="card">
                    <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                        Historial detallado
                        <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                            ({displayHistory.length} entradas · más reciente primero)
                        </span>
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 400, overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {[...displayHistory].reverse().map((entry, i) => {
                            const isPdf = entry.source === 'rfeg_pdf';
                            const isCurrent = entry.source === 'current';
                            const isFirst = entry === displayHistory[0]; // oldest = anchor
                            return (
                                <div key={i} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: isCurrent
                                        ? 'rgba(22,163,74,0.08)'
                                        : isFirst
                                            ? 'rgba(234,179,8,0.08)'
                                            : 'var(--color-surface-soft)',
                                    borderRadius: 8,
                                    border: isCurrent
                                        ? '1px solid rgba(22,163,74,0.4)'
                                        : isFirst
                                            ? '1px solid rgba(234,179,8,0.4)'
                                            : '1px solid var(--color-border)',
                                    fontSize: '0.9rem',
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                fontWeight: 700,
                                                fontSize: '1rem',
                                                color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-main)',
                                                minWidth: 36,
                                            }}>
                                                {entry.handicap}
                                            </span>
                                            {isCurrent && (
                                                <span style={{ fontSize: '0.68rem', background: 'rgba(22,163,74,0.2)', color: '#16a34a', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>
                                                    HOY
                                                </span>
                                            )}
                                            {isFirst && !isCurrent && (
                                                <span style={{ fontSize: '0.68rem', background: 'rgba(234,179,8,0.2)', color: '#ca8a04', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>
                                                    INICIO
                                                </span>
                                            )}
                                            {isPdf && !isFirst && (
                                                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                                    RFEG
                                                </span>
                                            )}
                                        </div>
                                        {entry.tournament && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                📍 {entry.tournament}
                                            </span>
                                        )}
                                    </div>

                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                        {fmtDateLong(entry.date)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
};

export default HandicapView;
