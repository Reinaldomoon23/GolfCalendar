import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Trophy } from 'lucide-react';

const WEEKDAYS = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];
const MONTHS = [
    'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
    'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
];

export default function MonthGridView({ tournaments, onTournamentClick, onDateClick }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Helper to get days in month grid
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Monday start adjustment (0=Sun, 1=Mon... we want Mon=0, Sun=6)
        let firstDayIndex = firstDay.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6; // Sunday

        const days = [];

        // Previous month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, prevMonthLastDay - i),
                isCurrentMonth: false
            });
        }

        // Current month days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }

        // Next month padding to fill 6 rows (42 days)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false
            });
        }

        return days;
    }, [currentDate]);

    // Parse tournament dates for mapping
    const parseDateHelper = (dateStr) => {
        if (!dateStr) return { start: 0, end: 0 };
        const parts = dateStr.split(' - ');
        const parse = (d) => {
            const [day, month, year] = d.split('/').map(Number);
            return new Date(year, month - 1, day).getTime();
        };
        const start = parse(parts[0]);
        const end = parts.length > 1 ? parse(parts[1]) : start;
        return { start, end };
    };

    // Get events for a specific day
    const getEventsForDay = (date) => {
        const checkTime = date.getTime();
        // Normalize time to start of day for comparison
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        return tournaments.filter(t => {
            if (!t.dates) return false;
            const { start, end } = parseDateHelper(t.dates);
            // Check overlaps: (StartA <= EndB) and (EndA >= StartB)
            return (start <= dayEnd.getTime() && end >= dayStart.getTime());
        }).sort((a, b) => { // Sort multi-day first, then by priority
            const durA = parseDateHelper(a.dates).end - parseDateHelper(a.dates).start;
            const durB = parseDateHelper(b.dates).end - parseDateHelper(b.dates).start;
            return durB - durA; // Longer events on top
        });
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Style helpers (same as CalendarView)
    const getEventStyle = (t) => {
        const ORGANIZER_COLORS = {
            'RFEG': { bg: '#FEF2F2', border: '#DC2626', text: '#991B1B' },
            'FCG': { bg: '#FFFBEB', border: '#D97706', text: '#92400E' },
            'CAMIRAL': { bg: '#ECFDF5', border: '#059669', text: '#065F46' },
            'JUNIOR BABY CUP': { bg: '#F0F9FF', border: '#0EA5E9', text: '#075985' },
            'LEGACY': { bg: '#EEF2FF', border: '#4F46E5', text: '#3730A3' },
            'CLUB': { bg: '#F8FAFC', border: '#475569', text: '#1E293B' },
            'DEFAULT': { bg: '#FFFFFF', border: '#333333', text: '#000000' }
        };

        // Custom pink highlight for the user request similarity (like "Torremirona") 
        // We can just use the standard organizer colors for now, 
        // but let's make them look like "strips"
        const theme = ORGANIZER_COLORS[t.organizer] || ORGANIZER_COLORS['DEFAULT'];

        return {
            backgroundColor: theme.bg,
            borderLeft: `3px solid ${theme.border}`,
            color: theme.text,
            fontSize: '0.75rem',
            padding: '2px 4px',
            marginBottom: '2px',
            borderRadius: '3px',
            cursor: 'pointer',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            fontWeight: '600',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        };
    };

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header / Navigation */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                background: 'white',
                padding: '10px 15px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'capitalize', margin: 0 }}>
                        {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                </div>

                <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                        onClick={handlePrevMonth}
                        style={{ background: 'none', border: 'none', padding: '5px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
                        className="hover-bg-gray"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={handleToday}
                        style={{
                            background: 'none',
                            border: '1px solid #cbd5e1',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                        }}
                    >
                        Hoy
                    </button>
                    <button
                        onClick={handleNextMonth}
                        style={{ background: 'none', border: 'none', padding: '5px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
                        className="hover-bg-gray"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '1px',
                background: '#e2e8f0',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden'
            }}>
                {/* Weekday Headers */}
                {WEEKDAYS.map(day => (
                    <div key={day} style={{
                        background: '#f8fafc',
                        padding: '10px 5px',
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                        color: '#64748b',
                        textTransform: 'uppercase'
                    }}>
                        {day.slice(0, 3)}
                    </div>
                ))}

                {/* Days */}
                {calendarDays.map((dayObj, index) => {
                    const isToday = new Date().toDateString() === dayObj.date.toDateString();
                    const dayEvents = getEventsForDay(dayObj.date);

                    return (
                        <div
                            key={index}
                            style={{
                                background: dayObj.isCurrentMonth ? 'white' : '#f9fafb',
                                minHeight: '100px',
                                padding: '4px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                position: 'relative'
                            }}
                            onClick={() => {
                                if (onDateClick) onDateClick(dayObj.date);
                            }}
                        >
                            <div style={{
                                textAlign: 'right',
                                padding: '2px 4px',
                                marginBottom: '2px',
                                cursor: 'pointer'
                            }}>
                                <span style={{
                                    fontSize: '0.85rem',
                                    fontWeight: isToday ? 'bold' : 'normal',
                                    color: isToday ? 'white' : (dayObj.isCurrentMonth ? '#333' : '#cbd5e1'),
                                    background: isToday ? 'var(--color-primary)' : 'transparent',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.2s'
                                }}
                                    className={!isToday ? "hover-date" : ""}
                                >
                                    {dayObj.date.getDate()}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', maxHeight: '80px' }}>
                                {dayEvents.map(event => {
                                    const isPast = event.dates ? parseDateHelper(event.dates).end < new Date().setHours(0, 0, 0, 0) : false;

                                    return (
                                        <div
                                            key={event.id}
                                            style={{
                                                ...getEventStyle(event),
                                                opacity: isPast ? 0.6 : 1,
                                                filter: isPast ? 'grayscale(80%)' : 'none',
                                                whiteSpace: 'normal', // Allow wrapping for multi-line
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onTournamentClick) onTournamentClick(event);
                                            }}
                                            title={`${event.name} (${event.course})`}
                                        >
                                            <div style={{ lineHeight: '1.1' }}>
                                                {event.name}
                                            </div>
                                            {event.course && (
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    opacity: 1,
                                                    fontWeight: '500',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '2px',
                                                    marginTop: '1px'
                                                }}>
                                                    <MapPin size={8} style={{ flexShrink: 0 }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {event.course}
                                                    </span>
                                                </div>
                                            )}
                                            {isPast && (
                                                <div style={{
                                                    fontSize: '0.6rem',
                                                    fontWeight: 'bold',
                                                    color: 'white',
                                                    backgroundColor: 'rgba(0,0,0,0.4)',
                                                    padding: '1px 4px',
                                                    borderRadius: '2px',
                                                    display: 'inline-block',
                                                    marginTop: '1px',
                                                    alignSelf: 'flex-start',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    JUGADO
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                .hover-bg-gray:hover {
                    background-color: #f1f5f9 !important;
                }
                .hover-date:hover {
                    background-color: #e2e8f0;
                    color: var(--color-primary);
                    font-weight: bold;
                }
            `}</style>
        </div>
    );
}
