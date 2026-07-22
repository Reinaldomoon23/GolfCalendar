import { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// ... imports ...

// ... imports ...
import { ChevronLeft, ChevronRight, Info, Calendar, Trophy, Plus, MapPin, Trash2, Share2, Filter, CalendarDays, Save, X, AlertTriangle, List, MoreVertical, Copy, Edit, Radio, Users, FileText } from 'lucide-react';
import MobileScorecardEditor from './MobileScorecardEditor';
import spanishCourses from '../data/spanish_courses.json';
import CalendarFilters from './CalendarFilters';
import MonthGridView from './MonthGridView';
import CommunityExplorerModal from './CommunityExplorerModal';
import TournamentCreateForm from './TournamentCreateForm';
import { generateTournamentDeterministicId } from '../services/tournaments.service';
import TournamentLeaderboard from './TournamentLeaderboard';
import TournamentReport from './TournamentReport';
import { isSharedTournamentId } from '../services/leaderboard.service';
import { fetchTournamentWeatherSamples } from '../services/weather.service';
import { getScorecardParTotal, resolveCourseScorecard } from '../utils/courseScorecards';
import { buildTournamentReport, printTournamentReport } from '../utils/tournamentReport';

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

const LEGACY_SANT_CUGAT_PARS = [
    4, 3, 5, 4, 4, 3, 5, 4, 4,
    4, 4, 4, 4, 4, 3, 4, 3, 4
];

const normalizeCourseName = (value = '') => value.toLowerCase().trim();

const findCourseData = (courseName) => {
    const normalizedCourse = normalizeCourseName(courseName);
    if (!normalizedCourse) return null;

    return spanishCourses.find(c => normalizeCourseName(c.name) === normalizedCourse) ||
        spanishCourses.find(c => {
            const normalizedCatalogName = normalizeCourseName(c.name);
            return normalizedCatalogName.includes(normalizedCourse) || normalizedCourse.includes(normalizedCatalogName);
        });
};

const normalizeParArray = (pars = []) => pars.map(p => String(p || '').trim());

const samePars = (a = [], b = []) => {
    const normalizedA = normalizeParArray(a);
    const normalizedB = normalizeParArray(b);
    return normalizedA.length === normalizedB.length && normalizedA.every((value, index) => value === normalizedB[index]);
};

const normalizeHoleArray = (values = []) => Array.from({ length: 18 }, (_, index) => values?.[index] ?? '');

const shouldReplaceSavedPars = (t, savedPars, defaultPars) => {
    const courseName = normalizeCourseName(t?.course);
    if (!Array.isArray(savedPars) || !Array.isArray(defaultPars) || defaultPars.length !== 18) return false;
    if (samePars(savedPars, defaultPars)) return false;

    return courseName.includes('sant cugat') && samePars(savedPars, LEGACY_SANT_CUGAT_PARS);
};



const getTournamentPar = (t, result, spanishCourses) => {
    // 1. Check if the result record has a saved par override
    if (result?.tournamentPar) return result.tournamentPar;
    // 2. Check if the tournament record has its own par
    if (t?.par) return t.par;
    // 3. Perform a course lookup if possible
    if (t?.course && spanishCourses) {
        const courseName = t.course.toLowerCase();
        const courseData = findCourseData(t.course);
        const scorecard = resolveCourseScorecard(t, courseData);
        if (scorecard?.pars) {
            const sum = getScorecardParTotal(scorecard);
            if (sum > 0) {
                // Special case for Salamanca Forum (hack preserved)
                if (courseName.includes('salamanca forum') && sum === 71) return 70;
                return sum;
            }
        }
    }
    // 4. Default fallback
    return 72;
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
    onUpdateGroups,
    customThemes = {}, // New Prop
    onUpdateTheme, // New Prop
    onSaveSpecificResult,
    onDeleteResult,
    user,
    managedUsers = [],
    allAvailableTournaments = [],
    onJoinTournament,
    onLeaveTournament,
    subscribedTournaments = [],
    subscribedIds = [],
}) {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Dynamic Conflict Calculation: Always compute 'conflict' based on current data
    const tournaments = useMemo(() => {
        // 1. Pre-calculate parsed ranges for all tournaments
        const withRanges = initialTournaments.map(t => {
            const { start, end } = parseDateHelper(t.dates);
            return { ...t, _start: start, _end: end };
        });

        // 2. Check for overlaps
        return withRanges.map((t, idx, arr) => {
            if (!t.dates) return { ...t, conflict: false };

            // Check if this tournament overlaps with any OTHER tournament
            const hasConflict = arr.some((other, otherIdx) => {
                if (idx === otherIdx) return false; // Don't compare with self
                if (!other.dates) return false;

                // Overlap formula: StartA <= EndB && EndA >= StartB
                const overlap = (t._start <= other._end && t._end >= other._start);
                return overlap;
            });

            return { ...t, conflict: hasConflict };
        });
    }, [initialTournaments]);

    const [filter, setFilter] = useState('upcoming'); // all, upcoming, conflicts, grand_prix
    const [calendarType, setCalendarType] = useState('list'); // 'list' | 'month'
    // Note: 'grand_prix' filter option is redundant if we have Groups, but let's keep it for "Highlight" logic or remove it?
    // Let's hide the old filter buttons if they overlap, or keep them as "Time Filters" (Upcoming/All).

    const [detailTab, setDetailTab] = useState('results'); // 'results' | 'leaderboard'
    const [showAddForm, setShowAddForm] = useState(false);
    const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
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
    const selectedTournament = useMemo(() =>
        id ? tournaments.find(t => String(t.id) === id) || null : null
        , [id, tournaments]);
    const selectedResult = selectedTournament ? results[selectedTournament.id] : null;

    // --- NEW: Editing Tournament Details State ---
    const [editingDetails, setEditingDetails] = useState({});
    const readSavedMobileMode = () => {
        try {
            const saved = localStorage.getItem('golf_tracker_mobile_mode');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.tournamentId && parsed.tournamentId === id && parsed.cardIdx !== undefined && parsed.holeIdx !== undefined) {
                    return { cardIdx: parsed.cardIdx, holeIdx: parsed.holeIdx };
                }
            }
        } catch (e) { }
        return null; // { cardIdx, holeIdx }
    };
    const [mobileMode, setMobileMode] = useState(readSavedMobileMode);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (mobileMode && id) {
            localStorage.setItem('golf_tracker_mobile_mode', JSON.stringify({
                active: true,
                cardIdx: mobileMode.cardIdx,
                holeIdx: mobileMode.holeIdx,
                tournamentId: id
            }));
        }
    }, [mobileMode, id]);

    useEffect(() => {
        const restoreMobileMode = () => {
            if (document.visibilityState && document.visibilityState !== 'visible') return;
            if (mobileMode || !id) return;
            const savedMode = readSavedMobileMode();
            if (savedMode) {
                setIsEditingResults(true);
                setMobileMode(savedMode);
            }
        };

        window.addEventListener('pageshow', restoreMobileMode);
        document.addEventListener('visibilitychange', restoreMobileMode);

        return () => {
            window.removeEventListener('pageshow', restoreMobileMode);
            document.removeEventListener('visibilitychange', restoreMobileMode);
        };
    }, [id, mobileMode]);

    const closeMobileMode = () => {
        localStorage.removeItem('golf_tracker_mobile_mode');
        setMobileMode(null);
    };

    useEffect(() => {
        if (selectedTournament) {
            const existingResult = selectedResult || {};
            setDetailTab('results'); // Reset tab to results when switching tournaments
            // Check if we navigated here with intent to edit
            const shouldEdit = location.state?.edit === true;
            setIsEditing(shouldEdit);

            // Calculate default par from course data if not set
            let calculatedPar = 72;
            if (selectedTournament.course) {
                const courseData = findCourseData(selectedTournament.course);
                const scorecard = resolveCourseScorecard(selectedTournament, courseData);

                if (scorecard?.pars) {
                    const sum = getScorecardParTotal(scorecard);
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
                sace: selectedTournament.sace || false,
                merit: selectedTournament.merit || (selectedTournament.type === 'merit') || false,
                wagr: selectedTournament.wagr || false,
                conflict: selectedTournament.conflict || false,
                groups: selectedTournament.groups || [],
                type: selectedTournament.type || 'club',
                target_score: selectedTournament.target_score !== undefined ? selectedTournament.target_score : null,
                track_putts: existingResult.track_putts === true,
                track_girs: existingResult.track_girs === true,
                tee_time: selectedTournament.tee_time || existingResult.tee_time || null
            });
        }
    }, [selectedTournament, location.state, selectedResult?.track_putts, selectedResult?.track_girs, selectedResult?.tee_time]);

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
            const courseData = findCourseData(value);
            const scorecard = resolveCourseScorecard({ ...selectedTournament, course: value }, courseData);
            if (scorecard?.pars) {
                const sum = getScorecardParTotal(scorecard);
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
            notify(hasConflict ? 'Guardado. Se ha detectado un conflicto de fechas.' : 'Configuracion guardada.', hasConflict ? 'warning' : 'success');
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
    const [notification, setNotification] = useState(null);
    const notificationTimer = useRef(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const confirmResolver = useRef(null);

    const notify = (message, type = 'info') => {
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        setNotification({ message, type });
        notificationTimer.current = setTimeout(() => setNotification(null), 3600);
    };

    const askConfirm = ({ title = 'Confirmar acción', message, confirmText = 'Aceptar', cancelText = 'Cancelar', danger = false }) => (
        new Promise((resolve) => {
            confirmResolver.current = resolve;
            setConfirmDialog({ title, message, confirmText, cancelText, danger });
        })
    );

    const resolveConfirm = (value) => {
        if (confirmResolver.current) confirmResolver.current(value);
        confirmResolver.current = null;
        setConfirmDialog(null);
    };

    const copyToClipboard = async (text, successMessage) => {
        try {
            await navigator.clipboard.writeText(text);
            notify(successMessage, 'success');
        } catch (err) {
            console.warn('[share] Clipboard unavailable:', err);
            notify('No se pudo copiar automaticamente. Usa el menu de compartir si esta disponible.', 'warning');
        }
    };

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
        const h = (e) => {
            if (e.target.closest('[data-context-menu]') || e.target.closest('[data-context-menu-trigger]')) {
                return;
            }
            setContextMenu(null);
        };
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

    const handleReportFromMenu = async (t) => {
        const result = results?.[t.id];
        if (!result) {
            notify('Todavia no hay resultados guardados para generar el informe.', 'warning');
            setContextMenu(null);
            return;
        }

        const weatherSamples = await fetchTournamentWeatherSamples(t.id);
        const opened = printTournamentReport(buildTournamentReport(t, result, user, { weatherSamples }));
        if (!opened) {
            notify('El navegador ha bloqueado la ventana del informe.', 'warning');
        }
        setContextMenu(null);
    };

    const handleDeleteFromMenu = async (t) => {
        const shouldDelete = await askConfirm({
            title: 'Borrar torneo',
            message: `Se borrara el torneo "${t.name}". Esta accion no se puede deshacer.`,
            confirmText: 'Borrar torneo',
            cancelText: 'Cancelar',
            danger: true,
        });
        if (!shouldDelete) return;

        if (onDeleteTournament) onDeleteTournament(t.id);
        setContextMenu(null);
        notify('Torneo borrado.', 'success');
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

            console.log("DEBUG: CalendarView init", { tId: t.id, existing, resultsKeys: Object.keys(results) });

            // Calculate Pars
            const calculatedPars = roundDates.map(() => Array(18).fill(''));

            // Lookup course pars (Loose matching)
            const courseData = findCourseData(t.course);
            const scorecard = resolveCourseScorecard(t, courseData);
            const defaultPars = scorecard?.pars || Array(18).fill('');

            // Helper to get initial scorecard for a round
            const getInitialScorecard = (rIdx) => {
                // Robust access: Check index as number or string (JSON keys)
                const savedCard = (existing.scorecards && (existing.scorecards[rIdx] || existing.scorecards[String(rIdx)]));

                if (savedCard) {
                    console.log(`Resources for R${rIdx} found:`, savedCard);
                    // Start with existing, but if pars are empty/missing, try to fill them
                    const card = savedCard;
                    const currentPars = card.pars || Array(18).fill('');

                    const replaceSavedPars = shouldReplaceSavedPars(t, currentPars, defaultPars);

                    // Safe-fill: fill empty slots. Known stale cards are refreshed without touching strokes/putts.
                    const mergedPars = currentPars.map((p, i) => {
                        if (replaceSavedPars) return defaultPars[i] || '';
                        if (t.course?.toLowerCase().includes('salamanca forum') && i === 14 && p === 5) return 4;
                        return p || defaultPars[i] || '';
                    });

                    return {
                        ...card,
                        pars: mergedPars,
                        strokes: normalizeHoleArray(card.strokes),
                        putts: normalizeHoleArray(card.putts),
                        girs: normalizeHoleArray(card.girs)
                    };
                }
                // New card
                console.log(`No saved card for R${rIdx}, creating new.`);
                return {
                    pars: defaultPars.map(p => p || ''),
                    strokes: Array(18).fill(''),
                    putts: Array(18).fill(''),
                    girs: Array(18).fill('')
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
                totalPutts: roundDates.map((_, i) => (existing.totalPutts && existing.totalPutts[i]) ? existing.totalPutts[i] : ((existing.scorecards && existing.scorecards[i] && existing.scorecards[i].putts) ? existing.scorecards[i].putts.reduce((a, b) => a + (parseInt(b) || 0), 0) || '' : '')),
                scorecards: initialScorecards
            });
        }
    }, [id, JSON.stringify(results[id])]);

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
        valedera: false,
        sace: false,
        publishToCommunity: false
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

    const handleAddTournament = async () => {
        if (!newTournament.name || !newTournament.startDate) {
            notify('Nombre y fecha de inicio son obligatorios.', 'warning');
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

        // Check for conflicts with existing tournaments
        const { start: newStartTs, end: newEndTs } = parseDateHelper(dateString);
        // exclude self if editing? No, here we are adding NEW.
        const conflict = tournaments.find(t => {
            const { start: tStart, end: tEnd } = parseDateHelper(t.dates);
            return (newStartTs <= tEnd && tStart <= newEndTs);
        });

        if (conflict) {
            const shouldCreate = await askConfirm({
                title: 'Conflicto de fechas',
                message: `Este nuevo torneo coincide con "${conflict.name}" (${conflict.dates}). Si lo creas igualmente puede generar una coincidencia.`,
                confirmText: 'Crear igualmente',
                cancelText: 'Cancelar',
                danger: true,
            });
            if (!shouldCreate) {
                return;
            }
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
            sace: newTournament.sace,
            groups: ['club'] // Default group for custom
        };


        // CHECK FOR DUPLICATES BEFORE SAVING
        const detId = generateTournamentDeterministicId(t);
        const existing = allAvailableTournaments.find(at => at.id === detId || (at.name === t.name && at.dates === t.dates));

        if (existing && !existing.custom) {
            const shouldJoinExisting = await askConfirm({
                title: 'Torneo ya existente',
                message: `Hemos detectado que "${existing.name}" ya existe en el catalogo. Puedes apuntarte al torneo oficial para conectarte con el resto de jugadoras.`,
                confirmText: 'Apuntarme al oficial',
                cancelText: 'Crear el mio',
            });
            if (shouldJoinExisting) {
                // User chose to join existing one
                const joinedTournament = {
                    ...existing,
                    id: existing.id,
                    custom: true,
                    isShared: true,
                    joinedAt: new Date().toISOString()
                };
                if (onAddTournament) await onAddTournament(joinedTournament, false);
                setShowAddForm(false);
                notify('Te has apuntado al torneo oficial.', 'success');
                return;
            }
        }

        if (onAddTournament) onAddTournament(t, newTournament.publishToCommunity);
        notify('Torneo creado.', 'success');

        // UX Improvement: If adding a past tournament, switch filter to 'all' so it doesn't "disappear"
        const tDate = parseDate(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (tDate < today) {
            setFilter('all');
        }

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
            valedera: false,
            sace: false,
            publishToCommunity: false
        });
    };

    const handleRoundChange = (idx, field, value) => {
        setIsEditingResults(true); // Track edit mode so autosave works
        const updated = [...formData[field]];
        updated[idx] = value;
        setFormData(prev => ({ ...prev, [field]: updated }));
    };

    // Scorecard Logic
    const [expandedRound, setExpandedRound] = useState(0); // idx of round currently expanded (default 0)
    const [sharingRound, setSharingRound] = useState(null); // idx of round being shared (for hidden capture)

    const handleHoleChange = (roundIdx, holeIdx, field, value) => {
        setIsEditingResults(true); // Track edit mode so autosave works
        // field = 'pars' or 'strokes'
        setFormData(prev => {
            const currentScorecards = prev.scorecards || {};
            const roundCard = currentScorecards[roundIdx] || { pars: Array(18).fill(''), strokes: Array(18).fill('') };

            const newArray = [...(roundCard[field] || Array(18).fill(''))];
            newArray[holeIdx] = value;

            const updatedCard = { ...roundCard, [field]: newArray };

            // Calculate Totals Automation
            let newRounds = [...prev.rounds];
            let newTotalPutts = [...(prev.totalPutts || [])];

            if (field === 'strokes') {
                const totalStrokes = updatedCard.strokes.reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
                newRounds[roundIdx] = totalStrokes > 0 ? totalStrokes.toString() : '';
            }
            if (field === 'putts') {
                const totalPutts = updatedCard.putts.reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
                newTotalPutts[roundIdx] = totalPutts > 0 ? totalPutts.toString() : '';
            }

            return {
                ...prev,
                scorecards: { ...currentScorecards, [roundIdx]: updatedCard },
                rounds: newRounds,
                totalPutts: newTotalPutts
            };
        });
    };

    const handleResetCard = async (roundIdx) => {
        const shouldReset = await askConfirm({
            title: 'Borrar tarjeta',
            message: 'Se borraran todos los datos de esta tarjeta.',
            confirmText: 'Borrar tarjeta',
            cancelText: 'Cancelar',
            danger: true,
        });
        if (!shouldReset) return;

        setIsEditingResults(true); // Track edit mode so autosave works
        setFormData(prev => {
            const currentScorecards = prev.scorecards || {};
            const newRounds = [...prev.rounds];
            newRounds[roundIdx] = ''; // Reset total strokes

            // Re-derive defaults to reset nicely
            const courseData = findCourseData(selectedTournament.course);
            const scorecard = resolveCourseScorecard(selectedTournament, courseData);
            const defaultPars = scorecard?.pars || Array(18).fill('');

            const newCardInfo = {
                pars: defaultPars.map(p => p || ''),
                strokes: Array(18).fill(''),
                putts: Array(18).fill(''),
                girs: Array(18).fill('')
            };

            const newFormData = {
                ...prev,
                scorecards: {
                    ...currentScorecards,
                    [roundIdx]: newCardInfo
                },
                rounds: newRounds
            };

            // INMEDIATE PUSH
            if (onSaveSpecificResult && selectedTournament) {
                const validScores = newFormData.rounds.filter(r => r && !isNaN(r)).map(Number);
                const total = validScores.reduce((a, b) => a + b, 0);
                const average = validScores.length > 0 ? (total / validScores.length).toFixed(1) : 0;
                const validStb = (newFormData.stableford || []).filter(s => s && !isNaN(s)).map(Number);
                const stablefordTotal = validStb.reduce((a, b) => a + b, 0);

                const entry = {
                    ...newFormData,
                    total,
                    average,
                    stablefordTotal,
                    updatedAt: new Date().toISOString(),
                    tournamentName: editingDetails.name || selectedTournament.name,
                    tournamentCourse: editingDetails.course || selectedTournament.course,
                    tournamentDates: editingDetails.dates || selectedTournament.dates,
                    tournamentPar: editingDetails.par || selectedTournament.par || 72,
                    track_putts: editingDetails.track_putts === true,
                    track_girs: editingDetails.track_girs === true,
                    tee_time: editingDetails.tee_time || selectedTournament.tee_time || null
                };
                onSaveSpecificResult(selectedTournament.id, entry);
            }

            return newFormData;
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
                            text: `¡He hecho ${formData.rounds[roundIdx]} golpes en ${editingDetails.name || selectedTournament.name}! 🏌️‍♂️`
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
            notify('Error al generar la imagen.', 'error');
            setSharingRound(null);
        }
    };

    // Auto-Save effect when editing results for real-time syncing
    const saveTimeoutRef = useRef(null);
    useEffect(() => {
        if (!isEditingResults || !selectedTournament || !onSaveSpecificResult) return;

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
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
                updatedAt: new Date().toISOString(),
                // Store tournament metadata so PublicScorecardView always shows correct info
                tournamentName: editingDetails.name || selectedTournament.name,
                tournamentCourse: editingDetails.course || selectedTournament.course,
                tournamentDates: editingDetails.dates || selectedTournament.dates,
                tournamentPar: editingDetails.par || selectedTournament.par || 72,
                track_putts: editingDetails.track_putts === true,
                track_girs: editingDetails.track_girs === true,
                tee_time: editingDetails.tee_time || selectedTournament.tee_time || null
            };

            onSaveSpecificResult(selectedTournament.id, entry);
        }, 1500);

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [formData, isEditingResults, selectedTournament, editingDetails.track_putts, editingDetails.track_girs, editingDetails.tee_time]);

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
            console.warn("⚠️ Mismatch found, saving anyway:\n", mismatchDetails.join("\n"));
        }

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
            updatedAt: new Date().toISOString(),
            tournamentName: editingDetails.name || selectedTournament.name,
            tournamentCourse: editingDetails.course || selectedTournament.course,
            tournamentDates: editingDetails.dates || selectedTournament.dates,
            tournamentPar: editingDetails.par || selectedTournament.par || 72,
            track_putts: editingDetails.track_putts === true,
            track_girs: editingDetails.track_girs === true,
            tee_time: editingDetails.tee_time || selectedTournament.tee_time || null
        };

        if (onSaveSpecificResult) {
            onSaveSpecificResult(selectedTournament.id, entry);
        } else {
            const newResults = { ...results, [selectedTournament.id]: entry };
            if (onUpdateResults) onUpdateResults(newResults);
        }
        // Do NOT close/deselect. Stay in detail/edit view.
    };

    const handleDeleteResult = async () => {
        if (!selectedTournament) return;
        const shouldDelete = await askConfirm({
            title: 'Borrar resultados',
            message: 'Se borraran los resultados guardados de este torneo.',
            confirmText: 'Borrar resultados',
            cancelText: 'Cancelar',
            danger: true,
        });
        if (!shouldDelete) return;

        if (onDeleteResult) {
            onDeleteResult(selectedTournament.id);
        } else {
            const newResults = { ...results };
            delete newResults[selectedTournament.id];
            if (onUpdateResults) onUpdateResults(newResults);
        }
        notify('Resultados borrados.', 'success');
        // Stay in detail view
    };

    const handleDeleteTournamentClick = async () => {
        if (!selectedTournament) return;
        const shouldDelete = await askConfirm({
            title: 'Borrar torneo',
            message: `Se borrara el torneo "${selectedTournament.name}". Esta accion no se puede deshacer.`,
            confirmText: 'Borrar torneo',
            cancelText: 'Cancelar',
            danger: true,
        });
        if (!shouldDelete) return;

        try {
            if (onDeleteTournament) await onDeleteTournament(selectedTournament.id);
            notify('Torneo borrado.', 'success');
            navigate('/');
        } catch (error) {
            console.error('[CalendarView] Error deleting tournament:', error);
            notify(error?.message || 'No se pudo borrar el torneo.', 'error');
        }
    };

    // Helper function to parse dates, considering multi-day events
    // parseDateHelper is already defined at module level (lines 16-26), removing duplicate
    // const parseDateHelper = ...

    const getFilteredTournaments = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Helper to check if currently in progress
        const isInProgress = (t) => {
            if (!t.dates) return false;
            const { start, end } = parseDateHelper(t.dates);
            // Check if today is within range [start, end]
            // We need 'end' to be inclusive of the full day, so let's check timestamps carefully
            // parseDateHelper returns midnight timestamps.
            // Today is midnight.
            // Start <= Today <= End
            const nowTime = today.getTime();
            return (start <= nowTime && nowTime <= end);
        };

        const seen = new Set();
        return tournaments
            .slice()
            .sort((a, b) => {
                const hasResA = results && results[a.id] ? 1 : 0;
                const hasResB = results && results[b.id] ? 1 : 0;
                if (hasResA !== hasResB) return hasResB - hasResA;
                return 0;
            })
            .filter(t => {
                const normalizeStr = (s) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").trim() : "";
                const key = `${normalizeStr(t.name)}_${normalizeStr(t.dates)}`;
                if (seen.has(key)) return false;
                seen.add(key);
            // Priority 0: Explicit Hidden Groups
            if (hiddenGroups && hiddenGroups.length > 0) {
                const shouldHide = hiddenGroups.some(g => {
                    if (g === 'merit') return (t.merit || t.type === 'merit');
                    return false;
                });
                if (shouldHide) return false;
            }

            // Priority 1: If it's a tournament we've joined, ALWAYS SHOW in our calendar
            const isSubscribed = (subscribedIds || []).some(id => String(id) === String(t.id));

            if (activeGroups && activeGroups.length > 0) {
                const matchesFilter = activeGroups.some(g => {
                    if (g === 'valedero') return t.valedera;
                    if (g === 'txell' || g === 'ona') return true;

                    const tGroups = t.groups || [];
                    const tType = t.type || 'club';
                    return tGroups.includes(g) || tType === g;
                });
                
                // If it doesn't match the group filter BUT it's an important official tournament, 
                // we keep it if it's subscribed or official.
                if (!matchesFilter && !isSubscribed) return false;
            }

            // Allow manual overrides? Usually we just filter.

            // --- TIME FILTER LOGIC ---
            if (filter === 'all') return true;

            if (filter === 'upcoming') {
                // If the user is in the monthly calendar grid view, show all tournaments
                // for the month, ignoring the 'upcoming' filter.
                if (calendarType === 'month') return true;

                if (!t.dates) return true; // TBD usually future
                const { start, end } = parseDateHelper(t.dates);

                // Keep if In Progress Or Future
                // Future: end >= today ? No, strictly future starts > today?
                // Actually 'Upcoming' typically means "Not finished yet".
                // So if End Date >= Today, it is upcoming or current.
                // If it is multi-day and we are in day 2, End Date is today or future, so it stays.

                return end >= today.getTime();
            }

            if (filter === 'conflicts') return t.conflict;
            if (filter === 'grand_prix') return t.grand_prix;

            // Default check
            const y = getYear(t.dates);
            return y === currentSeason;
        }).sort((a, b) => {
            const da = parseDate(a.dates);
            const db = parseDate(b.dates);
            return da - db;
        });
    };

    const filteredTournaments = getFilteredTournaments();

    // Grouping
    const groupedTournaments = useMemo(() => {
        const groups = {};
        filteredTournaments.forEach(t => {
            const date = parseDate(t.dates);
            // Use Month Year as key
            const key = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            // Capitalize
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);

            if (!groups[formattedKey]) groups[formattedKey] = [];
            groups[formattedKey].push(t);
        });
        return groups;
    }, [filteredTournaments]);


    // -------------------------------------------------------------------------
    // RENDER HELPER: CARD STYLE
    // -------------------------------------------------------------------------
    const getCardStyle = (t) => {
        const { start, end } = parseDateHelper(t.dates);
        const todayTime = new Date().setHours(0, 0, 0, 0);

        // Past: End date < today
        // Current: Start <= today <= End

        const isFinished = end < todayTime;
        const inProgress = start <= todayTime && todayTime <= end;

        // Base theme based on Organizer
        // (Existing Logic)
        let theme = { bg: '#fff', border: '#e2e8f0' };
        // ... (Organizer colors map) ...
        const ORG_THEMES = {
            'RFEG': { bg: '#FEF2F2', border: '#FECACA' }, // Red
            'FCG': { bg: '#FFF7ED', border: '#FED7AA' }, // Orange
            'CAMIRAL': { bg: '#F0FDF4', border: '#BBF7D0' }, // Green
            'JUNIOR BABY CUP': { bg: '#F0F9FF', border: '#BAE6FD' }, // Blue
            'LEGACY': { bg: '#EEF2FF', border: '#C7D2FE' }, // Indigo
            'CLUB': { bg: '#F8FAFC', border: '#E2E8F0' } // Slate
        };

        // Priority: Custom User Theme (by ID) -> Custom User Theme (by Organizer/Group) -> Standard Theme
        // We will allow users to override theme by TOURNAMENT ID (safest for specific styling) 
        // OR by Organizer Name (if we want global override).

        // Let's implement Override by Organizer Name first as requested "ficha color... para organizar ellos los colores"
        // And also specific ID if needed? The user request said "cambiar el color de la ficha". 
        // It implies specific tournament OR group. Let's assume specific tournament for maximum power, 
        // OR organizer override.
        // Let's check customThemes (passed as prop) which is map { "OrganizerName/ID": { bg, border } }

        // Check ID specific theme
        if (customThemes && customThemes[t.id]) {
            theme = customThemes[t.id];
        }
        // Check Organizer specific theme
        else if (customThemes && customThemes[t.organizer]) {
            theme = customThemes[t.organizer];
        }
        else if (ORG_THEMES[t.organizer]) {
            theme = ORG_THEMES[t.organizer];
        } else {
            // Hash fallback
            theme = { bg: '#F8F9FA', border: '#DEE2E6' }; // Fallback generic
        }

        let style = {
            borderLeft: `4px solid ${t.valedera ? '#D97706' : theme.border}`,
            background: theme.bg,
            minHeight: '100px', // Uniform height
            opacity: isFinished ? 0.6 : 1,
            filter: isFinished ? 'grayscale(10%)' : 'none',
            position: 'relative'
        };

        if (inProgress) {
            style.border = '2px solid #22c55e'; // Green active border
            style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.3)';
            style.background = '#f0fdf4';
        }

        return style;
    };

    // Color Copy/Paste State
    // const copiedColorRef = useRef(null); // Unused for now as we use localStorage


    const handleCopyColor = (t) => {
        // Find current color
        let theme = null;
        if (customThemes && customThemes[t.id]) theme = customThemes[t.id];
        else if (customThemes && customThemes[t.organizer]) theme = customThemes[t.organizer];
        else {
            // Fallback to standard
            const ORG_THEMES = {
                'RFEG': { bg: '#FEF2F2', border: '#FECACA' },
                'FCG': { bg: '#FFF7ED', border: '#FED7AA' },
                // ... repat logic
                'CLUB': { bg: '#F8FAFC', border: '#E2E8F0' }
            };
            theme = ORG_THEMES[t.organizer] || { bg: '#F8F9FA', border: '#DEE2E6' };
        }

        // Copy to clipboard/memory
        localStorage.setItem('golf_tracker_copied_theme', JSON.stringify(theme));
        setContextMenu(null);
        notify('Color copiado.', 'success');
    };

    const handlePasteColor = (targetT) => {
        try {
            const saved = localStorage.getItem('golf_tracker_copied_theme');
            if (saved) {
                const theme = JSON.parse(saved);
                // Apply ONLY to this specific tournament ID for granular control
                // onUpdateTheme(targetT.id, theme.bg (or border?));
                // We need to pass the whole object { bg, border }
                // But handleUpdateTheme in App.jsx was: handleUpdateTheme(orgName, color) -> { bg: color, border: color }

                // Let's update App.jsx's handleUpdateTheme to handle objects too?
                // Or just patch it here?
                // Wait, App.jsx: [orgName]: { bg: color, border: color }
                // I should improve App.jsx to handle object input.

                // Assuming App.jsx accepts full theme object if I pass it?
                // No, it takes (orgName, color).

                // Let's just use the 'border' color as the main color to pass
                if (onUpdateTheme) {
                    // We really want to pass { bg, border } directly.
                    // But interface is limited. 
                    // Let's assume we update App.jsx later or just pass the border color for now.
                    onUpdateTheme(targetT.id, theme.border);
                }
            }
        } catch (e) { console.error(e); }
        setContextMenu(null);
    };

    // ...

    const renderContextMenu = () => {
        if (!contextMenu) return null;
        console.log('Rendering Context Menu - Version: ExactPositioning-Clamp'); // Debug version
        const menuWidth = 170;
        const menuHeight = 270; // Increased for extra options

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
            <div 
                data-context-menu="true"
                onClick={(e) => e.stopPropagation()}
                style={{
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
                }}
            >
                <button onClick={() => handleEditFromMenu(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#333' }}>
                    <Edit size={16} /> Editar
                </button>
                <button onClick={() => handleDuplicate(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#333' }}>
                    <Copy size={16} /> Duplicar
                </button>
                <button onClick={() => handleReportFromMenu(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: '#fffaf0', border: '1px solid #f1dfaa', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#8a640f', fontWeight: 800 }}>
                    <FileText size={16} /> Abrir informe
                </button>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>

                <button onClick={() => handleCopyColor(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#333' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: 'linear-gradient(45deg, red, blue)' }}></span> Copiar Color
                </button>
                <button onClick={() => handlePasteColor(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', color: '#333' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, border: '1px dashed #333' }}></span> Pegar Color
                </button>

                <div style={{ display: 'flex', gap: '4px', padding: '8px', flexWrap: 'wrap' }}>
                    {/* Quick Color Pickers */}
                    {['#FECACA', '#FED7AA', '#BBF7D0', '#BAE6FD', '#C7D2FE', '#E2E8F0'].map(c => (
                        <div
                            key={c}
                            onClick={() => {
                                if (onUpdateTheme) onUpdateTheme(contextMenu.tournament.id, c);
                                setContextMenu(null);
                            }}
                            style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: '1px solid #ccc' }}
                        />
                    ))}
                </div>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>
                <button onClick={() => handleDeleteFromMenu(contextMenu.tournament)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444', textAlign: 'left' }}>
                    <Trash2 size={16} /> Borrar
                </button>
            </div>,
            document.body
        );
    };

    const renderFeedbackUi = () => ReactDOM.createPortal(
        <>
            {notification && (
                <div
                    role="status"
                    style={{
                        position: 'fixed',
                        left: '50%',
                        bottom: '22px',
                        transform: 'translateX(-50%)',
                        zIndex: 10020,
                        maxWidth: 'min(520px, calc(100vw - 32px))',
                        padding: '12px 16px',
                        borderRadius: '999px',
                        color: notification.type === 'error' ? '#7f1d1d' : notification.type === 'warning' ? '#78350f' : '#064e3b',
                        background: notification.type === 'error' ? '#fee2e2' : notification.type === 'warning' ? '#fef3c7' : '#dcfce7',
                        border: notification.type === 'error' ? '1px solid #fecaca' : notification.type === 'warning' ? '1px solid #fde68a' : '1px solid #bbf7d0',
                        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
                        fontWeight: '800',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                    }}
                >
                    {notification.message}
                </div>
            )}
            {confirmDialog && (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10010,
                        background: 'rgba(15, 23, 42, 0.48)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                    onClick={() => resolveConfirm(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(440px, 100%)',
                            background: 'white',
                            borderRadius: '18px',
                            padding: '22px',
                            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.32)',
                            border: '1px solid #e2e8f0'
                        }}
                    >
                        <h3 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: '1.15rem' }}>
                            {confirmDialog.title}
                        </h3>
                        <p style={{ margin: '0 0 20px', color: '#64748b', lineHeight: 1.5, fontWeight: '600' }}>
                            {confirmDialog.message}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => resolveConfirm(false)}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '999px',
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    color: '#334155',
                                    fontWeight: '900',
                                    cursor: 'pointer'
                                }}
                            >
                                {confirmDialog.cancelText}
                            </button>
                            <button
                                type="button"
                                onClick={() => resolveConfirm(true)}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '999px',
                                    border: 'none',
                                    background: confirmDialog.danger ? '#dc2626' : 'var(--color-primary)',
                                    color: 'white',
                                    fontWeight: '900',
                                    cursor: 'pointer'
                                }}
                            >
                                {confirmDialog.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>,
        document.body
    );

    // ...

    const renderTournamentCard = (t) => {
        const { start, end } = parseDateHelper(t.dates);
        const todayTime = new Date().setHours(0, 0, 0, 0);
        const inProgress = start <= todayTime && todayTime <= end;
        const isFinished = end < todayTime;

        return (
            <div
                key={t.id}
                onClick={() => handleTournamentClick(t)}
                className="tournament-card"
                style={getCardStyle(t)}
                // ... handlers
                onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        tournament: t
                    });
                }}
                onTouchStart={() => handleTouchStart(t)}
                onTouchEnd={handleTouchEnd}
            >
                <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                        <div />
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {inProgress && (
                                <span className="badge" style={{ background: '#22c55e', color: 'white', animation: 'pulse 2s infinite' }}>
                                    EN JUEGO
                                </span>
                            )}
                            {t.conflict && (
                                <span className="badge" style={{ background: '#ef4444', color: 'white' }} title="Conflicto de fechas">
                                    !
                                </span>
                            )}
                            {/* Other badges (Valedera icon etc) if needed, but we rely on border/color mostly */}
                        </div>
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', lineHeight: '1.3', color: 'var(--color-primary)' }}>{t.name}</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} />
                            <span>{t.dates}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{t.course}</span>
                        </div>
                    </div>
                </div>

                {results[t.id] && (
                    <div style={{
                        borderTop: '1px solid rgba(0,0,0,0.05)',
                        padding: '8px 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.5)'
                    }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                            {results[t.id].total > 0 ? `${results[t.id].total} Golpes` : 'Sin Resultado'}
                        </span>
                        {results[t.id].stablefordTotal > 0 &&
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>{results[t.id].stablefordTotal} pts</span>
                        }
                    </div>
                )}
            </div>
        );
    };

    // The original renderResultRow is replaced by renderTournamentCard,
    // and the usage of getFilteredTournaments and getCardStyle is updated.
    // The rest of the file should adapt to use filteredTournaments and renderTournamentCard.
    // For example, where you had:
    // {sortedTournaments.map(t => renderResultRow(t))}
    // you would now have:
    // {Object.entries(groupedTournaments).map(([monthYear, tournamentsInMonth]) => (
    //     <div key={monthYear}>
    //         <h3 className="month-header">{monthYear}</h3>
    //         {tournamentsInMonth.map(t => renderTournamentCard(t))}
    //     </div>
    // ))}
    // This is outside the scope of the provided snippet, but important for context.

    // The original getFilteredTournaments and getCardStyle are fully replaced.
    // The original renderResultRow is removed as renderTournamentCard is introduced.
    // The original code for getFilteredTournaments and getCardStyle is removed.
    // The original code for renderResultRow is removed.
    // The new code for getFilteredTournaments, parseDateHelper, filteredTournaments,
    // groupedTournaments, getCardStyle, and renderTournamentCard is inserted.

    // The original code for getFilteredTournaments was:


    // Sort by date: results mode often wants LATEST first (DESC), calendar wants CHRONOLOGICAL (ASC)
    const sortedTournaments = getFilteredTournaments().sort((a, b) => {
        const da = parseDate(a.dates);
        const db = parseDate(b.dates);
        return viewMode === 'results' ? db - da : da - db;
    });



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
                    data-context-menu-trigger="true"
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
            </div >
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
                        {/* Rounds Detail (Integrated) */}
                        {(() => {
                            const r = results[t.id];
                            const validRounds = (r.rounds || []).map((val, i) => ({ score: parseInt(val) || 0, idx: i + 1 })).filter(item => item.score > 0);

                            if (validRounds.length > 1) {
                                return validRounds.map((item) => (
                                    <div key={item.idx}>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>RONDA {item.idx}</span>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{item.score}</span>
                                    </div>
                                ));
                            }
                            return null;
                        })()}

                        {results[t.id].total > 0 && (
                            <div>
                                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>TOTAL</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{results[t.id].total}</span>
                                    {(() => {
                                        const r = results[t.id];
                                        const validRoundsCount = (r.rounds || []).filter(v => (parseInt(v) || 0) > 0).length;

                                        let basePar = getTournamentPar(t, results[t.id], spanishCourses);
                                        let totalPar = basePar;

                                        if (validRoundsCount > 1 && basePar < 100) {
                                            totalPar = basePar * validRoundsCount;
                                        }

                                        const diff = results[t.id].total - totalPar;
                                        const finalDiff = results[t.id].total - totalPar;

                                        const diffStr = finalDiff > 0 ? `(+${finalDiff})` : finalDiff < 0 ? `(${finalDiff})` : '(E)';
                                        const color = finalDiff > 0 ? '#ef4444' : finalDiff < 0 ? '#22c55e' : '#64748b';
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
                            aria-label={isEditing ? 'Cancelar edición' : 'Editar torneo'}
                            title={isEditing ? 'Cancelar edición' : 'Editar torneo'}
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
                                aria-label="Borrar torneo"
                                title="Borrar torneo"
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
                            {t.sace && (
                                <span className="badge" style={{ backgroundColor: '#2563eb', color: 'white', marginLeft: '0.5rem' }}>
                                    SACE
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
                            {(() => {
                                const dateInfo = parseDateHelper(t.dates);
                                const start = dateInfo.start;
                                const end = dateInfo.end;
                                const todayTime = new Date().setHours(0, 0, 0, 0);
                                const inProgress = start <= todayTime && todayTime <= end;
                                const isFinished = end < todayTime;

                                if (!isFinished && inProgress) {
                                    return (
                                        <span className="badge" style={{ backgroundColor: '#22c55e', color: 'white', marginLeft: '0.5rem', animation: 'pulse 2s infinite' }}>
                                            EN JUEGO
                                        </span>
                                    );
                                }
                                return null;
                            })()}
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

                            {/* Dates Edit (Calendar Picker) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Fechas</label>
                                {(() => {
                                    // Parse current dates string to YYYY-MM-DD for inputs
                                    const parts = (editingDetails.dates || '').split(' - ');

                                    const toInputFormat = (dStr) => {
                                        if (!dStr) return '';
                                        const [d, m, y] = dStr.split('/');
                                        if (!d || !m || !y) return '';
                                        return `${y}-${m}-${d}`; // YYYY-MM-DD
                                    };

                                    const startVal = parts[0] ? toInputFormat(parts[0]) : '';
                                    const endVal = parts[1] ? toInputFormat(parts[1]) : '';

                                    const isMulti = parts.length > 1;

                                    const updateDates = (newStart, newEnd) => {
                                        const formatDate = (isoDate) => {
                                            if (!isoDate) return '';
                                            const [y, m, d] = isoDate.split('-');
                                            return `${d}/${m}/${y}`;
                                        };

                                        const s = formatDate(newStart || startVal);
                                        const e = formatDate(newEnd !== undefined ? newEnd : (isMulti ? endVal : '')); // Keep end if not changing mode

                                        let result = s;
                                        if (e && e !== s) {
                                            result = `${s} - ${e}`;
                                        }
                                        handleDetailChange('dates', result);
                                    };

                                    return (
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <input
                                                    type="date"
                                                    value={startVal}
                                                    onChange={(e) => updateDates(e.target.value, undefined)}
                                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                                />
                                            </div>

                                            {/* Toggle Multi-day */}
                                            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '10px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isMulti}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            // Enable multi: default end date to start date + 1 day? Or just start date
                                                            // Let's just default end to start if empty
                                                            updateDates(startVal, startVal);
                                                        } else {
                                                            // Disable multi: clear end date
                                                            updateDates(startVal, '');
                                                        }
                                                    }}
                                                    title="Multidía"
                                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                />
                                            </div>

                                            {isMulti && (
                                                <div style={{ flex: 1 }}>
                                                    <input
                                                        type="date"
                                                        value={endVal}
                                                        min={startVal}
                                                        onChange={(e) => updateDates(undefined, e.target.value)}
                                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
                                        <option value="JUNIOR BABY Cup">JUNIOR BABY CUP</option>
                                        <option value="Circuito Amateur">Circuito Amateur</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontSize: '0.8rem', color: '#888' }}>Hora de Salida</label>
                                    <input
                                        type="time"
                                        value={editingDetails.tee_time || ''}
                                        onChange={(e) => handleDetailChange('tee_time', e.target.value)}
                                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                    />
                                </div>
                            </div>

                            {/* Objetivo (Target Score) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Objetivo (Golpes respecto al par, ej: 7 para +7)</label>
                                <input
                                    type="number"
                                    value={editingDetails.target_score !== undefined && editingDetails.target_score !== null ? editingDetails.target_score : ''}
                                    onChange={(e) => handleDetailChange('target_score', e.target.value === '' ? null : parseInt(e.target.value))}
                                    placeholder="Ej: 7"
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                                />
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
                                            checked={editingDetails.sace || false}
                                            onChange={(e) => handleDetailChange('sace', e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <span style={{ fontSize: '0.9rem' }}>SACE</span>
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
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#f0fdf4', padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                        <input
                                            type="checkbox"
                                            checked={editingDetails.track_putts || false}
                                            onChange={(e) => handleDetailChange('track_putts', e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#166534' }}>Putts</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#eff6ff', padding: '8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                        <input
                                            type="checkbox"
                                            checked={editingDetails.track_girs || false}
                                            onChange={(e) => handleDetailChange('track_girs', e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e40af' }}>GIR</span>
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
                                    <option value="club">Club</option>
                                    <option value="juvenil">Circuito Juvenil</option>
                                    <option value="rfeg">RFEG</option>
                                    <option value="fcg">FCG</option>
                                    <option value="adultos">Circuitos Adultos</option>
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

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '1.5rem' }}>

                                    {/* ROW 1: Name */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#666', fontWeight: '500' }}>Nombre del Torneo</label>
                                        <input
                                            type="text"
                                            value={editingDetails.name || ''}
                                            onChange={(e) => handleDetailChange('name', e.target.value)}
                                            style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%', background: '#f8fafc' }}
                                        />
                                    </div>

                                    {/* ROW 2: Dates */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#666', fontWeight: '500' }}>Fechas</label>
                                        {(() => {
                                            const parts = (editingDetails.dates || '').split(' - ');
                                            const toInputFormat = (dStr) => {
                                                if (!dStr) return '';
                                                const [d, m, y] = dStr.split('/');
                                                if (!d || !m || !y) return '';
                                                return `${y}-${m}-${d}`;
                                            };
                                            const startVal = parts[0] ? toInputFormat(parts[0]) : '';
                                            const endVal = parts[1] ? toInputFormat(parts[1]) : '';
                                            const isMulti = parts.length > 1;

                                            const updateDates = (newStart, newEnd) => {
                                                const formatDate = (isoDate) => {
                                                    if (!isoDate) return '';
                                                    const [y, m, d] = isoDate.split('-');
                                                    return `${d}/${m}/${y}`;
                                                };
                                                const s = formatDate(newStart || startVal);
                                                const e = formatDate(newEnd !== undefined ? newEnd : (isMulti ? endVal : ''));
                                                let result = s;
                                                if (e) result = `${s} - ${e}`;
                                                handleDetailChange('dates', result);
                                            };

                                            return (
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <div style={{ width: '200px' }}>
                                                        <input
                                                            type="date"
                                                            value={startVal}
                                                            onChange={(e) => updateDates(e.target.value, undefined)}
                                                            style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', cursor: 'pointer' }}
                                                        />
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                                                        <input
                                                            id="multiDayCheck"
                                                            type="checkbox"
                                                            checked={isMulti}
                                                            onChange={(e) => e.target.checked ? updateDates(startVal, startVal) : updateDates(startVal, '')}
                                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                        />
                                                        <label htmlFor="multiDayCheck" style={{ fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>Multidía</label>
                                                    </div>

                                                    {isMulti && (
                                                        <div style={{ width: '200px', animation: 'fadeIn 0.3s ease' }}>
                                                            <input
                                                                type="date"
                                                                value={endVal}
                                                                min={startVal}
                                                                onChange={(e) => updateDates(undefined, e.target.value)}
                                                                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', cursor: 'pointer' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* ROW 3: Par & Organizer Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                        {/* Par */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.85rem', color: '#666', fontWeight: '500' }}>Par del Campo</label>
                                            <input
                                                type="number"
                                                value={editingDetails.par || 72}
                                                onChange={(e) => handleDetailChange('par', parseInt(e.target.value) || 72)}
                                                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%' }}
                                            />
                                        </div>

                                        {/* Organizer */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.85rem', color: '#666', fontWeight: '500' }}>Organizador</label>
                                            <select
                                                value={editingDetails.organizer || 'CLUB'}
                                                onChange={(e) => handleDetailChange('organizer', e.target.value)}
                                                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%', background: 'white' }}
                                            >
                                                <option value="CLUB">CLUB (Genérico)</option>
                                                <option value="RFEG">RFEG</option>
                                                <option value="FCG">FCG</option>
                                                <option value="CAMIRAL">CAMIRAL</option>
                                                <option value="LEGACY">LEGACY</option>
                                                <option value="JUNIOR BABY CUP">JUNIOR BABY CUP</option>
                                                <option value="Circuito Amateur">Circuito Amateur</option>
                                            </select>
                                        </div>
                                    </div>
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
                                                checked={editingDetails.sace || false}
                                                onChange={(e) => handleDetailChange('sace', e.target.checked)}
                                                style={{ width: '16px', height: '16px' }}
                                            />
                                            <span style={{ fontSize: '0.85rem' }}>SACE</span>
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
                                        <option value="juvenil">Circuito Juvenil</option>
                                        <option value="rfeg">RFEG</option>
                                        <option value="fcg">FCG</option>
                                        <option value="adultos">Circuitos Adultos</option>
                                    </select>
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

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                                gap: '10px',
                                marginBottom: '20px'
                            }}>
                                {[
                                    { id: 'results', label: 'Mis resultados', icon: '📝' },
                                    ...(isSharedTournamentId(selectedTournament.id) ? [{ id: 'leaderboard', label: 'Clasificación', icon: '🏆' }] : []),
                                    { id: 'report', label: 'Informe PDF', icon: '📄', featured: true },
                                ].map((tab) => {
                                    const active = detailTab === tab.id;
                                    const featured = tab.featured;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setDetailTab(tab.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                minHeight: '44px',
                                                padding: '10px 12px',
                                                borderRadius: '12px',
                                                border: active
                                                    ? (featured ? '2px solid #c9a45d' : '2px solid var(--color-primary)')
                                                    : (featured ? '1px solid #e7c978' : '1px solid #e2e8f0'),
                                                background: active
                                                    ? (featured ? 'linear-gradient(135deg, #fff7df, #f8e7b2)' : 'var(--color-primary)')
                                                    : (featured ? '#fffaf0' : 'white'),
                                                color: active
                                                    ? (featured ? '#6b4e0d' : 'white')
                                                    : (featured ? '#8a640f' : '#475569'),
                                                fontWeight: '900',
                                                fontSize: '0.86rem',
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer',
                                                boxShadow: featured ? '0 8px 18px rgba(201, 164, 93, 0.16)' : 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <span aria-hidden="true">{tab.icon}</span>
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {detailTab === 'results' && (
                                <>
                                    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--color-primary)' }}>Introducir Resultados</h2>
                                    </div>

                            {/* Datos Extra / Stats Setup */}
                            <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '10px' }}>Estadísticas Adicionales a Contabilizar:</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', transition: 'all 0.2s' }}>
                                        <input
                                            type="checkbox"
                                            checked={editingDetails.track_putts || false}
                                            onChange={(e) => handleDetailChange('track_putts', e.target.checked)}
                                            style={{ width: '20px', height: '20px' }}
                                        />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#166534' }}>Track Putts</span>
                                    </label>
                                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', transition: 'all 0.2s' }}>
                                        <input
                                            type="checkbox"
                                            checked={editingDetails.track_girs || false}
                                            onChange={(e) => handleDetailChange('track_girs', e.target.checked)}
                                            style={{ width: '20px', height: '20px' }}
                                        />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#1e40af' }}>Track GIR</span>
                                    </label>
                                </div>
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
                                                <input
                                                    type="number"
                                                    placeholder="Putts"
                                                    value={formData.totalPutts?.[idx] || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFormData(prev => {
                                                            const newPutts = [...(prev.totalPutts || [])];
                                                            newPutts[idx] = val;
                                                            return { ...prev, totalPutts: newPutts };
                                                        });
                                                    }}
                                                    style={{ width: '60px', padding: '8px', fontSize: '1rem', textAlign: 'center', borderRadius: '6px', border: '1px solid #ccc', background: '#f0fdf4', color: '#059669', fontWeight: 'bold' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Toggle Detailed Scorecard */}
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                            <button
                                                onClick={() => setExpandedRound(expandedRound === idx ? null : idx)}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px',
                                                    background: expandedRound === idx ? '#e2e8f0' : '#f8fafc',
                                                    border: '1px dashed #cbd5e1',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    color: 'var(--color-text-muted)'
                                                }}
                                            >
                                                {expandedRound === idx ? 'Ocultar Tarjeta' : 'Ver Tarjeta Clásica'}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    console.log('📱 Abriendo modo móvil para tarjeta:', idx);
                                                    setIsEditingResults(true); // Track edit mode

                                                    // Robustly ensure card entry exists
                                                    setFormData(prev => {
                                                        const currentSc = prev.scorecards || {};

                                                        // Check if we need to initialize this specific card
                                                        if (!currentSc[idx] || (typeof currentSc[idx] === 'object' && Object.keys(currentSc[idx]).length === 0)) {
                                                            const newSc = { ...currentSc };
                                                            newSc[idx] = {
                                                                pars: currentSc[idx]?.pars || Array(18).fill(''),
                                                                strokes: currentSc[idx]?.strokes || Array(18).fill(''),
                                                                putts: currentSc[idx]?.putts || Array(18).fill(''),
                                                                girs: currentSc[idx]?.girs || Array(18).fill('')
                                                            };
                                                            return { ...prev, scorecards: newSc };
                                                        }

                                                        return prev;
                                                    });

                                                    setMobileMode({ cardIdx: idx, holeIdx: 0 });
                                                }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px',
                                                    background: '#0f172a',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    fontWeight: 'bold',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                <span>📱</span> Introducir resultado
                                            </button>
                                        </div>

                                        {/* Social and Live Action Buttons */}
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: expandedRound === idx ? '1rem' : '0' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleShareCard(idx);
                                                }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px',
                                                    background: '#f0fdf4',
                                                    border: '1px solid #10b981',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    color: '#10b981',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    fontWeight: 'bold',
                                                }}
                                            >
                                                <Share2 size={14} /> Compartir tarjeta
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    const link = `${window.location.origin}/live/${user?.username}/${t.id}?r=${idx}`;
                                                    const shareTitle = `${user?.full_name || user?.username} - ${selectedTournament?.name || t.name}`;
                                                    const fullMessage = `⛳ Sigue la vuelta de ${user?.full_name || user?.username}\n\n🏆 ${selectedTournament?.name || t.name}\n📍 ${selectedTournament?.location || selectedTournament?.course || t.location || t.course || ''}\n\n🔴 EN DIRECTO\n\n👉 ${link}`;

                                                    if (navigator.share) {
                                                        try {
                                                            await navigator.share({
                                                                text: fullMessage
                                                            });
                                                        } catch (err) {
                                                            console.log('Error sharing:', err);
                                                        }
                                                    } else {
                                                        await copyToClipboard(fullMessage, 'Enlace en vivo copiado al portapapeles.');
                                                    }
                                                }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px',
                                                    background: '#eff6ff',
                                                    border: '1px solid #3b82f6',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    color: '#3b82f6',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    fontWeight: 'bold',
                                                }}
                                                title="Compartir enlace para seguir resultados en directo"
                                            >
                                                <Radio size={14} className="pulse-animation" /> Resultados en Vivo
                                            </button>

                                            {/* Conditionally show MULTI-LIVE button if the user manages other players or is in a team context */}
                                            {((user?.managed_users && user.managed_users.length > 0) || managedUsers.length > 1) && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        const players = managedUsers.length > 0 ? managedUsers.join(',') : [user?.username, ...(user?.managed_users || [])].filter(Boolean).join(',');
                                                        const link = `${window.location.origin}/live-team/${t.id}?players=${players}&r=${idx}`;
                                                        const shareTitle = `Equipo ${user?.full_name || user?.username} - ${selectedTournament?.name || t.name}`;
                                                        const fullMessage = `⛳ Sigue las vueltas del equipo en vivo\n\n🏆 ${selectedTournament?.name || t.name}\n📍 ${selectedTournament?.location || selectedTournament?.course || t.location || t.course || ''}\n👥 Múltiples jugadores\n\n🔴 EN DIRECTO\n\n👉 ${link}`;

                                                        if (navigator.share) {
                                                            try {
                                                                await navigator.share({
                                                                    text: fullMessage
                                                                });
                                                            } catch (err) {
                                                                console.log('Error sharing:', err);
                                                            }
                                                        } else {
                                                            await copyToClipboard(fullMessage, 'Enlace multi-live copiado al portapapeles.');
                                                        }
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px',
                                                        background: '#fdf4ff',
                                                        border: '1px solid #d946ef',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem',
                                                        color: '#d946ef',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                        fontWeight: 'bold',
                                                    }}
                                                    title="Compartir enlace para ver la tarjeta del equipo (Padre + Hijas)"
                                                >
                                                    <Users size={14} className="pulse-animation" /> Team Live
                                                </button>
                                            )}
                                        </div>

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
                                                    {[...Array(9)].map((_, i) => {
                                                        const strokeVal = (formData.scorecards[idx]?.strokes || [])[i];
                                                        const parVal = (formData.scorecards[idx]?.pars || [])[i];
                                                        let bg = '#fffbeb';
                                                        let color = 'inherit';

                                                        if (strokeVal && parVal) {
                                                            const s = parseInt(strokeVal);
                                                            const p = parseInt(parVal);
                                                            if (!isNaN(s) && !isNaN(p)) {
                                                                if (s < p) { bg = '#dcfce7'; color = '#15803d'; }
                                                                else if (s > p) { bg = '#fee2e2'; color = '#b91c1c'; }
                                                            }
                                                        }

                                                        return (
                                                            <input
                                                                key={`stroke-${i}`}
                                                                type="number"
                                                                placeholder="-"
                                                                value={String(strokeVal || '')}
                                                                onChange={(e) => handleHoleChange(idx, i, 'strokes', e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '2px',
                                                                    textAlign: 'center',
                                                                    fontSize: '0.8rem',
                                                                    border: '1px solid #ddd',
                                                                    backgroundColor: bg,
                                                                    color: color,
                                                                    fontWeight: color !== 'inherit' ? 'bold' : 'normal'
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center' }}>
                                                        {(formData.scorecards[idx]?.strokes || []).slice(0, 9).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                    </div>

                                                    {/* Putts Row */}
                                                    {editingDetails.track_putts && (
                                                        <>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', alignSelf: 'center', color: '#059669' }}>Putts</div>
                                                            {[...Array(9)].map((_, i) => (
                                                                <input
                                                                    key={`putt-${i}`}
                                                                    type="number"
                                                                    placeholder="-"
                                                                    value={String((formData.scorecards[idx]?.putts || [])[i] || '')}
                                                                    onChange={(e) => handleHoleChange(idx, i, 'putts', e.target.value)}
                                                                    style={{ width: '100%', padding: '2px', textAlign: 'center', fontSize: '0.8rem', border: '1px solid #ddd', backgroundColor: '#f0fdf4' }}
                                                                />
                                                            ))}
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center', color: '#059669' }}>
                                                                {(formData.scorecards[idx]?.putts || []).slice(0, 9).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* GIR Row */}
                                                    {editingDetails.track_girs && (
                                                        <>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', alignSelf: 'center', color: '#2563eb' }}>GIR</div>
                                                            {[...Array(9)].map((_, i) => (
                                                                <input
                                                                    key={`gir-${i}`}
                                                                    type="text"
                                                                    maxLength={3}
                                                                    placeholder="-"
                                                                    value={(formData.scorecards[idx]?.girs || [])[i] || ''}
                                                                    onChange={(e) => handleHoleChange(idx, i, 'girs', e.target.value)}
                                                                    style={{ width: '100%', padding: '2px', textAlign: 'center', fontSize: '0.8rem', border: '1px solid #ddd', backgroundColor: '#eff6ff' }}
                                                                />
                                                            ))}
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center', color: '#2563eb' }}>-</div>
                                                        </>
                                                    )}
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
                                                            value={String((formData.scorecards[idx]?.pars || [])[i + 9] || '')}
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
                                                    {[...Array(9)].map((_, i) => {
                                                        const strokeVal = (formData.scorecards[idx]?.strokes || [])[i + 9];
                                                        const parVal = (formData.scorecards[idx]?.pars || [])[i + 9];
                                                        let bg = '#fffbeb';
                                                        let color = 'inherit';

                                                        if (strokeVal && parVal) {
                                                            const s = parseInt(strokeVal);
                                                            const p = parseInt(parVal);
                                                            if (!isNaN(s) && !isNaN(p)) {
                                                                if (s < p) { bg = '#dcfce7'; color = '#15803d'; }
                                                                else if (s > p) { bg = '#fee2e2'; color = '#b91c1c'; }
                                                            }
                                                        }

                                                        return (
                                                            <input
                                                                key={`stroke-${i + 9}`}
                                                                type="number"
                                                                placeholder="-"
                                                                value={String(strokeVal || '')}
                                                                onChange={(e) => handleHoleChange(idx, i + 9, 'strokes', e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '2px',
                                                                    textAlign: 'center',
                                                                    fontSize: '0.8rem',
                                                                    border: '1px solid #ddd',
                                                                    backgroundColor: bg,
                                                                    color: color,
                                                                    fontWeight: color !== 'inherit' ? 'bold' : 'normal'
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center' }}>
                                                        {(formData.scorecards[idx]?.strokes || []).slice(9, 18).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                    </div>

                                                    {/* Putts Row */}
                                                    {editingDetails.track_putts && (
                                                        <>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', alignSelf: 'center', color: '#059669' }}>Putts</div>
                                                            {[...Array(9)].map((_, i) => (
                                                                <input
                                                                    key={`putt-${i + 9}`}
                                                                    type="number"
                                                                    placeholder="-"
                                                                    value={String((formData.scorecards[idx]?.putts || [])[i + 9] || '')}
                                                                    onChange={(e) => handleHoleChange(idx, i + 9, 'putts', e.target.value)}
                                                                    style={{ width: '100%', padding: '2px', textAlign: 'center', fontSize: '0.8rem', border: '1px solid #ddd', backgroundColor: '#f0fdf4' }}
                                                                />
                                                            ))}
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center', color: '#059669' }}>
                                                                {(formData.scorecards[idx]?.putts || []).slice(9, 18).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* GIR Row */}
                                                    {editingDetails.track_girs && (
                                                        <>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', alignSelf: 'center', color: '#2563eb' }}>GIR</div>
                                                            {[...Array(9)].map((_, i) => (
                                                                <input
                                                                    key={`gir-${i + 9}`}
                                                                    type="text"
                                                                    maxLength={3}
                                                                    placeholder="-"
                                                                    value={(formData.scorecards[idx]?.girs || [])[i + 9] || ''}
                                                                    onChange={(e) => handleHoleChange(idx, i + 9, 'girs', e.target.value)}
                                                                    style={{ width: '100%', padding: '2px', textAlign: 'center', fontSize: '0.8rem', border: '1px solid #ddd', backgroundColor: '#eff6ff' }}
                                                                />
                                                            ))}
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', alignSelf: 'center', color: '#2563eb' }}>-</div>
                                                        </>
                                                    )}

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
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}
                                                    >
                                                        <Trash2 size={12} style={{ marginRight: '4px' }} />
                                                        Resetear
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
                                            <h2 style={{ fontSize: '28px', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{editingDetails.name || selectedTournament?.name}</h2>
                                            <p style={{ opacity: 0.9, fontSize: '18px', fontWeight: 'bold' }}>{editingDetails.course || selectedTournament?.course}</p>
                                            <p style={{ opacity: 0.8, fontSize: '16px', marginTop: '5px' }}>{getRoundDates(editingDetails.dates || selectedTournament?.dates)[sharingRound]?.toLocaleDateString()}</p>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '30px' }}>
                                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '12px', width: '150px' }}>
                                                <div style={{ fontSize: '14px', textTransform: 'uppercase', opacity: 0.8 }}>Golpes</div>
                                                <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{formData.rounds[sharingRound]}</div>
                                            </div>
                                            {Number(formData.stableford?.[sharingRound]) > 0 && (
                                                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.9)', color: '#064e3b', padding: '20px', borderRadius: '12px', width: '150px' }}>
                                                    <div style={{ fontSize: '14px', textTransform: 'uppercase', fontWeight: 'bold' }}>Stableford</div>
                                                    <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{formData.stableford[sharingRound]}</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Scorecard Grid for Image */}
                                        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', color: '#333' }}>
                                            {/* Front 9 */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(9, 1fr) 50px', gap: '4px', marginBottom: '15px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center' }}>HOYO</div>
                                                {[...Array(9)].map((_, i) => <div key={i} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{i + 1}</div>)}
                                                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>IDA</div>

                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center', color: '#666' }}>PAR</div>
                                                {[...Array(9)].map((_, i) => <div key={i} style={{ textAlign: 'center', fontSize: '14px' }}>{(formData.scorecards[sharingRound]?.pars || [])[i] || '-'}</div>)}
                                                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {(formData.scorecards[sharingRound]?.pars || []).slice(0, 9).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                </div>

                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center' }}>GOLPE</div>
                                                {[...Array(9)].map((_, i) => {
                                                    const par = parseInt((formData.scorecards[sharingRound]?.pars || [])[i]);
                                                    const str = parseInt((formData.scorecards[sharingRound]?.strokes || [])[i]);
                                                    let bg = '#f3f4f6';
                                                    let color = '#333';
                                                    if (par && str) {
                                                        const diff = str - par;
                                                        color = 'white';
                                                        if (diff <= -2) bg = '#eab308';
                                                        else if (diff === -1) bg = '#10b981';
                                                        else if (diff === 0) bg = '#3b82f6';
                                                        else if (diff === 1) bg = '#f97316';
                                                        else if (diff === 2) bg = '#ef4444';
                                                        else bg = '#000000';
                                                    }
                                                    return (
                                                        <div key={i} style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', background: bg, color: color, borderRadius: '4px', padding: '2px 0' }}>
                                                            {str || '-'}
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {(formData.scorecards[sharingRound]?.strokes || []).slice(0, 9).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                </div>
                                            </div>

                                            {/* Back 9 */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(9, 1fr) 50px', gap: '4px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center' }}>HOYO</div>
                                                {[...Array(9)].map((_, i) => <div key={i + 9} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{i + 10}</div>)}
                                                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>VTA</div>

                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center', color: '#666' }}>PAR</div>
                                                {[...Array(9)].map((_, i) => <div key={i + 9} style={{ textAlign: 'center', fontSize: '14px' }}>{(formData.scorecards[sharingRound]?.pars || [])[i + 9] || '-'}</div>)}
                                                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {(formData.scorecards[sharingRound]?.pars || []).slice(9, 18).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
                                                </div>

                                                <div style={{ fontWeight: 'bold', fontSize: '12px', alignSelf: 'center' }}>GOLPE</div>
                                                {[...Array(9)].map((_, i) => {
                                                    const par = parseInt((formData.scorecards[sharingRound]?.pars || [])[i + 9]);
                                                    const str = parseInt((formData.scorecards[sharingRound]?.strokes || [])[i + 9]);
                                                    let bg = '#f3f4f6';
                                                    let color = '#333';
                                                    if (par && str) {
                                                        const diff = str - par;
                                                        color = 'white';
                                                        if (diff <= -2) bg = '#eab308';
                                                        else if (diff === -1) bg = '#10b981';
                                                        else if (diff === 0) bg = '#3b82f6';
                                                        else if (diff === 1) bg = '#f97316';
                                                        else if (diff === 2) bg = '#ef4444';
                                                        else bg = '#000000';
                                                    }
                                                    return (
                                                        <div key={i + 9} style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', background: bg, color: color, borderRadius: '4px', padding: '2px 0' }}>
                                                            {str || '-'}
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {(formData.scorecards[sharingRound]?.strokes || []).slice(9, 18).reduce((a, b) => a + (Number(b) || 0), 0) || '-'}
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
                                        onChange={(e) => {
                                            setIsEditingResults(true);
                                            setFormData(prev => ({ ...prev, position: e.target.value }));
                                        }}
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
                                        onChange={(e) => {
                                            setIsEditingResults(true);
                                            setFormData(prev => ({ ...prev, handicap: e.target.value }));
                                        }}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                                    />
                                </div>
                            </div>

                            {/* Tag Toggles */}


                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {results[t.id] && (
                                    <button className="btn" style={{ flex: 1, color: '#ef4444', border: '1px solid #ef4444' }} onClick={handleDeleteResult}>
                                        <Trash2 size={18} style={{ marginRight: '8px' }} /> Borrar Resultados
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                    {detailTab === 'leaderboard' && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                                <button
                                    onClick={() => {
                                        const base = window.location.origin + (import.meta.env.BASE_URL.replace(/\/$/, ''));
                                        const liveUsername = encodeURIComponent(user?.username || 'ona');
                                        const shareLink = `${base}/live/${liveUsername}/${selectedTournament.id}?r=0`;
                                        
                                        if (navigator.share) {
                                            navigator.share({
                                                title: `Clasificación: ${selectedTournament.name}`,
                                                text: `Sigue la clasificación en tiempo real del torneo ${selectedTournament.name} aquí:`,
                                                url: shareLink
                                            }).catch(console.error);
                                        } else {
                                            navigator.clipboard?.writeText(shareLink).catch(console.warn);
                                            console.info('[leaderboard] Link copied:', shareLink);
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        background: '#fffbeb',
                                        border: '1px solid #f59e0b',
                                        borderRadius: '30px',
                                        color: '#b45309',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(245, 158, 11, 0.1)'
                                    }}
                                >
                                    <Share2 size={14} /> Compartir Clasificación Pública
                                </button>
                            </div>
                            <TournamentLeaderboard
                                tournamentId={String(selectedTournament.id)}
                                par={getTournamentPar(selectedTournament, results[selectedTournament.id], spanishCourses)}
                                currentUsername={user?.username}
                            />
                        </>
                    )}
                    {detailTab === 'report' && (
                        <TournamentReport
                            tournament={selectedTournament}
                            result={formData}
                            user={user}
                        />
                    )}
                        </div>
                    ) : (
                        /* Read Only View (Results Tab) */
                        renderSummaryCard()
                    )}
                </div>

                {/* Mobile Scorecard Overlay - FIXED: Moved inside early return block */}
                {mobileMode && ReactDOM.createPortal(
                    <MobileScorecardEditor
                        card={formData.scorecards?.[mobileMode.cardIdx] || { strokes: [], putts: [], girs: [], pars: [] }}
                        holeIdx={mobileMode.holeIdx}
                        par={(formData.scorecards?.[mobileMode.cardIdx]?.pars || [])[mobileMode.holeIdx] || 72 / 18}
                        allScorecards={formData.scorecards || {}}
                        currentRoundIdx={mobileMode.cardIdx}
                        targetScore={editingDetails.target_score !== undefined ? editingDetails.target_score : (t?.target_score ?? null)}
                        courseName={t?.course || 'Campo de Golf'}
                        config={{
                            track_putts: editingDetails.track_putts === true,
                            track_girs: editingDetails.track_girs === true
                        }}
                        onUpdate={(hIdx, field, val) => handleHoleChange(mobileMode.cardIdx, hIdx, field, val)}
                        onJumpToHole={(hIdx) => {
                            const lastStroke = formData.scorecards?.[mobileMode.cardIdx]?.strokes?.[mobileMode.holeIdx];
                            if (lastStroke) handleSaveResults();
                            setMobileMode(prev => ({ ...prev, holeIdx: hIdx }));
                        }}
                        onClose={() => {
                            const lastStroke = formData.scorecards?.[mobileMode.cardIdx]?.strokes?.[mobileMode.holeIdx];
                            if (lastStroke) {
                                handleSaveResults();
                            }
                            closeMobileMode();
                        }}
                        onNext={() => {
                            const lastStroke = formData.scorecards?.[mobileMode.cardIdx]?.strokes?.[mobileMode.holeIdx];
                            if (lastStroke) {
                                handleSaveResults(); // auto-guardar si hay score
                            }
                            const nextHole = mobileMode.holeIdx + 1;
                            if (nextHole < 18) setMobileMode(prev => ({ ...prev, holeIdx: nextHole }));
                            else {
                                closeMobileMode();
                            }
                        }}
                        onPrev={() => {
                            const lastStroke = formData.scorecards?.[mobileMode.cardIdx]?.strokes?.[mobileMode.holeIdx];
                            if (lastStroke) {
                                handleSaveResults(); // auto-guardar si hay score
                            }
                            const prevHole = mobileMode.holeIdx - 1;
                            if (prevHole >= 0) setMobileMode(prev => ({ ...prev, holeIdx: prevHole }));
                        }}
                    />,
                    document.body
                )}
                {renderContextMenu()}
                {renderFeedbackUi()}
            </div >
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

                        {calendarType === 'list' && (
                            <>
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
                            </>
                        )}
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {viewMode === 'calendar' && (
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '2px' }}>
                            <button
                                onClick={() => setCalendarType('list')}
                                style={{
                                    border: 'none',
                                    background: calendarType === 'list' ? 'white' : 'transparent',
                                    color: calendarType === 'list' ? 'var(--color-primary)' : '#64748b',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: calendarType === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.2s ease'
                                }}
                                title="Cambiar a Vista Lista"
                            >
                                <List size={24} />
                            </button>
                            <button
                                onClick={() => setCalendarType('month')}
                                style={{
                                    border: 'none',
                                    background: calendarType === 'month' ? 'white' : 'transparent',
                                    color: calendarType === 'month' ? 'var(--color-primary)' : '#64748b',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: calendarType === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                }}
                                title="Cambiar a Vista Mensual"
                            >
                                <Calendar size={24} />
                            </button>
                        </div>
                    )}
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => setIsCommunityModalOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                    >
                        <Share2 size={18} /> Explorar
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                        <Plus size={18} style={{ marginRight: '5px' }} /> Nuevo Torneo
                    </button>
                </div>
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
                <TournamentCreateForm
                    tournament={newTournament}
                    allCourses={allCourses}
                    onChange={setNewTournament}
                    onClose={() => setShowAddForm(false)}
                    onSubmit={handleAddTournament}
                />
            )}

            {/* Month View Component */}
            {viewMode === 'calendar' && calendarType === 'month' && (
                <MonthGridView
                    tournaments={sortedTournaments}
                    onTournamentClick={handleTournamentClick}
                    onDateClick={(date) => {
                        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                        setNewTournament(prev => ({ ...prev, startDate: localDate.toISOString().split('T')[0] }));
                        setShowAddForm(true);
                    }}
                />
            )}

            {/* Grid or List based on ViewMode */}
            {!(viewMode === 'calendar' && calendarType === 'month') && (
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
                                    data-context-menu-trigger="true"
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
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '0.5rem', paddingRight: '30px' }}>
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
                                        <span className="badge" style={{ backgroundColor: 'var(--color-valedera)', color: 'var(--color-valedera-text)', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                                            <Trophy size={11} style={{ marginRight: '4px' }} strokeWidth={2.5} />
                                            VALEDERA
                                        </span>
                                    )}
                                    {t.sace && (
                                        <span className="badge" style={{ backgroundColor: '#2563eb', color: 'white', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                                            <Trophy size={11} style={{ marginRight: '4px' }} strokeWidth={2.5} />
                                            SACE
                                        </span>
                                    )}
                                    {t.conflict && (
                                        <span className="badge" style={{ backgroundColor: 'var(--color-conflict)', color: 'white' }}>
                                            COINCIDE
                                        </span>
                                    )}
                                    {t.isShared && (
                                        <span className="badge" style={{ backgroundColor: '#f59e0b', color: 'white', display: 'inline-flex', alignItems: 'center' }}>
                                            <Share2 size={11} style={{ marginRight: '4px' }} />
                                            COMPARTIDO POR {t.sharedByName?.toUpperCase() || 'USUARIO'}
                                        </span>
                                    )}
                                    {(t.isShared || isSharedTournamentId(t.id)) && t.subscriberCount > 0 && (
                                        <span className="badge" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                                            <Users size={11} style={{ marginRight: '4px' }} />
                                            {t.subscriberCount} {t.subscriberCount === 1 ? 'PARTICIPANTE' : 'PARTICIPANTES'}
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
                                                                            const par = getTournamentPar(t, result, spanishCourses);
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
            )}
            {/* Mobile Scorecard Overlay */}
            {mobileMode && ReactDOM.createPortal(
                <MobileScorecardEditor
                    card={formData.scorecards?.[mobileMode.cardIdx] || { strokes: [], putts: [], girs: [], pars: [] }}
                    holeIdx={mobileMode.holeIdx}
                    par={(formData.scorecards?.[mobileMode.cardIdx]?.pars || [])[mobileMode.holeIdx] || 72 / 18} // Fallback to Par 4 average if missing
                    allScorecards={formData.scorecards || {}}
                    targetScore={editingDetails.target_score !== undefined ? editingDetails.target_score : (selectedTournament?.target_score ?? null)}
                    courseName={selectedTournament?.course || 'Campo de Golf'}
                    config={{
                        track_putts: editingDetails.track_putts === true,
                        track_girs: editingDetails.track_girs === true
                    }}
                    onUpdate={(hIdx, field, val) => handleHoleChange(mobileMode.cardIdx, hIdx, field, val)}
                    onJumpToHole={(hIdx) => {
                        const lastStroke = formData.scorecards?.[mobileMode.cardIdx]?.strokes?.[mobileMode.holeIdx];
                        if (lastStroke) handleSaveResults();
                        setMobileMode(prev => ({ ...prev, holeIdx: hIdx }));
                    }}
                    onClose={() => closeMobileMode()}
                    onNext={() => {
                        const nextHole = mobileMode.holeIdx + 1;
                        if (nextHole < 18) setMobileMode(prev => ({ ...prev, holeIdx: nextHole }));
                        else closeMobileMode();
                    }}
                    onPrev={() => {
                        const prevHole = mobileMode.holeIdx - 1;
                        if (prevHole >= 0) setMobileMode(prev => ({ ...prev, holeIdx: prevHole }));
                    }}
                    onSave={handleSaveResults}
                />,
                document.body
            )}

            {renderContextMenu()}
            {renderFeedbackUi()}

            <CommunityExplorerModal
                isOpen={isCommunityModalOpen}
                onClose={() => setIsCommunityModalOpen(false)}
                sharedTournaments={allAvailableTournaments}
                joinedTournaments={tournaments.filter(t => t.custom && t.isShared)}
                subscribedTournaments={subscribedTournaments}
                onJoin={onJoinTournament ? async (t) => {
                    await onJoinTournament(t);
                    setIsCommunityModalOpen(false);
                } : null}
                onLeave={onLeaveTournament}
                onAdd={!onJoinTournament ? async (t) => {
                    // Legacy fallback if no join handler
                    if (onAddTournament) {
                        const joinedTournament = {
                            ...t,
                            id: t.id,
                            custom: true,
                            isShared: true,
                            joinedAt: new Date().toISOString()
                        };
                        await onAddTournament(joinedTournament, false);
                        setIsCommunityModalOpen(false);
                    }
                } : null}
            />
        </div>
    );
}
