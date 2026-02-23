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
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Save, Plus, TrendingUp } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const parseDateHelper = (dateStr) => {
    if (!dateStr) return new Date().getTime();
    const parts = dateStr.split(' - ');
    const firstDate = parts[0];
    const [day, month, year] = firstDate.split('/').map(Number);
    return new Date(year, month - 1, day).getTime();
};

const HandicapView = ({ user, currentHandicap, results = {}, tournaments = [] }) => {
    const [manualHistory, setManualHistory] = useState([]);
    const [newDate, setNewDate] = useState('');
    const [newHandicap, setNewHandicap] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [currentHandicap]);

    const fetchHistory = async () => {
        if (!user) return;
        try {
            const response = await fetch(`./api/save_handicap_history.php?username=${user.username}&t=${Date.now()}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                data.sort((a, b) => new Date(a.date) - new Date(b.date));
                setManualHistory(data);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newDate || !newHandicap || !user) return;

        const newEntry = { date: newDate, handicap: parseFloat(newHandicap) };
        const updatedHistory = [...manualHistory, newEntry].sort((a, b) => new Date(a.date) - new Date(b.date));

        try {
            const response = await fetch('./api/save_handicap_history.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user.username,
                    history: updatedHistory
                })
            });
            const result = await response.json();
            if (result.success) {
                setManualHistory(updatedHistory);
                setNewDate('');
                setNewHandicap('');
            }
        } catch (error) {
            console.error("Error saving history:", error);
        }
    };

    // Merge manual history with tournament results
    const combinedHistory = useMemo(() => {
        const tournamentEntries = [];

        // Map tournament IDs to objects for easy lookup (use String keys)
        const tournMap = new Map((tournaments || []).map(t => [String(t.id), t]));

        Object.entries(results).forEach(([id, data]) => {
            // Normalize handicap value (replace comma with dot)
            const rawHcp = String(data.handicap).replace(',', '.');
            const parsedHcp = parseFloat(rawHcp);

            // Check for tournament start handicap
            if (data.handicap && !isNaN(parsedHcp)) {
                const tournament = tournMap.get(String(id));
                // Use tournament date if available, otherwise updatedAt, otherwise now
                let dateTimestamp = new Date().getTime();
                let label = 'Torneo';

                if (tournament && tournament.dates) {
                    dateTimestamp = parseDateHelper(tournament.dates);
                    label = tournament.name || 'Torneo';
                } else if (data.updatedAt) {
                    dateTimestamp = new Date(data.updatedAt).getTime();
                }

                tournamentEntries.push({
                    date: new Date(dateTimestamp).toISOString(),
                    handicap: parsedHcp,
                    source: 'tournament',
                    label: label
                });
            }
        });

        // 1. Initial Sort of all available data
        let all = [...manualHistory, ...tournamentEntries];
        all.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. Find the index/date of the FIRST "Handicap Start Tournament" entry
        const firstTournamentEntry = all.find(entry => entry.source === 'tournament');

        if (firstTournamentEntry) {
            const startDate = new Date(firstTournamentEntry.date).getTime();
            // Filter out anything older than this start date
            all = all.filter(entry => new Date(entry.date).getTime() >= startDate);
        }

        return all;
    }, [manualHistory, results, tournaments]);


    const chartData = {
        labels: combinedHistory.map(h => {
            const d = new Date(h.date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        }),
        datasets: [
            {
                label: 'Hándicap',
                data: combinedHistory.map(h => h.handicap),
                borderColor: '#166534',
                backgroundColor: 'rgba(22, 101, 52, 0.5)',
                tension: 0.3,
                pointRadius: 6,
                pointHoverRadius: 8,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                labels: { color: '#374151' }
            },
            title: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const idx = context.dataIndex;
                        const item = combinedHistory[idx];
                        const source = item.source === 'tournament' ? ` (${item.label})` : '';
                        return `Hcp: ${item.handicap}${source}`;
                    }
                }
            }
        },
        scales: {
            y: {
                ticks: { color: '#374151' },
                grid: { color: '#e5e7eb' },
            },
            x: {
                ticks: { color: '#374151' },
                grid: { display: false }
            }
        }
    };

    return (
        <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <TrendingUp size={24} style={{ color: 'var(--color-primary)', marginRight: '10px' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-main)', margin: 0 }}>Evolución Hándicap</h2>
                </div>

                <div style={{ height: '300px', marginBottom: '2rem' }}>
                    {combinedHistory.length > 0 ? (
                        <Line options={options} data={chartData} />
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                            No hay datos registrados aún.
                        </div>
                    )}
                </div>
            </div>

            <div className="card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--color-text-main)' }}>Historial de Hándicap</h3>

                {/* Optional: Add Manual Entry Form Here if needed, referencing handleSave */}
                {/* Currently hidden in original code, but handleSave exists. Leaving as is to focus on display. */}

                {combinedHistory.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {combinedHistory
                                .slice().reverse().map((entry, index) => (
                                    <div key={index} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.5rem 0.75rem',
                                        backgroundColor: entry.source === 'tournament' ? 'var(--color-surface-soft)' : 'var(--color-bg-main)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.95rem'
                                    }}>
                                        <div>
                                            <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{entry.handicap}</span>
                                            {entry.source === 'tournament' && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontStyle: 'italic' }}>
                                                    {entry.label}
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(entry.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
};

export default HandicapView;
