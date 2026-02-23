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

export default function StatsView({ results = {}, tournaments = [] }) {
    const [stats, setStats] = useState({
        roundsPlayed: 0,
        average: 0,
        bestRound: '-',
        worstRound: '-',
        history: [], // Recent rounds history
        // Stableford Stats
        stbTotal: 0,
        stbAverage: 0,
        stbBest: '-',
        stbWorst: '-',
        // Handicap Stats
        handicapHistory: [],
        scorecards: {},

        parStats: { par3: { total: 0, count: 0 }, par4: { total: 0, count: 0 }, par5: { total: 0, count: 0 } },
        puttStats: { total: 0, rounds: 0, average: 0, best: '-', worst: '-' }
    });

    const [filterMode, setFilterMode] = useState('count'); // 'count' | 'month' | 'year'
    const [filterValue, setFilterValue] = useState('5'); // '5', '10', '15', '20', 'all' | 'YYYY-MM' | 'YYYY'
    const [availableMonths, setAvailableMonths] = useState([]);
    const [availableYears, setAvailableYears] = useState([]);

    useEffect(() => {
        // If no results, reset stats and return
        if (!results || Object.keys(results).length === 0) {
            setStats({
                roundsPlayed: 0,
                average: 0,
                bestRound: '-',
                worstRound: '-',
                history: [],
                stbTotal: 0,
                stbAverage: 0,
                stbBest: '-',
                stbWorst: '-',
                handicapHistory: [],
                scorecards: {},
                parStats: { par3: { total: 0, count: 0 }, par4: { total: 0, count: 0 }, par5: { total: 0, count: 0 } },
                puttStats: { total: 0, rounds: 0, average: 0, best: '-', worst: '-' }
            });
            return;
        }

        // 1. Flatten and Sort Results to determine available months and order
        const tournMap = new Map((tournaments || []).map(t => [t.id, t]));
        const sortedEntries = Object.entries(results).map(([id, data]) => {
            let date = new Date().getTime();
            if (data.updatedAt) {
                date = new Date(data.updatedAt).getTime();
            } else if (tournMap.has(id)) {
                // Try parse tournament date
                const t = tournMap.get(id);
                if (t.dates) {
                    const parts = t.dates.split('/').map(Number);
                    if (parts.length >= 3) date = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
                }
            }
            return { id, data, date };
        }).sort((a, b) => b.date - a.date); // Newest first

        // 2. Extract Available Months and Years
        const months = new Set();
        const years = new Set();
        sortedEntries.forEach(entry => {
            const d = new Date(entry.date);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthKey);
            years.add(d.getFullYear().toString());
        });
        const monthList = Array.from(months).sort().reverse(); // Decending months
        setAvailableMonths(monthList);

        const yearList = Array.from(years).sort().reverse(); // Decending years
        setAvailableYears(yearList);

        // 3. Apply Filter
        let filteredEntries = [];

        if (filterMode === 'count') {
            if (filterValue === 'all') {
                filteredEntries = sortedEntries;
            } else {
                const limit = parseInt(filterValue) || 5;
                filteredEntries = sortedEntries.slice(0, limit);
            }
        } else if (filterMode === 'month') {
            // If date matches 'YYYY-MM'
            // If filterValue is not set (e.g. init), pick first month
            const targetMonth = filterValue && filterValue !== '5' && filterValue !== '10' && filterValue !== '15' && filterValue !== '20' && filterValue !== 'all' ? filterValue : (monthList[0] || '');

            filteredEntries = sortedEntries.filter(entry => {
                const d = new Date(entry.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === targetMonth;
            });
        } else if (filterMode === 'year') {
            // If filterValue is not set correctly, pick first year
            const targetYear = (filterValue && filterValue.length === 4) ? filterValue : (yearList[0] || '');

            filteredEntries = sortedEntries.filter(entry => {
                const d = new Date(entry.date);
                return d.getFullYear().toString() === targetYear;
            });
        }

        // 4. Reconstruct Results Object for processData
        const filteredResults = {};
        filteredEntries.forEach(e => {
            filteredResults[e.id] = e.data;
        });

        processData(filteredResults, tournaments || []);
    }, [results, tournaments, filterMode, filterValue]);

    const processData = (data, tournList) => {
        if (!data) return;

        const allRounds = [];
        const allStableford = [];

        const allPutts = []; // Array of total putts per round
        const handicapHistory = [];
        const historyData = [];

        // Par Stats containers
        const parStats = {
            par3: { total: 0, count: 0 },
            par4: { total: 0, count: 0 },
            par5: { total: 0, count: 0 }
        };

        const tournMap = new Map(tournList.map(t => [t.id, t]));

        Object.entries(data).forEach(([tournId, entry]) => {
            const tournament = tournMap.get(tournId);
            const tournName = tournament ? tournament.name : 'Torneo';
            // Try to approximate date: entry.updatedAt or tournament.dates (parsed) or now
            // Simple sort key: updatedAt > tournament.dates > timestamp
            let dateSortKey = new Date().getTime();
            if (entry.updatedAt) {
                dateSortKey = new Date(entry.updatedAt).getTime();
            }

            // Process Strokes
            if (entry.rounds && Array.isArray(entry.rounds)) {
                entry.rounds.forEach((r, idx) => {
                    const val = Number(r);
                    if (!isNaN(val) && val > 0) {
                        allRounds.push(val);

                        // Calculate Par for this round
                        let roundPar = 72; // Default
                        let hasScorecard = false;

                        if (entry.scorecards && entry.scorecards[idx] && entry.scorecards[idx].pars) {
                            const pars = entry.scorecards[idx].pars.map(Number);
                            if (pars.length > 0 && !pars.some(isNaN)) {
                                roundPar = pars.reduce((a, b) => a + b, 0);
                                hasScorecard = true;
                            }
                        }

                        historyData.push({
                            score: val,
                            par: roundPar,
                            diff: val - roundPar,
                            label: `${tournName} (R${idx + 1})`.substring(0, 15) + (tournName.length > 15 ? '...' : ''),
                            fullLabel: `${tournName} - R${idx + 1}`,
                            date: dateSortKey + idx, // Add idx to preserve round order
                            isEstimatedPar: !hasScorecard
                        });
                    }

                    // Process Putts for this round
                    let puttsVal = 0;
                    if (entry.totalPutts && entry.totalPutts[idx]) {
                        puttsVal = parseInt(entry.totalPutts[idx]) || 0;
                    } else if (entry.scorecards && entry.scorecards[idx] && entry.scorecards[idx].putts) {
                        puttsVal = entry.scorecards[idx].putts.reduce((acc, p) => acc + (parseInt(p) || 0), 0);
                    }

                    if (puttsVal > 0) {
                        allPutts.push(puttsVal);
                    }
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
                    date: entry.updatedAt || new Date().toISOString()
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

        // Sort and Slice History (Now controlled by filters)
        historyData.sort((a, b) => a.date - b.date);
        const recentHistory = historyData;

        // Calculate Strokes Stats
        let roundsPlayed = 0;
        let avg = 0;
        let min = '-';
        let max = '-';
        // Removed distribution calculation as we use history now

        if (allRounds.length > 0) {
            const sum = allRounds.reduce((a, b) => a + b, 0);
            min = Math.min(...allRounds);
            max = Math.max(...allRounds);
            avg = (sum / allRounds.length).toFixed(1);
            roundsPlayed = allRounds.length;
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
            stbMin = Math.min(...allStableford); // Technically "worst" stableford
            stbMax = Math.max(...allStableford); // Technically "best" stableford
        }

        // Calculate Putt Stats
        let puttTotal = 0;
        let puttAvg = 0;
        let puttBest = '-';
        let puttWorst = '-';

        if (allPutts.length > 0) {
            puttTotal = allPutts.reduce((a, b) => a + b, 0);
            puttAvg = (puttTotal / allPutts.length).toFixed(1);
            puttBest = Math.min(...allPutts);
            puttWorst = Math.max(...allPutts);
        }

        setStats({
            roundsPlayed,
            average: avg,
            bestRound: min,
            worstRound: max,
            history: recentHistory,
            stbTotal,
            stbAverage: stbAvg,
            stbBest: stbMax !== '-' ? stbMax : '-',
            stbWorst: stbMin !== '-' ? stbMin : '-',
            handicapHistory,
            parStats,
            puttStats: { total: puttTotal, rounds: allPutts.length, average: puttAvg, best: puttBest, worst: puttWorst }
        });
    };

    // Chart Data - History vs Par
    const chartData = {
        labels: stats.history.map(h => h.label),
        datasets: [
            {
                label: 'Result vs Par',
                data: stats.history.map(h => h.diff),
                backgroundColor: stats.history.map(h => {
                    if (h.diff < 0) return '#10b981'; // Green for under par
                    if (h.diff > 0) return '#e2b49a'; // Reddish for over par
                    return '#9ca3af'; // Grey for Par
                }),
                borderColor: stats.history.map(h => {
                    if (h.diff < 0) return '#059669';
                    if (h.diff > 0) return '#c2947a';
                    return '#6b7280';
                }),
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
                text: 'Rendimiento (Últimas Vueltas)',
                font: { weight: '300', size: 14, letterSpacing: '0.1em' }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const idx = context.dataIndex;
                        const item = stats.history[idx];
                        const sign = item.diff > 0 ? '+' : '';
                        return `${sign}${item.diff} (Score: ${item.score}, Par: ${item.par})`;
                    },
                    title: (context) => {
                        const idx = context[0].dataIndex;
                        return stats.history[idx].fullLabel;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: 'Golpes vs Par' },
                ticks: {
                    stepSize: 1,
                    font: { size: 10, weight: '300' },
                    callback: (v) => v > 0 ? '+' + v : v
                },
                grid: {
                    color: (c) => c.tick.value === 0 ? '#666' : '#f0f0f0',
                    lineWidth: (c) => c.tick.value === 0 ? 1 : 0.5
                }
            },
            x: {
                ticks: { font: { size: 9, weight: '300' }, maxRotation: 45, minRotation: 45 },
                grid: { display: false }
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
                <h1 style={{ fontSize: '2.5rem', fontWeight: '200', margin: 0, letterSpacing: '0.2em', marginBottom: '1.5rem' }}>MY STATS</h1>

                {/* FILTERS */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <select
                        value={filterMode}
                        onChange={(e) => {
                            setFilterMode(e.target.value);
                            // Reset val if needed
                            if (e.target.value === 'count') setFilterValue('5');
                            if (e.target.value === 'month' && availableMonths.length > 0) setFilterValue(availableMonths[0]);
                            if (e.target.value === 'year' && availableYears.length > 0) setFilterValue(availableYears[0]);
                        }}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                    >
                        <option value="count">Últimos Torneos</option>
                        <option value="month">Por Mes</option>
                        <option value="year">Por Año</option>
                    </select>

                    {filterMode === 'count' && (
                        <select
                            value={filterValue}
                            onChange={(e) => setFilterValue(e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                        >
                            <option value="5">Últimos 5</option>
                            <option value="10">Últimos 10</option>
                            <option value="15">Últimos 15</option>
                            <option value="20">Últimos 20</option>
                            <option value="all">Todos</option>
                        </select>
                    )}

                    {filterMode === 'month' && (
                        <select
                            value={filterValue}
                            onChange={(e) => setFilterValue(e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                        >
                            {availableMonths.length === 0 && <option value="">Sin datos</option>}
                            {availableMonths.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    )}

                    {filterMode === 'year' && (
                        <select
                            value={filterValue}
                            onChange={(e) => setFilterValue(e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                        >
                            {availableYears.length === 0 && <option value="">Sin datos</option>}
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    )}
                </div>
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

            {/* Putt Stats */}
            {stats.puttStats?.rounds > 0 && (
                <div className="card" style={{ padding: '2rem', border: '1px solid #E5E1DE', boxShadow: 'none' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: '500', marginBottom: '1.5rem', borderBottom: '1px solid #E5E1DE', paddingBottom: '0.5rem', letterSpacing: '0.1em' }}>PUTTS</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        {[
                            { label: 'RONDAS', val: stats.puttStats?.rounds || 0 },
                            { label: 'MEDIA', val: stats.puttStats?.average || 0 },
                            { label: 'MEJOR', val: stats.puttStats?.best || '-' },
                            { label: 'TOTAL', val: stats.puttStats?.total || 0 }
                        ].map(item => (
                            <div key={item.label} style={{ textAlign: 'center', padding: '1rem', background: 'var(--color-surface-soft)', borderRadius: '2px' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>{item.label}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '200' }}>{item.val}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Par Performance Section */}
            {
                stats.parStats && (stats.parStats.par3.count > 0 || stats.parStats.par4.count > 0 || stats.parStats.par5.count > 0) && (
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
                )
            }

            {/* Recent History Chart */}
            <div className="card" style={{ border: '1px solid #E5E1DE', padding: '2rem', boxShadow: 'none' }}>
                <Bar options={chartOptions} data={chartData} />
            </div>
        </div >
    );
}
