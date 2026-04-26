import { useMemo } from 'react';
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
const HandicapView = ({ currentHandicap, history = [] }) => {


    const displayHistory = useMemo(() => {
        if (!history.length) return [];
        
        // Clonamos y ordenamos de más antiguo a más reciente
        const sorted = [...history].reverse();
        
        if (currentHandicap) {
            const lastEntry = sorted[sorted.length - 1];
            // Si el handicap actual es diferente al último registrado en el historial,
            // inyectamos un punto "Actual" para que la gráfica lo refleje.
            if (parseFloat(lastEntry.handicap) !== parseFloat(currentHandicap)) {
                sorted.push({
                    handicap: parseFloat(currentHandicap),
                    date: new Date().toISOString(),
                    source: 'current',
                    tournament: 'Hándicap actual'
                });
            } else {
                // Si coinciden, simplemente marcamos el último como 'current' para que se pinte verde
                lastEntry.source = 'current';
            }
        }
        
        return sorted;
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
    return (
        <div className="fade-in" style={{ maxWidth: 820, margin: '0 auto', paddingBottom: '4rem' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                <TrendingUp
                    size={26}
                    color="var(--color-primary)"
                />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                    Evolución Hándicap
                </h2>
            </div>

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
                    {displayHistory.length > 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', background: 'rgba(22,163,74,0.12)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                            {displayHistory.length} puntos
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
