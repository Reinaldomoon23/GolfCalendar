import { useState, useEffect } from 'react';
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

const HandicapView = ({ user, currentHandicap }) => {
    const [history, setHistory] = useState([]);
    const [newDate, setNewDate] = useState('');
    const [newHandicap, setNewHandicap] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [currentHandicap]); // Refetch when parent updates the handicap (signal that backend might have updated)

    const fetchHistory = async () => {
        if (!user) return;
        try {
            // Add timestamp to prevent caching
            const response = await fetch(`./api/save_handicap_history.php?username=${user.username}&t=${Date.now()}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                // Sort by date
                data.sort((a, b) => new Date(a.date) - new Date(b.date));
                setHistory(data);
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
        const updatedHistory = [...history, newEntry].sort((a, b) => new Date(a.date) - new Date(b.date));

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
                setHistory(updatedHistory);
                setNewDate('');
                setNewHandicap('');
            }
        } catch (error) {
            console.error("Error saving history:", error);
        }
    };


    const chartData = {
        labels: history.map(h => {
            const d = new Date(h.date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        }),
        datasets: [
            {
                label: 'Hándicap',
                data: history.map(h => h.handicap),
                borderColor: '#166534', // green-800
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
                labels: { color: '#374151' } // gray-700
            },
            title: {
                display: false,
            },
        },
        scales: {
            y: {
                ticks: { color: '#374151' },
                grid: { color: '#e5e7eb' },
                // Actually in golf lower is better, but graphically "up" usually means "more".
                // Let's keep it standard (higher value = higher on y-axis) unless requested otherwise.
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
                    {history.length > 0 ? (
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

                {history.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {history.slice().reverse().map((entry, index) => (
                                <div key={index} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: 'var(--color-bg-main)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    fontSize: '0.95rem'
                                }}>
                                    <span style={{ fontWeight: 'bold' }}>{entry.handicap}</span>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{new Date(entry.date).toLocaleDateString()}</span>
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
