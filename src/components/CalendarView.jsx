import { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// ... imports ...

// ... imports ...
import { ChevronLeft, ChevronRight, Info, Calendar, Trophy, Plus, MapPin, Trash2, Share2, Filter, CalendarDays, Save, X, AlertTriangle, List, MoreVertical, Copy, Edit } from 'lucide-react';
import spanishCourses from '../data/spanish_courses.json';
import CalendarFilters from './CalendarFilters';

// -------------------------------------------------------------------------
// LOGIC HELPERS (Shared with Results)
// -------------------------------------------------------------------------
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

const getRoundDates = (dateStr) => {
    const { start, end } = parseDateHelper(dateStr);
    const dates = [];
    let current = new Date(start);
    const endDate = new Date(end);
    let safety = 0;
    while (current <= endDate && safety < 10) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
        safety++;
    }
    return dates;
};


export default function CalendarView({
    results = {},
    tournaments: initialTournaments = [],
    onAddTournament,
    onUpdateResults,
    onDeleteTournament,
    onUpdateTournament,
    viewMode = 'calendar',
    activeGroups = [], // ["valedero", "club", etc]
    hiddenGroups = [], // ["merit"] -> items to explicitly HIDE
    onUpdateGroups
}) {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Dynamic Conflict Calculation: Always compute 'conflict' based on current data
    const tournaments = useMemo(() => {
        const dateCounts = {};
        initialTournaments.forEach(t => {
            if (t.dates) dateCounts[t.dates] = (dateCounts[t.dates] || 0) + 1;
        });

        return initialTournaments.map(t => ({
            ...t,
            conflict: t.dates ? dateCounts[t.dates] > 1 : false
        }));
    }, [initialTournaments]);

    const [filter, setFilter] = useState('upcoming'); // all, upcoming, conflicts, grand_prix
    // Note: 'grand_prix' filter option is redundant if we have Groups, but let's keep it for "Highlight" logic or remove it?
    // Let's hide the old filter buttons if they overlap, or keep them as "Time Filters" (Upcoming/All).

    const [showAddForm, setShowAddForm] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    // Adaptive Course List State
    const [customCourses, setCustomCourses] = useState(() => {
        const saved = localStorage.getItem('golf_tracker_custom_courses');
        return saved ? JSON.parse(saved) : [];
    });

    // Combine static and custom courses, remove duplicates, and sort
    const spanishCourseNames = spanishCourses.map(c => c.name);
    const allCourses = [...new Set([...spanishCourseNames, ...customCourses])].sort();

    // Derived Selection State from URL
    const selectedTournament = id ? tournaments.find(t => String(t.id) === id) || null : null;

    // --- NEW: Editing Tournament Details State ---
    const [editingDetails, setEditingDetails] = useState({});
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (selectedTournament) {
            // Check if we navigated here with intent to edit
            const shouldEdit = location.state?.edit === true;
            setIsEditing(shouldEdit);

            // Calculate default par from course data if not set
            let calculatedPar = 72;
            if (selectedTournament.course) {
                const courseData = spanishCourses.find(c => c.name === selectedTournament.course) ||
                    spanishCourses.find(c => c.name.toLowerCase().includes(selectedTournament.course.toLowerCase()) || selectedTournament.course.toLowerCase().includes(c.name.toLowerCase()));

                if (courseData && courseData.pars) {
                    const sum = courseData.pars.reduce((a, b) => a + (parseInt(b) || 0), 0);
                    if (sum > 0) calculatedPar = sum;
                }
            }

            setEditingDetails({
                name: selectedTournament.name,
                dates: selectedTournament.dates,
                course: selectedTournament.course,
                organizer: selectedTournament.organizer,
                par: selectedTournament.par || calculatedPar,
                grand_prix: selectedTournament.grand_prix || false,
                valedera: selectedTournament.valedera || false,
                merit: selectedTournament.merit || (selectedTournament.type === 'merit') || false,
                wagr: selectedTournament.wagr || false,
                conflict: selectedTournament.conflict || false,
                groups: selectedTournament.groups || [],
                type: selectedTournament.type || 'club'
            });
        }
    }, [selectedTournament, location.state]);

    const handleSaveChanges = () => {
        if (!selectedTournament) return;
        const updatedT = {
            ...selectedTournament,
            ...editingDetails,
        };
        if (onUpdateTournament) onUpdateTournament(updatedT);
        setIsEditing(false);
    };
    const handleDetailChange = (field, value) => {
        let updates = { [field]: value };

        // Auto-calculate par if course changes
        if (field === 'course') {
            const courseData = spanishCourses.find(c => c.name === value);
            if (courseData && courseData.pars) {
                const sum = courseData.pars.reduce((a, b) => a + (parseInt(b) || 0), 0);
                if (sum > 0) updates.par = sum;
            }
        }

        setEditingDetails(prev => ({ ...prev, ...updates }));
    };

    const handleGroupToggle = (group) => {
        setEditingDetails(prev => {
            const currentGroups = prev.groups || [];
            if (currentGroups.includes(group)) {
                return { ...prev, groups: currentGroups.filter(g => g !== group) };
            } else {
                return { ...prev, groups: [...currentGroups, group] };
            }
        });
    };

    const handleSaveDetails = () => {
        if (!selectedTournament) return;

        // Auto-detect conflict
        const newDate = editingDetails.dates;
        const hasConflict = tournaments.some(t =>
            t.id !== selectedTournament.id &&
            t.dates === newDate
        );

        const updated = {
            ...selectedTournament,
            ...editingDetails,
            conflict: hasConflict // Auto-set
        };

        if (onUpdateTournament) {
            onUpdateTournament(updated);
            alert(hasConflict ? '¡Guardado! ⚠️ Se ha detectado un conflicto de fechas.' : '¡Configuración guardada!');
        }
    };


    // Result Editing State
    const [isEditingResults, setIsEditingResults] = useState(false);
    const [formData, setFormData] = useState({
        position: '',
        rounds: [],
        stableford: [],
        comments: '',
        handicap: '',
        scorecards: {} // { roundIndex: { pars: [], strokes: [] } }
    });

    // --- CONTEXT MENU STATE & LOGIC ---
    const [contextMenu, setContextMenu] = useState(null); // { x, y, tournament }
    const longPressTimer = useRef(null);

    const handleContextMenu = (e, tournament) => {
        if (!e) return;
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            tournament
        });
    };

    const handleTouchStart = (tournament) => {
        longPressTimer.current = setTimeout(() => {
            setContextMenu({
                x: window.innerWidth / 2 - 100,
                y: window.innerHeight / 2 - 50,
                tournament
            });
        }, 700);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    useEffect(() => {
        const h = () => setContextMenu(null);
        window.addEventListener('click', h);
        return () => window.removeEventListener('click', h);
    }, []);

    const handleDuplicate = (t) => {
        const duplicated = {
            ...t,
            id: 'custom_' + Date.now(),
            name: `${t.name} (Copia)`,
            custom: true
        };
        if (onAddTournament) onAddTournament(duplicated);
        setContextMenu(null);
    };

    const handleEditFromMenu = (t) => {
        // Navigate with explicit edit state
        navigate(`/event/${t.id}`, { state: { edit: true } });
        setContextMenu(null);
    };

    const handleDeleteFromMenu = (t) => {
        if (window.confirm(`¿Seguro que quieres borrar "${t.name}"?`)) {
            if (onDeleteTournament) onDeleteTournament(t.id);
        }
        setContextMenu(null);
    };

    const renderContextMenu = () => {
        if (!contextMenu) return null;
        console.log('Rendering Context Menu - Version: ExactPositioning-Clamp'); // Debug version
        const menuWidth = 170;
        const menuHeight = 150; // Approximate

        // Start at exact click coordinates
        let x = contextMenu.x;
        let y = contextMenu.y;

        // Clamp horizontal position to fit in viewport
        if (x + menuWidth > window.innerWidth - 10) {
            x = window.innerWidth - menuWidth - 10;
        }

        // Clamp vertical position to fit in viewport
        if (y + menuHeight > window.innerHeight - 10) {
            y = window.innerHeight - menuHeight - 10;
        }

        return ReactDOM.createPortal(
            <div style={{
                position: 'fixed',
                top: Math.max(10, y + 5),
                left: Math.max(10, x),
                zIndex: 9999, // High z-index to be safe
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                padding: '8px',
                minWidth: `${menuWidth}px`,
                animation: 'fadeIn 0.1s ease-out'
            }}>
                <button onClick={() => handleEditFromMenu(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#333' }}>
                    <Edit size={16} /> Editar
                </button>
                <button onClick={() => handleDuplicate(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#333' }}>
                    <Copy size={16} /> Duplicar
                </button>
                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>
                <button onClick={() => handleDeleteFromMenu(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444', textAlign: 'left' }}>
                    <Trash2 size={16} /> Borrar
                </button>
            </div>,
            document.body
        );
    };

    // Reset editing state when selection changes
    useEffect(() => {
        setIsEditingResults(false);
    }, [selectedTournament]);

    // Initialize form when editing starts or when tournament is selected (auto-edit)
    // Initialize form when editing starts or when tournament is selected (auto-edit)
    useEffect(() => {
        if (selectedTournament) {
            const t = selectedTournament;
            const existing = results[t.id] || {};
            const roundDates = getRoundDates(t.dates);

            // Lookup course pars (Loose matching)
            const courseData = spanishCourses.find(c => c.name === t.course) ||
                spanishCourses.find(c => c.name.toLowerCase().includes(t.course.toLowerCase()) || t.course.toLowerCase().includes(c.name.toLowerCase()));
            const defaultPars = courseData?.pars || Array(18).fill('');

            // Helper to get initial scorecard for a round
            const getInitialScorecard = (rIdx) => {
                if (existing.scorecards && existing.scorecards[rIdx]) {
                    // Start with existing, but if pars are empty/missing, try to fill them
                    const card = existing.scorecards[rIdx];
                    const currentPars = card.pars || Array(18).fill('');

                    // If all pars are empty (or we want to force fill missing ones), merge defaultPars
                    // Let's safe-fill: only fill empty slots
                    const mergedPars = currentPars.map((p, i) => p || defaultPars[i] || '');

                    return {
                        ...card,
                        pars: mergedPars
                    };
                }
                // New card
                return {
                    pars: defaultPars.map(p => p || ''),
                    strokes: defaultPars.map(p => p || '')
                };
            };

            const initialScorecards = {};
            roundDates.forEach((_, i) => {
                initialScorecards[i] = getInitialScorecard(i);
            });

            setFormData({
                position: existing.position || '',
                rounds: roundDates.map((_, i) => (existing.rounds && existing.rounds[i]) ? existing.rounds[i] : ''),
                stableford: roundDates.map((_, i) => (existing.stableford && existing.stableford[i]) ? existing.stableford[i] : ''),
                comments: existing.comments || '',
                handicap: existing.handicap || '',
                scorecards: initialScorecards
            });
        }
    }, [selectedTournament, results]);

    // New Tournament Form State
    const [newTournament, setNewTournament] = useState({
        name: '',
        startDate: new Date().toISOString().split('T')[0],
        isMultiDay: false,
        duration: 2,
        course: '',
        organizer: 'CLUB',
        type: 'club',
        grand_prix: false,
        valedera: false
    });


    // Helper to parse date (takes start date of range)
    const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const firstDate = dateStr.split(' - ')[0]; // "31/01/2026"
        const [day, month, year] = firstDate.split('/').map(Number);
        return new Date(year, month - 1, day);
    };

    const isPast = (dateStr) => {
        if (!dateStr) return false;
        const parts = dateStr.split(' - ');
        const lastDateStr = parts[parts.length - 1]; // Use end date if available
        const [day, month, year] = lastDateStr.split('/').map(Number);
        const endDate = new Date(year, month - 1, day);
        endDate.setHours(23, 59, 59, 999); // End of that day
        return endDate < new Date();
    };

    const handleAddTournament = () => {
        if (!newTournament.name || !newTournament.startDate) {
            alert("Nombre y fecha de inicio son obligatorios");
            return;
        }

        // Adaptive Course Learning: Save if new
        if (newTournament.course && !allCourses.includes(newTournament.course)) {
            const updatedCourses = [...customCourses, newTournament.course];
            setCustomCourses(updatedCourses);
            localStorage.setItem('golf_tracker_custom_courses', JSON.stringify(updatedCourses));
        }

        // Format Dates
        const start = new Date(newTournament.startDate);
        const formatDate = (date) => {
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };

        let dateString = formatDate(start);

        if (newTournament.isMultiDay && newTournament.duration > 1) {
            const end = new Date(start);
            end.setDate(start.getDate() + (parseInt(newTournament.duration) - 1));
            dateString += ` - ${formatDate(end)}`;
        }

        const t = {
            id: 'custom_' + Date.now(),
            name: newTournament.name,
            dates: dateString,
            course: newTournament.course,
            organizer: newTournament.organizer,
            type: newTournament.type,
            custom: true,
            grand_prix: newTournament.grand_prix,
            valedera: newTournament.valedera,
            groups: ['club'] // Default group for custom
        };


        if (onAddTournament) onAddTournament(t);
        setShowAddForm(false);
        setNewTournament({
            name: '',
            startDate: new Date().toISOString().split('T')[0],
            isMultiDay: false,
            duration: 2,
            course: '',
            organizer: 'CLUB',
            type: 'club',
            grand_prix: false,
            valedera: false
        });
    };

    const handleRoundChange = (idx, field, value) => {
        const updated = [...formData[field]];
        updated[idx] = value;
        setFormData(prev => ({ ...prev, [field]: updated }));
    };

    // Scorecard Logic
    const [expandedRound, setExpandedRound] = useState(null); // idx of round currently expanded
    const [sharingRound, setSharingRound] = useState(null); // idx of round being shared (for hidden capture)

    const handleHoleChange = (roundIdx, holeIdx, field, value) => {
        // field = 'pars' or 'strokes'
        setFormData(prev => {
            const currentScorecards = prev.scorecards || {};
            const roundCard = currentScorecards[roundIdx] || { pars: Array(18).fill(''), strokes: Array(18).fill('') };

            const newArray = [...(roundCard[field] || Array(18).fill(''))];
            newArray[holeIdx] = value;

            const updatedCard = { ...roundCard, [field]: newArray };

            // Auto-calculate total if strokes changed
            let newRounds = [...prev.rounds];
            if (field === 'strokes') {
                const totalStrokes = updatedCard.strokes.reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
                newRounds[roundIdx] = totalStrokes > 0 ? totalStrokes.toString() : '';
            }

            return {
                ...prev,
                scorecards: { ...currentScorecards, [roundIdx]: updatedCard },
                rounds: newRounds
            };
        });
    };

    const handleResetCard = (roundIdx) => {
        if (!window.confirm('¿Seguro que quieres borrar todos los datos de esta tarjeta?')) return;

        setFormData(prev => {
            const currentScorecards = prev.scorecards || {};
            const newRounds = [...prev.rounds];
            newRounds[roundIdx] = ''; // Reset total strokes

            // Re-derive defaults to reset nicely
            const courseData = spanishCourses.find(c => c.name === selectedTournament.course) ||
                spanishCourses.find(c => c.name.toLowerCase().includes(selectedTournament.course.toLowerCase()) || selectedTournament.course.toLowerCase().includes(c.name.toLowerCase()));
            const defaultPars = courseData?.pars || Array(18).fill('');

            return {
                ...prev,
                scorecards: {
                    ...currentScorecards,
                    [roundIdx]: {
                        pars: defaultPars.map(p => p || ''),
                        strokes: defaultPars.map(p => p || '')
                    }
                },
                rounds: newRounds
            };
        });
    };

    const handleShareCard = async (roundIdx) => {
        setSharingRound(roundIdx);
        // Allow render cycle to update the hidden container
        await new Promise(r => setTimeout(r, 100));

        const element = document.getElementById('social-card-container');
        if (!element) return;

        // Ensure state is updated correctly for the shared card before capture
        // (Wait a tick is usually safer with React state if relying on render, 
        // but here expandedRound is already set for the visible card, so element should be populated)

        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(element, {
                scale: 2, // High resolution
                backgroundColor: null,
            });

            canvas.toBlob(async (blob) => {
                const file = new File([blob], `tarjeta_ronda_${roundIdx + 1}.png`, { type: 'image/png' });

                if (navigator.share) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Mi Resultado de Golf',
                            text: `¡He hecho ${formData.rounds[roundIdx]} golpes en ${selectedTournament.name}! 🏌️‍♂️`
                        });
                    } catch (err) {
                        console.log('Error sharing:', err);
                        // Fallback to download
                        const link = document.createElement('a');
                        link.download = `tarjeta_ronda_${roundIdx + 1}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                    }
                } else {
                    const link = document.createElement('a');
                    link.download = `tarjeta_ronda_${roundIdx + 1}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                }
            });
            setSharingRound(null);
        } catch (err) {
            console.error('Error generating image:', err);
            alert('Error al generar la imagen.');
            setSharingRound(null);
        }
    };

    const handleSaveResults = () => {
        if (!selectedTournament) return;

        // Validation check for strokes mismatch
        let mismatchFound = false;
        let mismatchDetails = [];

        formData.rounds.forEach((val, idx) => {
            const manualStrokes = parseInt(val) || 0;
            const cardStrokes = (formData.scorecards[idx]?.strokes || []).reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);

            if (cardStrokes > 0 && manualStrokes > 0 && manualStrokes !== cardStrokes) {
                mismatchFound = true;
                mismatchDetails.push(`Ronda ${idx + 1}: ${manualStrokes} manual vs ${cardStrokes} tarjeta`);
            }
        });

        if (mismatchFound) {
            const proceed = window.confirm(
                "⚠️ ¡Atención! Los golpes manuales no coinciden con la suma de la tarjeta en estas rondas:\n\n" +
                mismatchDetails.join("\n") +
                "\n\n¿Deseas guardar de todas formas?"
            );
            if (!proceed) return;
        }

        // Calculate totals logic (redundant info but good for display)
        const validScores = formData.rounds.filter(r => r && !isNaN(r)).map(Number);
        const total = validScores.reduce((a, b) => a + b, 0);
        const average = validScores.length > 0 ? (total / validScores.length).toFixed(1) : 0;
        const validStb = formData.stableford.filter(s => s && !isNaN(s)).map(Number);
        const stablefordTotal = validStb.reduce((a, b) => a + b, 0);

        const entry = {
            ...formData,
            total,
            average,
            stablefordTotal,
            updatedAt: new Date().toISOString()
        };

        const newResults = { ...results, [selectedTournament.id]: entry };
        if (onUpdateResults) onUpdateResults(newResults);
        // Do NOT close/deselect. Stay in detail/edit view.
    };

    const handleDeleteResult = () => {
        if (!selectedTournament) return;
        if (window.confirm('¿Seguro que quieres borrar estos resultados?')) {
            const newResults = { ...results };
            delete newResults[selectedTournament.id];
            if (onUpdateResults) onUpdateResults(newResults);
            // Stay in detail view
        }
    };

    const handleDeleteTournamentClick = () => {
        if (!selectedTournament) return;
        if (window.confirm(`¿Seguro que quieres borrar el torneo "${selectedTournament.name}"? Esta acción no se puede deshacer.`)) {
            if (onDeleteTournament) onDeleteTournament(selectedTournament.id);
            navigate('/');
        }
    };

    const getFilteredTournaments = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return tournaments.filter(t => {
            // Priority 0: Explicit Hidden Groups
            if (hiddenGroups && hiddenGroups.length > 0) {
                const shouldHide = hiddenGroups.some(g => {
                    if (g === 'merit') return (t.merit || t.type === 'merit');
                    // Add other hidden types if needed
                    return false;
                });
                if (shouldHide) return false;
            }

            if (activeGroups && activeGroups.length > 0) {
                // Special handling for specific filters that should check properties, not just groups
                const matchesFilter = activeGroups.some(g => {
                    if (g === 'valedero') return t.valedera;
                    if (g === 'grand_prix') return t.grand_prix;
                    if (g === 'merit') return (t.merit || t.type === 'merit');
                    if (g === 'camiral') return (t.groups && t.groups.includes('camiral'));
                    // Default fallback for other groups
                    return t.groups && t.groups.includes(g);
                });

                if (!matchesFilter) {
                    // Custom tournaments without groups fallback...
                    // Actually, if we are strictly filtering by group/property, and it doesn't match, hide it.
                    // Unless it's a "custom" tournament that we treat as 'club' maybe?
                    // Existing logic was: if (!hasGroup && (!t.groups...) && activeGroups.includes('club'))

                    if ((!t.groups || t.groups.length === 0) && activeGroups.includes('club')) {
                        // Keep it (it's a club/custom tournament)
                    } else {
                        return false;
                    }
                }
            }

            const tDate = parseDate(t.dates);

            // In results view, ONLY show tournaments that actually have a result saved
            if (viewMode === 'results') {
                return !!results[t.id];
            }

            if (filter === 'upcoming') return tDate >= today;
            if (filter === 'conflicts') return t.conflict;
            // if (filter === 'grand_prix') return t.grand_prix; // Redundant now
            return true;
        });
    };

    // Sort by date: results mode often wants LATEST first (DESC), calendar wants CHRONOLOGICAL (ASC)
    const sortedTournaments = getFilteredTournaments().sort((a, b) => {
        const da = parseDate(a.dates);
        const db = parseDate(b.dates);
        return viewMode === 'results' ? db - da : da - db;
    });

    const getCardStyle = (t) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tDate = parseDate(t.dates);
        const past = tDate < today;

        // 1. Explicit Mappings
        const ORGANIZER_COLORS = {
            'RFEG': { bg: '#FEF2F2', border: '#DC2626' },      // Red
            'FCG': { bg: '#FFFBEB', border: '#D97706' },       // Gold/Orange
            'CAMIRAL': { bg: '#ECFDF5', border: '#059669' },   // Emerald Green
            'JUNIOR BABY CUP': { bg: '#F0F9FF', border: '#0EA5E9' }, // Sky Blue
            'LEGACY': { bg: '#EEF2FF', border: '#4F46E5' },    // Indigo
            'CLUB': { bg: '#F8FAFC', border: '#475569' },       // Slate/Neutral
            'DEFAULT': { bg: '#FFFFFF', border: '#333333' }
        };

        // 2. Fallback Palettes for Unknown Organizers
        const FALLBACK_PALETTES = [
            { bg: '#F0FDFA', border: '#0D9488' }, // Teal
            { bg: '#FDF2F8', border: '#DB2777' }, // Pink
            { bg: '#F5F3FF', border: '#7C3AED' }, // Violet
            { bg: '#ECFEFF', border: '#0891B2' }, // Cyan
            { bg: '#F7FEE7', border: '#65A30D' }, // Lime
            { bg: '#FDF4FF', border: '#C026D3' }, // Fuchsia
        ];

        // 3. Determine Theme
        let theme = ORGANIZER_COLORS[t.organizer];

        if (!theme) {
            // Deterministic hash for unknown organizers
            let hash = 0;
            const str = t.organizer || 'DEFAULT';
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % FALLBACK_PALETTES.length;
            theme = FALLBACK_PALETTES[index];
        }

        let style = {
            border: '1px solid #E5E1DE',
            boxShadow: '0 4px 15px rgba(140, 133, 127, 0.05)',
            opacity: past ? 0.6 : 1,
            background: theme.bg,
            borderRadius: '4px',
            borderLeft: `4px solid ${theme.border}`
        };

        if (t.conflict) {
            style.background = 'var(--color-conflict-bg)';
            style.borderLeft = '4px solid #b25d5d';
        }

        return style;
    };

    const handleTournamentClick = (t) => {
        navigate(`/event/${t.id}`);
    };

    const handleBack = () => {
        navigate('/');
    };

    const renderResultRow = (t) => {
        const result = results[t.id];
        if (!result) return null; // Should not happen if filtered correctly, but safety check

        return (
            <div
                key={t.id}
                className="card fade-in"
                onClick={() => handleTournamentClick(t)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '1rem',
                    marginBottom: '1rem',
                    cursor: 'pointer',
                    gap: '1rem',
                    ...getCardStyle(t),
                    boxShadow: 'none',
                    position: 'relative' // Needed for absolute positioning of menu icon
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    // Adjust coordinates for the list view context menu
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        tournament: t
                    });
                }}
            >
                {/* Context Menu Trigger Icon - High Visibility V2 */}
                <div
                    style={{
                        position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)',
                        color: '#000', background: 'white',
                        padding: '6px', borderRadius: '50%',
                        zIndex: 100, cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Adjust coordinates for the list view context menu
                        setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            tournament: t
                        });
                    }}
                >
                    <MoreVertical size={18} />
                </div>

                {/* Position / Score Badge */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--color-surface-soft)',
                    border: '1px solid #E5E1DE',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    minWidth: '50px'
                }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: '300', color: 'var(--color-primary)' }}>
                        {result.position || '-'}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        POS
                    </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <span>{t.dates}</span>
                        <span>{t.course}</span>
                    </div>
                </div>

                {/* Score Summary */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: '300', fontSize: '1.1rem' }}>
                        {result.total} <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>G</span>
                    </div>
                    {result.stablefordTotal > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-secondary)', fontWeight: '400' }}>
                            {result.stablefordTotal} STB
                        </div>
                    )}
                </div>
                <ChevronRight size={18} color="var(--color-text-muted)" />
            </div>
        );
    };

    // Check mode
    const IS_MULTI = import.meta.env.VITE_APP_MODE === 'multi';


    // -------------------------------------------------------------------------
    // RENDER DETAIL VIEW
    // -------------------------------------------------------------------------
    if (selectedTournament) {
        const t = selectedTournament;
        const detailStyle = getCardStyle(t);
        // Remove grayscale/opacity for detail view to make it readable
        detailStyle.opacity = 1;
        detailStyle.filter = 'none';

        const renderSummaryCard = () => {
            if (!results[t.id]) return null;

            return (
                <div className="card" style={{
                    background: 'var(--color-surface-soft)',
                    padding: '2rem',
                    borderRadius: '4px',
                    border: '1px solid #E5E1DE',
                    boxShadow: 'none',
                    marginBottom: '2rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.1rem' }}>Resultado Final</h3>
                        <div style={{
                            background: 'var(--color-primary)',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            fontSize: '1.2rem'
                        }}>
                            {results[t.id].position || '-'}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1.5rem' }}>
                        {results[t.id].total > 0 && (
                            <div>
                                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>GOLPES TOTAL</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{results[t.id].total}</span>
                                    {(() => {
                                        const par = t.par || 72;
                                        const diff = results[t.id].total - par;
                                        const diffStr = diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : '(E)';
                                        const color = diff > 0 ? '#ef4444' : diff < 0 ? '#22c55e' : '#64748b';
                                        return (
                                            <span style={{ fontSize: '1rem', fontWeight: '600', color: color }}>
                                                {diffStr}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                        {results[t.id].stablefordTotal > 0 && (
                            <div>
                                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>PUNTOS STB</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>{results[t.id].stablefordTotal}</span>
                            </div>
                        )}
                        {results[t.id].average > 0 && (
                            <div>
                                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>MEDIA</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{results[t.id].average}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        };

        return (
            <div className="calendar-detail fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button
                        onClick={handleBack}
                        className="btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                        <ChevronLeft size={16} /> Volver
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Edit Toggle */}
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="btn"
                            style={{
                                color: 'var(--color-primary)',
                                border: '1px solid var(--color-border)',
                                fontSize: '0.9rem',
                                padding: '0.5rem 1rem'
                            }}
                        >
                            {isEditing ? <X size={16} /> : <span style={{ fontSize: '1.2rem' }}>✏️</span>}
                        </button>
                        {/* Delete button only for Custom Tournaments */}
                        {t.custom && (
                            <button
                                onClick={handleDeleteTournamentClick}
                                className="btn"
                                style={{
                                    color: 'var(--color-conflict)',
                                    border: '1px solid var(--color-conflict)',
                                    fontSize: '0.9rem',
                                    padding: '0.5rem'
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="card" style={detailStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <span className="badge" style={{
                                backgroundColor: (() => {
                                    const ORGANIZER_COLORS = {
                                        'RFEG': '#DC2626',
                                        'FCG': '#D97706',
                                        'CAMIRAL': '#059669',
                                        'JUNIOR BABY CUP': '#0EA5E9',
                                        'LEGACY': '#4F46E5',
                                        'CLUB': '#475569'
                                    };
                                    if (ORGANIZER_COLORS[t.organizer]) return ORGANIZER_COLORS[t.organizer];

                                    // Fallback Hash
                                    const FALLBACKS = ['#0D9488', '#DB2777', '#7C3AED', '#0891B2', '#65A30D', '#C026D3'];
                                    let hash = 0;
                                    const str = t.organizer || 'DEFAULT';
                                    for (let i = 0; i < str.length; i++) {
                                        hash = str.charCodeAt(i) + ((hash << 5) - hash);
                                    }
                                    return FALLBACKS[Math.abs(hash) % FALLBACKS.length];
                                })(),
                                color: 'white',
                                marginBottom: '1rem',
                                display: 'inline-block'
                            }}>
                                {t.organizer}
                            </span>
                            {t.grand_prix && (
                                <span className="badge" style={{ backgroundColor: 'var(--color-grand-prix)', color: 'white', marginLeft: '0.5rem' }}>
                                    GRAND PRIX
                                </span>
                            )}
                            {t.valedera && (
                                <span className="badge" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)', marginLeft: '0.5rem' }}>
                                    VALEDERA
                                </span>
                            )}
                            {/* Support logic for merit: check property OR legacy type='merit' */}
                            {(t.merit || t.type === 'merit') && (
                                <span className="badge" style={{ backgroundColor: '#B58B80', color: 'white', marginLeft: '0.5rem' }}>
                                    ORDEN MÉRITO
                                </span>
                            )}
                            {t.wagr && (
                                <span className="badge" style={{ backgroundColor: '#1e293b', color: 'white', marginLeft: '0.5rem' }}>
                                    WAGR
                                </span>
                            )}
                            {isPast(t.dates) && (
                                <span className="badge" style={{ backgroundColor: '#64748b', color: 'white', marginLeft: '0.5rem' }}>
                                    FINALIZADO
                                </span>
                            )}
                        </div>
                        {t.conflict && (
                            <span className="badge" style={{ backgroundColor: 'var(--color-conflict)', color: 'white' }}>
                                CONFLICTO DE FECHAS
                            </span>
                        )}
                    </div>

                    {isEditing ? (
                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                            {/* Name Edit */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Nombre del Torneo</label>
                                <input
                                    type="text"
                                    value={editingDetails.name || ''}
                                    onChange={(e) => handleDetailChange('name', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                />
                            </div>

                            {/* Dates Edit */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Fechas (dd/mm/yyyy)</label>
                                <input
                                    type="text"
                                    value={editingDetails.dates || ''}
                                    onChange={(e) => handleDetailChange('dates', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                />
                            </div>

                            {/* Course Edit */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Campo</label>
                                <input
                                    type="text"
                                    value={editingDetails.course || ''}
                                    onChange={(e) => handleDetailChange('course', e.target.value)}
                                    list="course-list"
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                />
                                <datalist id="course-list">
                                    {spanishCourses.map((c, i) => (
                                        <option key={i} value={c.name} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Organizer (Main Entity) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Organizador</label>
                                <select
                                    value={editingDetails.organizer || 'CLUB'}
                                    onChange={(e) => handleDetailChange('organizer', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                >
                                    <option value="CLUB">CLUB (Genérico)</option>
                                    <option value="RFEG">RFEG</option>
                                    <option value="FCG">FCG</option>
                                    <option value="CAMIRAL">CAMIRAL</option>
                                    <option value="LEGACY">LEGACY</option>
                                    <option value="JUNIOR BABY CUP">JUNIOR BABY CUP</option>
                                </select>
                            </div>

                            {/* Tags / Properties */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Etiquetas</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                                        <input
                                            type="checkbox"
                                            checked={editingDetails.valedera || false}
                                            onChange={(e) => handleDetailChange('valedera', e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <span style={{ fontSize: '0.9rem' }}>Valedera</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                                        <input
                                            type="checkbox"
                                            checked={editingDetails.grand_prix || false}
                                            onChange={(e) => handleDetailChange('grand_prix', e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <span style={{ fontSize: '0.9rem' }}>Grand Prix</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                                        <input
                                            type="checkbox"
                                            checked={editingDetails.merit || false}
                                            onChange={(e) => handleDetailChange('merit', e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <span style={{ fontSize: '0.9rem' }}>Orden de Mérito</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                                        <input
                                            type="checkbox"
                                            checked={editingDetails.wagr || false}
                                            onChange={(e) => handleDetailChange('wagr', e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <span style={{ fontSize: '0.9rem' }}>WAGR</span>
                                    </label>
                                </div>
                            </div>

                            {/* Optional: Type Logic/Dropdown kept for Format but simplified? Or keep as is for now? 
                                User asked to clarify Org vs Tags. Type is still useful for 'Campeonato', 'Circuit', etc.
                            */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Tipo / Formato</label>
                                <select
                                    value={editingDetails.type || 'club'}
                                    onChange={(e) => handleDetailChange('type', e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                >
                                    <option value="club">Estándar / Club</option>
                                    <option value="official">Oficial</option>
                                    <option value="championship">Torneo</option>
                                    <option value="national_championship">Torneo Nacional</option>
                                    <option value="regional_championship">Torneo Regional</option>
                                    <option value="circuit">Circuito</option>
                                    <option value="amateur">Torneo Amateur</option>
                                </select>
                            </div>


                            <button
                                onClick={handleSaveChanges}
                                className="btn-primary"
                                style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            >
                                <Save size={18} /> Guardar Cambios
                            </button>
                        </div>
                    ) : (
                        <>
                            <h1 style={{ fontSize: '1.8rem', margin: '1rem 0', color: 'var(--color-primary)' }}>{t.name}</h1>
                            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                                    <CalendarDays className="text-muted" />
                                    <span style={{ fontWeight: '500' }}>{t.dates}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                                    <MapPin className="text-muted" />
                                    <span style={{ fontWeight: '500' }}>{t.course}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                                    <Filter className="text-muted" />
                                    <span style={{ textTransform: 'capitalize' }}>Tipo: {t.type ? t.type.replace('_', ' ') : '-'}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Edit Mode (Always visible in Calendar View) */}
                    {viewMode === 'calendar' ? (
                        <div className="fade-in" style={{ marginTop: '1rem' }}>
                            {/* Always show summary logic */}
                            {renderSummaryCard()}

                            {/* --- NEW: DETAILS EDITOR --- */}
                            <div style={{ marginBottom: '2rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>Configuración del Torneo</h3>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                    {/* Par of the Course */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <label style={{ fontSize: '0.8rem', color: '#888' }}>Par del Campo</label>
                                        <input
                                            type="number"
                                            value={editingDetails.par || 72}
                                            onChange={(e) => handleDetailChange('par', parseInt(e.target.value) || 72)}
                                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%' }}
                                        />
                                    </div>

                                    {/* Organizer (Main Entity) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <label style={{ fontSize: '0.8rem', color: '#888' }}>Organizador</label>
                                        <select
                                            value={editingDetails.organizer || 'CLUB'}
                                            onChange={(e) => handleDetailChange('organizer', e.target.value)}
                                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%' }}
                                        >
                                            <option value="CLUB">CLUB (Genérico)</option>
                                            <option value="RFEG">RFEG</option>
                                            <option value="FCG">FCG</option>
                                            <option value="CAMIRAL">CAMIRAL</option>
                                            <option value="LEGACY">LEGACY</option>
                                            <option value="JUNIOR BABY CUP">JUNIOR BABY CUP</option>
                                        </select>
                                    </div>

                                    {/* Tags / Properties */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.8rem', color: '#888' }}>Etiquetas</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#f8fafc', padding: '6px', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={editingDetails.valedera || false}
                                                    onChange={(e) => handleDetailChange('valedera', e.target.checked)}
                                                    style={{ width: '16px', height: '16px' }}
                                                />
                                                <span style={{ fontSize: '0.85rem' }}>Valedera</span>
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#f8fafc', padding: '6px', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={editingDetails.grand_prix || false}
                                                    onChange={(e) => handleDetailChange('grand_prix', e.target.checked)}
                                                    style={{ width: '16px', height: '16px' }}
                                                />
                                                <span style={{ fontSize: '0.85rem' }}>Grand Prix</span>
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#f8fafc', padding: '6px', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={editingDetails.merit || false}
                                                    onChange={(e) => handleDetailChange('merit', e.target.checked)}
                                                    style={{ width: '16px', height: '16px' }}
                                                />
                                                <span style={{ fontSize: '0.85rem' }}>Orden Mérito</span>
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#f8fafc', padding: '6px', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={editingDetails.wagr || false}
                                                    onChange={(e) => handleDetailChange('wagr', e.target.checked)}
                                                    style={{ width: '16px', height: '16px' }}
                                                />
                                                <span style={{ fontSize: '0.85rem' }}>WAGR</span>
                                            </label>
                                            {/* Conflict is now auto-detected, removed manual checkbox */}
                                        </div>
                                    </div>

                                    {/* Type / Format */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <label style={{ fontSize: '0.8rem', color: '#888' }}>Tipo / Formato</label>
                                        <select
                                            value={editingDetails.type || 'club'}
                                            onChange={(e) => handleDetailChange('type', e.target.value)}
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        >
                                            <option value="club">Club</option>
                                            <option value="official">Oficial</option>
                                            <option value="championship">Torneo</option>
                                            <option value="national_championship">Torneo Nacional</option>
                                            <option value="regional_championship">Torneo Regional</option>
                                            <option value="circuit">Circuito</option>
                                            <option value="amateur">Torneo Amateur</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Groups Toggles */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Etiquetas (Grupos)</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {['camiral', 'baby_cup', 'legacy', 'senior', 'women', 'valedero'].map(g => (
                                            <button
                                                key={g}
                                                onClick={() => handleGroupToggle(g)}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    border: editingDetails.groups?.includes(g) ? '1px solid var(--color-primary)' : '1px solid #cbd5e1',
                                                    background: editingDetails.groups?.includes(g) ? '#eff6ff' : 'white',
                                                    color: editingDetails.groups?.includes(g) ? 'var(--color-primary)' : '#64748b',
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveDetails}
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    <Save size={18} /> Guardar Configuración
                                </button>
                            </div>

                            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                                <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--color-primary)' }}>Introducir Resultados</h2>
                            </div>

                            {/* Round Inputs */}
                            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                                {getRoundDates(t.dates).map((date, idx) => (
                                    <div key={idx} style={{ marginBottom: '1rem', padding: '0.75rem', background: 'white', border: '1px solid #eee', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <div>
                                                <span style={{ fontWeight: '600', display: 'block' }}>Ronda {idx + 1}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{date.toLocaleDateString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                {(() => {
                                                    const manualStrokes = parseInt(formData.rounds[idx]) || 0;
                                                    const cardStrokes = (formData.scorecards[idx]?.strokes || []).reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
                                                    const hasMismatch = cardStrokes > 0 && manualStrokes > 0 && manualStrokes !== cardStrokes;

                                                    return (
                                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                            <input
                                                                type="text"
                                                                placeholder="Golpes"
                                                                value={formData.rounds[idx] || ''}
                                                                onChange={(e) => handleRoundChange(idx, 'rounds', e.target.value)}
                                                                style={{
                                                                    width: '80px',
                                                                    padding: '8px',
                                                                    fontSize: '1rem',
                                                                    textAlign: 'center',
                                                                    borderRadius: '6px',
                                                                    border: hasMismatch ? '2px solid #ef4444' : '1px solid #ccc',
                                                                    transition: 'border-color 0.2s',
                                                                    background: hasMismatch ? '#fef2f2' : 'white'
                                                                }}
                                                                title={hasMismatch ? `Aviso: El total manual (${manualStrokes}) no coincide con la suma de la tarjeta (${cardStrokes})` : ''}
                                                            />
                                                            {hasMismatch && (
                                                                <span style={{
                                                                    position: 'absolute',
                                                                    right: '-25px',
                                                                    color: '#ef4444',
                                                                    fontSize: '1.2rem',
                                                                    cursor: 'help'
                                                                }} title={`La suma de la tarjeta es ${cardStrokes}`}>
                                                                    ⚠️
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                <input
                                                    type="number"
                                                    placeholder="Stb"
                                                    value={formData.stableford[idx] || ''}
                                                    onChange={(e) => handleRoundChange(idx, 'stableford', e.target.value)}
                                                    style={{ width: '60px', padding: '8px', fontSize: '1rem', textAlign: 'center', borderRadius: '6px', border: '1px solid #ccc', background: '#f9f9f9' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Toggle Detailed Scorecard */}
                                        <button
                                            onClick={() => setExpandedRound(expandedRound === idx ? null : idx)}
                                            style={{
                                                width: '100%',
                                                padding: '6px',
                                                background: expandedRound === idx ? '#e2e8f0' : '#f8fafc',
                                                border: '1px dashed #cbd5e1',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                color: 'var(--color-text-muted)',
                                                marginBottom: expandedRound === idx ? '1rem' : '0'
                                            }}
                                        >
                                            {expandedRound === idx ? 'Ocultar Tarjeta' : '+ Introducir Tarjeta Detallada (Hoyo a Hoyo)'}
                                        </button>

                                        {/* Detailed Scorecard Grid */}
                                        {expandedRound === idx && (
                                            <div className="fade-in">
                                                <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(9, 1fr) 50px', gap: '2px', marginBottom: '10px' }}>
                                                    {/* Header 1-9 */}
                                                    <div></div>
                                                    {[...Array(9)].map((_, i) => (
                                                        <div key={i} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>{i + 1}</div>
                                                    ))}
                                                    <div style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>IDA</div>

                                                    {/* Par Row */}
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold', alignSelf: 'center' }}>P</div>
                                                    {[...Array(9)].map((_, i) => (
                                                        <input
                                                            key={`par-${i}`}
                                                            type="number"
                                                            placeholder="-"
                                                            value={(formData.scorecards[idx]?.pars || [])[i] || ''}
                                                            readOnly
                                                            tabIndex={-1}
                                                            style={{
                                                                width: '100%',
                                                                padding: '2px',
                                                                textAlign: 'center',
                                                                fontSize: '0.8rem',
                                                                border: 'none',
                                                                background: 'transparent',
                                                                color: '#888',
                                                                fontWeight: 'bold'
                                                            }}
                                                        />
                                                    ))}
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center' }}>
                                                        {(formData.scorecards[idx]?.pars || []).slice(0, 9).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                    </div>

                                                    {/* Strokes Row */}
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold', alignSelf: 'center' }}>G</div>
                                                    {[...Array(9)].map((_, i) => (
                                                        <input
                                                            key={`stroke-${i}`}
                                                            type="number"
                                                            placeholder="-"
                                                            value={(formData.scorecards[idx]?.strokes || [])[i] || ''}
                                                            onChange={(e) => handleHoleChange(idx, i, 'strokes', e.target.value)}
                                                            style={{ width: '100%', padding: '2px', textAlign: 'center', fontSize: '0.8rem', border: '1px solid #ddd', backgroundColor: '#fffbeb' }}
                                                        />
                                                    ))}
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center' }}>
                                                        {(formData.scorecards[idx]?.strokes || []).slice(0, 9).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(9, 1fr) 50px', gap: '2px' }}>
                                                    {/* Header 10-18 */}
                                                    <div></div>
                                                    {[...Array(9)].map((_, i) => (
                                                        <div key={i + 9} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>{i + 10}</div>
                                                    ))}
                                                    <div style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>VTA</div>

                                                    {/* Par Row */}
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold', alignSelf: 'center' }}>P</div>
                                                    {[...Array(9)].map((_, i) => (
                                                        <input
                                                            key={`par-${i + 9}`}
                                                            type="number"
                                                            placeholder="-"
                                                            value={(formData.scorecards[idx]?.pars || [])[i + 9] || ''}
                                                            readOnly
                                                            tabIndex={-1}
                                                            style={{
                                                                width: '100%',
                                                                padding: '2px',
                                                                textAlign: 'center',
                                                                fontSize: '0.8rem',
                                                                border: 'none',
                                                                background: 'transparent',
                                                                color: '#888',
                                                                fontWeight: 'bold'
                                                            }}
                                                        />
                                                    ))}
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center' }}>
                                                        {(formData.scorecards[idx]?.pars || []).slice(9, 18).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                    </div>

                                                    {/* Strokes Row */}
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold', alignSelf: 'center' }}>G</div>
                                                    {[...Array(9)].map((_, i) => (
                                                        <input
                                                            key={`stroke-${i + 9}`}
                                                            type="number"
                                                            placeholder="-"
                                                            value={(formData.scorecards[idx]?.strokes || [])[i + 9] || ''}
                                                            onChange={(e) => handleHoleChange(idx, i + 9, 'strokes', e.target.value)}
                                                            style={{ width: '100%', padding: '2px', textAlign: 'center', fontSize: '0.8rem', border: '1px solid #ddd', backgroundColor: '#fffbeb' }}
                                                        />
                                                    ))}
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center' }}>
                                                        {(formData.scorecards[idx]?.strokes || []).slice(9, 18).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                                    <button
                                                        onClick={() => handleResetCard(idx)}
                                                        style={{
                                                            fontSize: '0.8rem',
                                                            color: '#ef4444',
                                                            background: 'none',
                                                            border: '1px solid #ef4444',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Trash2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                        Resetear
                                                    </button>
                                                    <button
                                                        onClick={() => handleShareCard(idx)}
                                                        style={{
                                                            fontSize: '0.8rem',
                                                            color: '#10b981',
                                                            background: 'none',
                                                            border: '1px solid #10b981',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Share2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                        Compartir
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Hidden Social Card Container */}
                            {/* Hidden Social Card Container */}
                            <div id="social-card-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '600px', padding: '40px', background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', color: 'white', fontFamily: 'sans-serif', borderRadius: '12px' }}>
                                {/* This will simplify rendering the card for sharing */}
                                {sharingRound !== null && formData.rounds[sharingRound] && (
                                    <>
                                        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                            <h2 style={{ fontSize: '28px', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{selectedTournament?.name}</h2>
                                            <p style={{ opacity: 0.8, fontSize: '16px' }}>{getRoundDates(selectedTournament?.dates)[sharingRound]?.toLocaleDateString()}</p>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '30px' }}>
                                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '12px', width: '150px' }}>
                                                <div style={{ fontSize: '14px', textTransform: 'uppercase', opacity: 0.8 }}>Golpes</div>
                                                <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{formData.rounds[expandedRound]}</div>
                                            </div>
                                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.9)', color: '#064e3b', padding: '20px', borderRadius: '12px', width: '150px' }}>
                                                <div style={{ fontSize: '14px', textTransform: 'uppercase', fontWeight: 'bold' }}>Stableford</div>
                                                <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{formData.stableford[expandedRound] || '-'}</div>
                                            </div>
                                        </div>

                                        {/* Scorecard Grid for Image */}
                                        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', color: '#333' }}>
                                            {/* Front 9 */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(9, 1fr) 50px', gap: '4px', marginBottom: '15px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center' }}>HOYO</div>
                                                {[...Array(9)].map((_, i) => <div key={i} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{i + 1}</div>)}
                                                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>IDA</div>

                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center', color: '#666' }}>PAR</div>
                                                {[...Array(9)].map((_, i) => <div key={i} style={{ textAlign: 'center', fontSize: '14px' }}>{(formData.scorecards[expandedRound]?.pars || [])[i] || '-'}</div>)}
                                                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {(formData.scorecards[expandedRound]?.pars || []).slice(0, 9).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                </div>

                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center' }}>GOLPE</div>
                                                {[...Array(9)].map((_, i) => {
                                                    const par = parseInt((formData.scorecards[expandedRound]?.pars || [])[i]);
                                                    const str = parseInt((formData.scorecards[expandedRound]?.strokes || [])[i]);
                                                    let bg = '#f3f4f6';
                                                    let color = '#333';
                                                    if (par && str) {
                                                        if (str < par) { bg = '#dcfce7'; color = '#15803d'; } // Birdie
                                                        if (str > par) { bg = '#fee2e2'; color = '#b91c1c'; } // Bogey
                                                    }
                                                    return (
                                                        <div key={i} style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', background: bg, color: color, borderRadius: '4px', padding: '2px 0' }}>
                                                            {str || '-'}
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {(formData.scorecards[expandedRound]?.strokes || []).slice(0, 9).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                </div>
                                            </div>

                                            {/* Back 9 */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(9, 1fr) 50px', gap: '4px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center' }}>HOYO</div>
                                                {[...Array(9)].map((_, i) => <div key={i + 9} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{i + 10}</div>)}
                                                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>VTA</div>

                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center', color: '#666' }}>PAR</div>
                                                {[...Array(9)].map((_, i) => <div key={i + 9} style={{ textAlign: 'center', fontSize: '14px' }}>{(formData.scorecards[expandedRound]?.pars || [])[i + 9] || '-'}</div>)}
                                                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {(formData.scorecards[expandedRound]?.pars || []).slice(9, 18).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                </div>

                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center' }}>GOLPE</div>
                                                {[...Array(9)].map((_, i) => {
                                                    const par = parseInt((formData.scorecards[expandedRound]?.pars || [])[i + 9]);
                                                    const str = parseInt((formData.scorecards[expandedRound]?.strokes || [])[i + 9]);
                                                    let bg = '#f3f4f6';
                                                    let color = '#333';
                                                    if (par && str) {
                                                        if (str < par) { bg = '#dcfce7'; color = '#15803d'; } // Birdie
                                                        if (str > par) { bg = '#fee2e2'; color = '#b91c1c'; } // Bogey
                                                    }
                                                    return (
                                                        <div key={i + 9} style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', background: bg, color: color, borderRadius: '4px', padding: '2px 0' }}>
                                                            {str || '-'}
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {(formData.scorecards[expandedRound]?.strokes || []).slice(9, 18).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'center', marginTop: '30px', opacity: 0.6, fontSize: '14px' }}>
                                            <p>Generado con Golf Tracker 2026</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '0.9rem' }}>Posición Final</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: T5"
                                        value={formData.position}
                                        onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                                    />
                                </div>
                                <div>
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

                            {/* Tag Toggles */}
                            <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Etiquetas del Torneo</label>
                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="edit-grand-prix"
                                            checked={t.grand_prix || false}
                                            onChange={(e) => {
                                                if (onUpdateTournament) {
                                                    onUpdateTournament({ ...t, grand_prix: e.target.checked });
                                                }
                                            }}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-grand-prix)' }}
                                        />
                                        <label htmlFor="edit-grand-prix" style={{ fontWeight: '500' }}>Grand Prix</label>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="edit-valedera"
                                            checked={t.valedera || false}
                                            onChange={(e) => {
                                                if (onUpdateTournament) {
                                                    onUpdateTournament({ ...t, valedera: e.target.checked });
                                                }
                                            }}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-accent)' }}
                                        />
                                        <label htmlFor="edit-valedera" style={{ fontWeight: '500' }}>Valedera</label>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="edit-camiral"
                                            checked={t.groups && t.groups.includes('camiral')}
                                            onChange={(e) => {
                                                if (onUpdateTournament) {
                                                    const currentGroups = t.groups || ['club'];
                                                    let newGroups;
                                                    if (e.target.checked) {
                                                        newGroups = [...currentGroups, 'camiral'];
                                                    } else {
                                                        newGroups = currentGroups.filter(g => g !== 'camiral');
                                                    }
                                                    // Deduplicate just in case
                                                    newGroups = [...new Set(newGroups)];
                                                    onUpdateTournament({ ...t, groups: newGroups });
                                                }
                                            }}
                                            style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                                        />
                                        <label htmlFor="edit-camiral" style={{ fontWeight: '500' }}>Camiral</label>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {results[t.id] && (
                                    <button className="btn" style={{ flex: 1, color: '#ef4444', border: '1px solid #ef4444' }} onClick={handleDeleteResult}>
                                        <Trash2 size={18} style={{ marginRight: '8px' }} /> Borrar
                                    </button>
                                )}
                                <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSaveResults}>
                                    <Save size={18} style={{ marginRight: '8px' }} /> Guardar Resultados
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Read Only View (Results Tab) */
                        renderSummaryCard()
                    )}
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER GRID VIEW
    // -------------------------------------------------------------------------
    return (
        <div>
            {/* Action Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '0.75rem'
            }}>
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    maxWidth: '100%'
                }}>
                    {/* Integrated Control Group */}
                    <div style={{
                        display: 'flex',
                        background: '#f1f5f9',
                        padding: '4px',
                        borderRadius: '8px',
                        gap: '2px',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                            style={{
                                border: 'none',
                                background: isFiltersOpen ? 'white' : 'transparent',
                                color: isFiltersOpen ? 'var(--color-primary)' : '#64748b',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                boxShadow: isFiltersOpen ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Filter size={14} />
                            FILTROS {activeGroups.length > 0 && `(${activeGroups.length})`}
                        </button>

                        <div style={{ width: '1px', background: '#e2e8f0', margin: '4px 2px' }}></div>

                        <button
                            onClick={() => setFilter('upcoming')}
                            style={{
                                border: 'none',
                                background: filter === 'upcoming' ? 'white' : 'transparent',
                                color: filter === 'upcoming' ? 'var(--color-primary)' : '#64748b',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                boxShadow: filter === 'upcoming' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Próximos
                        </button>
                        <button
                            onClick={() => setFilter('all')}
                            style={{
                                border: 'none',
                                background: filter === 'all' ? 'white' : 'transparent',
                                color: filter === 'all' ? 'var(--color-primary)' : '#64748b',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                boxShadow: filter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilter('conflicts')}
                            style={{
                                border: 'none',
                                background: filter === 'conflicts' ? 'white' : 'transparent',
                                color: filter === 'conflicts' ? 'var(--color-conflict)' : '#64748b',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                boxShadow: filter === 'conflicts' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Coincidencias
                        </button>
                    </div>
                </div>

                <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                    <Plus size={18} style={{ marginRight: '5px' }} /> Nuevo Torneo
                </button>
            </div>

            {/* Expanded Categories Panel */}
            {isFiltersOpen && (
                <div style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: 'white',
                    border: '1px solid #E5E1DE',
                    borderRadius: '8px'
                }}>
                    <CalendarFilters activeGroups={activeGroups} onChange={onUpdateGroups} />
                </div>
            )}

            {/* Add Tournament Form Modal */}
            {showAddForm && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000,
                    paddingTop: '5rem', overflowY: 'auto'
                }}>
                    <div className="card fade-in" style={{ width: '90%', maxWidth: '500px', padding: '2rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem' }}>Nuevo Torneo</h2>
                            <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="text" placeholder="Nombre del Torneo"
                                value={newTournament.name}
                                onChange={e => setNewTournament({ ...newTournament, name: e.target.value })}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                            />
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: '#666' }}>Fecha Inicio</label>
                                    <input
                                        type="date"
                                        value={newTournament.startDate}
                                        onChange={e => setNewTournament({ ...newTournament, startDate: e.target.value })}
                                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '18px' }}>
                                    <input
                                        type="checkbox"
                                        id="isMultiDay"
                                        checked={newTournament.isMultiDay}
                                        onChange={e => setNewTournament({ ...newTournament, isMultiDay: e.target.checked })}
                                    />
                                    <label htmlFor="isMultiDay" style={{ fontSize: '0.9rem' }}>Multidía</label>
                                </div>
                            </div>

                            {newTournament.isMultiDay && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: '#666' }}>Duración (días)</label>
                                    <input
                                        type="number"
                                        min="2"
                                        value={newTournament.duration}
                                        onChange={e => setNewTournament({ ...newTournament, duration: e.target.value })}
                                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}
                                    />
                                </div>
                            )}
                            <input
                                list="spanish-courses"
                                type="text" placeholder="Campo de Golf"
                                value={newTournament.course}
                                onChange={e => setNewTournament({ ...newTournament, course: e.target.value })}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                            />
                            <datalist id="spanish-courses">
                                {allCourses.map((course, index) => (
                                    <option key={index} value={course} />
                                ))}
                            </datalist>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <input
                                        type="checkbox"
                                        id="isGrandPrix"
                                        checked={newTournament.grand_prix}
                                        onChange={e => setNewTournament({ ...newTournament, grand_prix: e.target.checked })}
                                    />
                                    <label htmlFor="isGrandPrix" style={{ fontSize: '0.9rem' }}>Grand Prix</label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <input
                                        type="checkbox"
                                        id="isValedera"
                                        checked={newTournament.valedera}
                                        onChange={e => setNewTournament({ ...newTournament, valedera: e.target.checked })}
                                    />
                                    <label htmlFor="isValedera" style={{ fontSize: '0.9rem' }}>Valedera</label>
                                </div>
                            </div>

                            <select
                                value={newTournament.organizer}
                                onChange={e => setNewTournament({ ...newTournament, organizer: e.target.value })}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                            >
                                <option value="CLUB">CLUB</option>
                                <option value="RFEG">RFEG</option>
                                <option value="FCG">FCG</option>
                            </select>

                            <button className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '1rem' }} onClick={handleAddTournament}>
                                <Save size={18} style={{ marginRight: '8px' }} /> Guardar Torneo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid or List based on ViewMode */}
            <div
                className={viewMode === 'results' ? "results-list fade-in" : "calendar-grid fade-in"}
                style={viewMode === 'results' ? { display: 'flex', flexDirection: 'column' } : {}}
            >
                {sortedTournaments.map((t) => {
                    if (viewMode === 'results') {
                        return renderResultRow(t);
                    }

                    const result = results[t.id];
                    return (
                        <div
                            key={t.id}
                            className="card fade-in"
                            style={{ ...getCardStyle(t), cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                            onClick={() => handleTournamentClick(t)}
                            onContextMenu={(e) => handleContextMenu(e, t)}
                            onTouchStart={() => handleTouchStart(t)}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div
                                style={{
                                    position: 'absolute', top: '10px', right: '10px',
                                    color: '#000', background: 'white',
                                    padding: '6px', borderRadius: '50%',
                                    zIndex: 100, cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleContextMenu(e, t);
                                }}
                            >
                                <MoreVertical size={18} />
                            </div>

                            {/* JUGADO Overlay for Past Tournaments */}
                            {
                                isPast(t.dates) && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%) rotate(-15deg)',
                                        border: '4px solid rgba(140, 133, 127, 0.4)',
                                        color: 'rgba(140, 133, 127, 0.4)',
                                        padding: '10px 20px',
                                        fontSize: '2.5rem',
                                        fontWeight: '900',
                                        borderRadius: '12px',
                                        zIndex: 10,
                                        pointerEvents: 'none',
                                        textTransform: 'uppercase',
                                        letterSpacing: '5px'
                                    }}>
                                        JUGADO
                                    </div>
                                )
                            }
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <span className="badge" style={{
                                        backgroundColor: ['RFEG', 'FCG'].includes(t.organizer) ? 'var(--color-federation)' : 'rgba(0,0,0,0.05)',
                                        color: ['RFEG', 'FCG'].includes(t.organizer) ? 'white' : 'var(--color-text-main)'
                                    }}>
                                        {t.organizer}
                                    </span>
                                    {t.grand_prix && (
                                        <span className="badge" style={{ backgroundColor: 'var(--color-grand-prix)', color: 'white' }}>
                                            GRAND PRIX
                                        </span>
                                    )}
                                    {t.valedera && (
                                        <span className="badge" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}>
                                            VALEDERA
                                        </span>
                                    )}
                                </div>
                                {t.conflict && (
                                    <span className="badge" style={{ backgroundColor: 'var(--color-conflict)', color: 'white' }}>
                                        COINCIDE
                                    </span>
                                )}
                            </div>

                            <h3 style={{
                                margin: '0 0 0.5rem 0',
                                fontSize: '1rem',
                                fontWeight: '500',
                                color: t.conflict ? 'var(--color-conflict)' : 'inherit',
                                lineHeight: '1.2',
                                display: '-webkit-box',
                                WebkitLineClamp: '2',
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                {t.name}
                            </h3>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>
                                <CalendarDays size={16} />
                                <span>{t.dates}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: result ? '12px' : '0' }}>
                                <MapPin size={16} />
                                <span>{t.course}</span>
                            </div>

                            {
                                result && (
                                    <div style={{
                                        marginTop: '8px',
                                        paddingTop: '8px',
                                        borderTop: '1px solid rgba(0,0,0,0.05)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {result.position && (
                                                <div style={{
                                                    background: 'var(--color-primary)',
                                                    color: 'white',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontWeight: 'bold',
                                                    fontSize: '1rem'
                                                }}>
                                                    {result.position}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ fontSize: '1.3rem', fontWeight: '800', textAlign: 'right', color: 'var(--color-text-main)' }}>
                                            {(() => {
                                                const validRounds = result.rounds ? result.rounds.filter(r => r && r !== '').map((r, i) => ({ score: r, idx: i + 1 })) : [];

                                                if (validRounds.length > 1) {
                                                    return (
                                                        <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>
                                                            {validRounds.map((r, i) => (
                                                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                                    {i > 0 && <span style={{ margin: '0 8px', opacity: 0.3 }}>•</span>}
                                                                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal', fontSize: '0.9rem', marginRight: '4px' }}>R{r.idx}</span>
                                                                    {r.score}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    );
                                                } else {
                                                    return (
                                                        <>
                                                            {result.total > 0 && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
                                                                    {result.total}
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>golpes</span>
                                                                    {(() => {
                                                                        const par = t.par || 72;
                                                                        const diff = result.total - par;
                                                                        const diffStr = diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : '(E)';
                                                                        const color = diff > 0 ? '#ef4444' : diff < 0 ? '#22c55e' : '#64748b';
                                                                        return <span style={{ fontSize: '0.9rem', color: color, fontWeight: '600', marginLeft: '2px' }}>{diffStr}</span>;
                                                                    })()}
                                                                </span>
                                                            )}
                                                            {result.total > 0 && result.stablefordTotal > 0 ? <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span> : ''}
                                                            {result.stablefordTotal > 0 && <span style={{ color: 'var(--color-accent)' }}>{result.stablefordTotal} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>stb</span></span>}
                                                        </>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                    );
                })}
                {sortedTournaments.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        gridColumn: '1/-1',
                        width: '100%', // Ensure full width in flex container
                        color: 'var(--color-text-muted)',
                        background: '#f8fafc',
                        padding: '2rem',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0'
                    }}>
                        {viewMode === 'results' ? (
                            <>
                                <Trophy size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No hay resultados registrados aún.</p>
                                <p>Ve a la pestaña <strong>Calendario</strong>, selecciona un torneo y guarda tus resultados.</p>
                            </>
                        ) : (
                            <p style={{ fontSize: '1.2rem' }}>No se encontraron torneos con este filtro.</p>
                        )}
                    </div>
                )}
            </div>
            {renderContextMenu()}
        </div>
    );
}
