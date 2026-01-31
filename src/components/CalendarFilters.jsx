import { Check } from 'lucide-react';

const GROUPS = [
    { id: 'juvenil', label: 'Circuito Juvenil', color: '#db2777' }, // Pink
    { id: 'rfeg', label: 'RFEG', color: '#dc2626' }, // Red
    { id: 'fcg', label: 'FCG', color: '#d97706' }, // Orange
    { id: 'club', label: 'Club', color: '#059669' }, // Green
    { id: 'adultos', label: 'Circuitos Adultos', color: '#4b5563' } // Gray
];

export default function CalendarFilters({ activeGroups, onChange }) {
    const toggleGroup = (id) => {
        if (activeGroups.includes(id)) {
            onChange(activeGroups.filter(g => g !== id));
        } else {
            onChange([...activeGroups, id]);
        }
    };

    return (
        <div className="filters-container fade-in" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
        }}>
            <style>
                {`
                .filters-container::-webkit-scrollbar {
                    display: none;
                }
                `}
            </style>

            {GROUPS.map(g => {
                const isActive = activeGroups.includes(g.id);
                return (
                    <button
                        key={g.id}
                        onClick={() => toggleGroup(g.id)}
                        className="btn-chip"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: isActive ? `1px solid var(--color-primary)` : '1px solid #E5E1DE',
                            background: isActive ? 'var(--color-primary)' : 'white',
                            color: isActive ? 'white' : 'var(--color-text-muted)',
                            fontSize: '0.7rem',
                            fontWeight: '400',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isActive && <Check size={10} strokeWidth={2} />}
                        {g.label}
                    </button>
                );
            })}
        </div>
    );
}
