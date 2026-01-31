import { useState, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { TrendingUp, ArrowDown, ArrowUp, Activity, Star } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend
);

export default function StatsView({ results = {} }) {
    const [stats, setStats] = useState({
        roundsPlayed: 0,
        average: 0,
        bestRound: '-',
        worstRound: '-',
        distribution: {},
        // Stableford Stats
        stbTotal: 0,
        stbAverage: 0,
        stbBest: '-',
        stbWorst: '-',
        // Handicap Stats
        handicapHistory: [],
        scorecards: {},
        parStats: { par3: { total: 0, count: 0 }, par4: { total: 0, count: 0 }, par5: { total: 0, count: 0 } }
    });

    useEffect(() => {
        processData(results);
    }, [results]);

    const processData = (data) => {
        if (!data) return;

        const allRounds = [];
        const allStableford = [];
        const handicapHistory = [];

        // Par Stats containers
        const parStats = {
            par3: { total: 0, count: 0 },
            par4: { total: 0, count: 0 },
            par5: { total: 0, count: 0 }
        };

        Object.values(data).forEach(entry => {
            // Process Strokes
            if (entry.rounds && Array.isArray(entry.rounds)) {
                entry.rounds.forEach(r => {
                    const val = Number(r);
                    if (!isNaN(val) && val > 0) allRounds.push(val);
                });
            }
            // Process Stableford
            if (entry.stableford && Array.isArray(entry.stableford)) {
                entry.stableford.forEach(s => {
                    const val = Number(s);
                    if (!isNaN(val) && val > 0) allStableford.push(val);
                });
            }
            // Process Handicap
            if (entry.handicap && !isNaN(parseFloat(entry.handicap))) {
                handicapHistory.push({
                    hcp: parseFloat(entry.handicap),
                    date: entry.updatedAt || new Date().toISOString() // Fallback if no date
                });
            }

            // Process Detailed Scorecards for Par Stats
            if (entry.scorecards) {
                Object.values(entry.scorecards).forEach(card => {
                    if (card.pars && card.strokes) {
                        card.pars.forEach((p, idx) => {
                            const par = parseInt(p);
                            const score = parseInt(card.strokes[idx]);
                            if (par && score && !isNaN(par) && !isNaN(score)) {
                                if (par === 3) {
                                    parStats.par3.total += score;
                                    parStats.par3.count++;
                                } else if (par === 4) {
                                    parStats.par4.total += score;
                                    parStats.par4.count++;
                                } else if (par === 5) {
                                    parStats.par5.total += score;
                                    parStats.par5.count++;
                                }
                            }
                        });
                    }
                });
            }
        });

        // Sort Handicap History
        handicapHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate Strokes Stats
        let roundsPlayed = 0;
        let avg = 0;
        let min = '-';
        let max = '-';
        let dist = {};

        if (allRounds.length > 0) {
            const sum = allRounds.reduce((a, b) => a + b, 0);
            min = Math.min(...allRounds);
            max = Math.max(...allRounds);
            avg = (sum / allRounds.length).toFixed(1);
            roundsPlayed = allRounds.length;

            allRounds.forEach(r => {
                dist[r] = (dist[r] || 0) + 1;
            });
        }

        // Calculate Stableford Stats
        let stbTotal = 0;
        let stbAvg = 0;
        let stbMin = '-';
        let stbMax = '-';

        if (allStableford.length > 0) {
            stbTotal = allStableford.reduce((a, b) => a + b, 0);
            stbAvg = (stbTotal / allStableford.length).toFixed(1);
            stbMin = Math.min(...allStableford); // Technically "worst" stableford
            stbMax = Math.max(...allStableford); // Technically "best" stableford
        }

        setStats({
            roundsPlayed,
            average: avg,
            bestRound: min,
            worstRound: max,
            distribution: dist,
            stbTotal,
            stbAverage: stbAvg,
            stbBest: stbMax !== '-' ? stbMax : '-',
            stbWorst: stbMin !== '-' ? stbMin : '-',
            handicapHistory,
            parStats
        });
    };

    // Chart Data - Distribution
    const sortedScores = Object.keys(stats.distribution).map(Number).sort((a, b) => a - b);
    const chartData = {
        labels: sortedScores,
        datasets: [
            {
                label: 'Veces',
                data: sortedScores.map(s => stats.distribution[s]),
                backgroundColor: 'rgba(5, 71, 42, 0.6)',
                borderColor: 'rgba(5, 71, 42, 1)',
                borderWidth: 1,
                borderRadius: 4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: 'Distribución de Golpes',
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
            }
        }
    };



    return (
        <div className="stats-container fade-in">
            <div className="card" style={{
                background: 'var(--color-surface)',
                border: '1px solid #E5E1DE',
                padding: '3rem 2rem',
                borderRadius: '4px',
                textAlign: 'center',
                boxShadow: 'none',
                marginBottom: '2rem'
            }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '300', marginBottom: '0.5rem', color: 'var(--color-secondary)', letterSpacing: '0.1em' }}>Performance Overview</h2>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '200', margin: 0, letterSpacing: '0.2em' }}>MY STATS</h1>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {/* Stroke Play Stats */}
                <div className="card" style={{ padding: '2rem', border: '1px solid #E5E1DE', boxShadow: 'none' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: '500', marginBottom: '1.5rem', borderBottom: '1px solid #E5E1DE', paddingBottom: '0.5rem', letterSpacing: '0.1em' }}>STROKE PLAY</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        {[
                            { label: 'RONDAS', val: stats.roundsPlayed },
                            { label: 'MEDIA', val: stats.average },
                            { label: 'MEJOR', val: stats.bestRound },
                            { label: 'ALTA', val: stats.worstRound }
                        ].map(item => (
                            <div key={item.label} style={{ textAlign: 'center', padding: '1rem', background: 'var(--color-surface-soft)', borderRadius: '2px' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>{item.label}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '200' }}>{item.val}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stableford Stats */}
                <div className="card" style={{ padding: '2rem', border: '1px solid #E5E1DE', boxShadow: 'none' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: '500', marginBottom: '1.5rem', borderBottom: '1px solid #E5E1DE', paddingBottom: '0.5rem', letterSpacing: '0.1em' }}>STABLEFORD</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        {[
                            { label: 'TOTAL', val: stats.stbTotal },
                            { label: 'MEDIA', val: stats.stbAverage },
                            { label: 'MEJOR', val: stats.stbBest },
                            { label: 'PEOR', val: stats.stbWorst }
                        ].map(item => (
                            <div key={item.label} style={{ textAlign: 'center', padding: '1rem', background: 'var(--color-surface-soft)', borderRadius: '2px' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>{item.label}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '200' }}>{item.val}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Par Performance Section */}
            {stats.parStats && (stats.parStats.par3.count > 0 || stats.parStats.par4.count > 0 || stats.parStats.par5.count > 0) && (
                <div className="card" style={{ marginBottom: '2rem', padding: '2rem', border: '1px solid #E5E1DE', boxShadow: 'none' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: '500', marginBottom: '1.5rem', borderBottom: '1px solid #E5E1DE', paddingBottom: '0.5rem', letterSpacing: '0.1em' }}>PAR PERFORMANCE</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                        {[3, 4, 5].map(par => {
                            const data = stats.parStats[`par${par}`];
                            const avg = data.count > 0 ? (data.total / data.count).toFixed(2) : '-';
                            const diff = data.count > 0 ? ((data.total / data.count) - par).toFixed(2) : 0;
                            const diffColor = diff > 0 ? '#b25d5d' : (diff < 0 ? '#10b981' : 'var(--color-text-muted)');
                            const diffSign = diff > 0 ? '+' : '';

                            return (
                                <div key={par} style={{ textAlign: 'center', padding: '1.5rem 0.5rem', background: 'var(--color-surface-soft)', borderRadius: '2px' }}>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--color-secondary)', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>PAR {par}</div>
                                    <div style={{ fontSize: '2rem', fontWeight: '200' }}>{avg}</div>
                                    {data.count > 0 && (
                                        <div style={{ fontSize: '0.8rem', color: diffColor, fontWeight: '400', marginTop: '0.4rem' }}>
                                            {diffSign}{diff}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Bar
                        data={{
                            labels: ['Par 3', 'Par 4', 'Par 5'],
                            datasets: [{
                                label: 'Sobre/Bajo Par',
                                data: [3, 4, 5].map(par => {
                                    const data = stats.parStats[`par${par}`];
                                    return data.count > 0 ? ((data.total / data.count) - par).toFixed(2) : 0;
                                }),
                                backgroundColor: (context) => {
                                    const value = context.raw;
                                    return value > 0 ? '#b25d5d' : (value < 0 ? '#10b981' : '#E5E1DE');
                                },
                                borderRadius: 0,
                                borderSkipped: false,
                                borderColor: '#E5E1DE',
                                borderWidth: 1
                            }]
                        }}
                        options={{
                            responsive: true,
                            plugins: {
                                legend: { display: false },
                                title: { display: false }
                            },
                            scales: {
                                y: {
                                    ticks: {
                                        font: { size: 10, weight: '300' },
                                        callback: (v) => v > 0 ? '+' + v : v
                                    },
                                    grid: {
                                        color: (c) => c.tick.value === 0 ? '#E2B49A' : '#f0f0f0',
                                        lineWidth: (c) => c.tick.value === 0 ? 1 : 0.5
                                    }
                                },
                                x: {
                                    ticks: { font: { size: 10, weight: '300' } },
                                    grid: { display: false }
                                }
                            }
                        }}
                    />
                </div>
            )}

            {/* Distribution Chart */}
            <div className="card" style={{ border: '1px solid #E5E1DE', padding: '2rem', boxShadow: 'none' }}>
                <Bar options={{
                    ...chartOptions,
                    plugins: {
                        ...chartOptions.plugins,
                        title: { ...chartOptions.plugins.title, font: { weight: '300', size: 14, letterSpacing: '0.1em' } }
                    },
                    scales: {
                        ...chartOptions.scales,
                        y: { ...chartOptions.scales.y, grid: { color: '#f0f0f0' }, ticks: { font: { size: 10, weight: '300' } } },
                        x: { grid: { display: false }, ticks: { font: { size: 10, weight: '300' } } }
                    }
                }} data={{
                    ...chartData,
                    datasets: [{
                        ...chartData.datasets[0],
                        backgroundColor: '#E2B49A',
                        borderColor: '#C5B4A5',
                        borderWidth: 1,
                        borderRadius: 2
                    }]
                }} />
            </div>
        </div>
    );
}
