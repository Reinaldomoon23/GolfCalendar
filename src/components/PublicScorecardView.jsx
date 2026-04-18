import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Flag, Info, MapPin, Wind, Thermometer, CloudRain, Cloud, Sun } from 'lucide-react';
import ProfileImage from './ProfileImage';
import {
    fetchUserProfileByUsername,
    getUserDocId,
    getUserSubcollectionRef,
    getUserSubdocRef
} from '../utils/userProfiles';
import tournamentsData from '../data/tournaments.json';

export default function PublicScorecardView() {
    const { username, id: eventId } = useParams();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const queryRIdx = searchParams.get('r');

    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [tournament, setTournament] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [parStats, setParStats] = useState({ 3: '-', 4: '-', 5: '-' });
    const [lang, setLang] = useState('es');
    const [weather, setWeather] = useState(null);

    const i18n = {
        es: {
            follow: 'Sigue los resultados de',
            live: 'EN DIRECTO',
            loading: 'Cargando datos en vivo...',
            playingHole: 'Jugando Hoyo',
            average: 'Promedio Par',
            round: 'Ronda',
            hole: 'Hoyo',
            score: 'Score',
            noResults: 'Todavía no hay resultados registrados para este torneo.',
            par: 'Par',
            wind: 'Viento',
            temp: 'Temp',
            humidity: 'Hum'
        },
        en: {
            follow: 'Following results of',
            live: 'LIVE',
            loading: 'Loading live data...',
            playingHole: 'Playing Hole',
            average: 'Avg Par',
            round: 'Round',
            hole: 'Hole',
            score: 'Score',
            noResults: 'No results recorded for this tournament yet.',
            par: 'Par',
            wind: 'Wind',
            temp: 'Temp',
            humidity: 'Hum'
        }
    };
    const t = i18n[lang];
    const profileDocId = getUserDocId(userProfile) || username;

    // Current Time Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Calculate historical par averages for the player
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const resultsRef = getUserSubcollectionRef(db, userProfile || username, 'results');
                const snapshot = await getDocs(resultsRef);
                const totals = {
                    3: { sum: 0, count: 0 },
                    4: { sum: 0, count: 0 },
                    5: { sum: 0, count: 0 }
                };

                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.scorecards) {
                        Object.values(data.scorecards).forEach(card => {
                            if (!card.pars || !card.strokes) return;
                            for (let i = 0; i < 18; i++) {
                                const par = parseInt(card.pars[i]);
                                const stroke = parseInt(card.strokes[i]);
                                if (par && stroke && stroke > 0) {
                                    if (par === 3 || par === 4 || par === 5) {
                                        totals[par].sum += stroke;
                                        totals[par].count++;
                                    }
                                }
                            }
                        });
                    }
                });

                setParStats({
                    3: totals[3].count > 0 ? (totals[3].sum / totals[3].count).toFixed(2) : '-',
                    4: totals[4].count > 0 ? (totals[4].sum / totals[4].count).toFixed(2) : '-',
                    5: totals[5].count > 0 ? (totals[5].sum / totals[5].count).toFixed(2) : '-'
                });
            } catch (err) {
                console.error("Error fetching stats", err);
            }
        };
        fetchStats();
    }, [profileDocId, username]);

    // Fetch user info from Firestore
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const profile = await fetchUserProfileByUsername(db, username);
                if (profile) {
                    setUserProfile(profile);
                }
            } catch (err) {
                console.error("Error fetching user profile from Firestore", err);
            }
        };
        fetchUser();
    }, [username]);

    // Fetch weather info based on course location
    useEffect(() => {
        const courseName = result?.tournamentCourse || tournament?.course;
        if (!courseName) return;

        const fetchWeather = async () => {
            try {
                // 1. Geocode course name to get coordinates (using photon.komoot.io - no key needed)
                const geoUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(courseName)}&limit=1`;
                const geoRes = await fetch(geoUrl);
                const geoData = await geoRes.json();

                if (geoData.features && geoData.features.length > 0) {
                    const [lon, lat] = geoData.features[0].geometry.coordinates;
                    const locationName = geoData.features[0].properties.city || geoData.features[0].properties.name || '';

                    // 2. Fetch weather from Open-Meteo (no key needed)
                    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto`;
                    const weatherRes = await fetch(weatherUrl);
                    const weatherData = await weatherRes.json();

                    if (weatherData.current) {
                        setWeather({
                            temp: weatherData.current.temperature_2m,
                            wind: weatherData.current.wind_speed_10m,
                            humidity: weatherData.current.relative_humidity_2m,
                            code: weatherData.current.weather_code,
                            location: locationName
                        });
                    }
                }
            } catch (err) {
                console.error("Error fetching weather", err);
            }
        };

        fetchWeather();
    }, [tournament?.course, result?.tournamentCourse]);

    // Fetch tournament info
    // IMPORTANT: Check user's custom_tournaments FIRST because they override official ones.
    // (e.g. the user may have edited an official tournament - the custom version takes priority)
    useEffect(() => {
        const fetchTournament = async () => {
            let foundTournament = null;
            
            try {
                // 1. User's custom overrides (highest priority) - catch permission errors
                const customRef = getUserSubdocRef(db, userProfile || username, 'custom_tournaments', eventId);
                const customSnap = await getDoc(customRef);
                if (customSnap.exists()) {
                    foundTournament = { id: customSnap.id, ...customSnap.data() };
                }
            } catch (err) { 
                /* ignore, likely permission error for guest */ 
            }

            if (!foundTournament) {
                // 2. Local official JSON
                const localOfficial = tournamentsData.find((t) => String(t.id) === String(eventId));
                if (localOfficial) {
                    foundTournament = localOfficial;
                }
            }

            if (!foundTournament) {
                try {
                    // 3. Firebase official tournaments collection
                    const docRef = doc(db, 'tournaments', eventId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        foundTournament = { id: docSnap.id, ...docSnap.data() };
                    }
                } catch (err) {
                     console.error("Error fetching official tournament", err);
                }
            }

            if (foundTournament) {
                setTournament(foundTournament);
            } else {
                setError('Torneo no encontrado');
            }
        };
        fetchTournament();
    }, [eventId, profileDocId, username]);

    // Listen to live results — independent of tournament lookup
    useEffect(() => {
        const resultRef = getUserSubdocRef(db, userProfile || username, 'results', eventId);
        const unsubscribe = onSnapshot(resultRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                // HOTFIX: Salamanca Forum Golf hole 15 par correction
                if (data.scorecards) {
                    Object.keys(data.scorecards).forEach(rIdx => {
                        const card = data.scorecards[rIdx];
                        if (card.pars && card.pars[14] === 5) {
                            // Verify course name
                            const courseName = (data.tournamentCourse || tournament?.course || '').toLowerCase();
                            if (courseName.includes('salamanca forum')) {
                                card.pars[14] = 4;
                            }
                        }
                    });
                }

                setResult(data);
                // If result has embedded tournament metadata, use it to ensure correct pars/course
                if (data.tournamentName) {
                    setTournament(prev => ({
                        ...prev,
                        id: eventId,
                        name: data.tournamentName,
                        course: data.tournamentCourse || prev?.course || '',
                        dates: data.tournamentDates || prev?.dates || ''
                    }));
                }
            } else {
                setResult(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error listening to results", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profileDocId, username, eventId]);

    const getScoreColor = (strokes, par) => {
        if (!strokes || !par || strokes === '-' || strokes === 0) return 'transparent';
        const diff = strokes - (par || 4); // Default par 4 fallback
        if (diff <= -2) return '#eab308'; // Eagle (amarillo)
        if (diff === -1) return '#10b981'; // Birdie (verde)
        if (diff === 0) return '#3b82f6'; // Par (azul)
        if (diff === 1) return '#f97316'; // Bogey (naranja)
        if (diff === 2) return '#ef4444'; // Doble bogey (rojo)
        return '#000000'; // Triple bogey o peor (negro)
    };

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'white' }}>
                <h2>Ups!</h2>
                <p>{error}</p>
                <Link to="/" style={{ color: '#3b82f6' }}>Volver a la App</Link>
            </div>
        );
    }

    // Show loading only if we have neither tournament data nor result with embedded metadata
    const tournamentInfo = tournament || (result?.tournamentName ? {
        id: eventId,
        name: result.tournamentName,
        course: result.tournamentCourse || '',
        dates: result.tournamentDates || ''
    } : null);

    if (loading || !tournamentInfo) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', background: '#0f172a' }}>
                <p>{t.loading}</p>
                <div style={{ marginTop: '20px', fontSize: '0.75rem', opacity: 0.5 }}>v2.5.0</div>
                <button 
                    onClick={() => window.location.reload(true)}
                    style={{ marginTop: '10px', background: '#334155', border: '1px solid #475569', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                    Reiniciar Cargar ↻
                </button>
            </div>
        );
    }

    // Determine the active hole
    let activeHole = null;
    let activePar = null;

    if (result && result.scorecards) {
        const roundsKeys = Object.keys(result.scorecards).sort();
        let foundActiveRIdx = roundsKeys.length > 0 ? roundsKeys[0] : null;

        for (let i = roundsKeys.length - 1; i >= 0; i--) {
            const rIdx = roundsKeys[i];
            const card = result.scorecards[rIdx];

            let playedHoles = 0;
            let strokesMatchParsPrecisely = true;

            for (let h = 0; h < 18; h++) {
                const s = String(card.strokes?.[h] || '');
                const p = String(card.pars?.[h] || '');
                if (s !== '' && s !== '-') playedHoles++;
                if (s !== p) strokesMatchParsPrecisely = false;
            }

            const isAutoPopulatedDummy = (playedHoles === 18 && strokesMatchParsPrecisely);
            const manualStrokesTotal = result.rounds?.[parseInt(rIdx)];

            if ((playedHoles > 0 && !isAutoPopulatedDummy) || (manualStrokesTotal && manualStrokesTotal > 0)) {
                foundActiveRIdx = rIdx;
                break;
            }
        }

        if (foundActiveRIdx !== null) {
            const card = result.scorecards[foundActiveRIdx];
            if (card) {
                for (let i = 0; i < 18; i++) {
                    const stroke = String(card.strokes?.[i] || '');
                    if (stroke === '' || stroke === '-' || stroke === '0') {
                        activeHole = i + 1;
                        activePar = parseInt(card.pars?.[i]) || 4;
                        break;
                    }
                }
            }
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
            paddingBottom: '3rem'
        }}>
            <style>{`
                @keyframes pulseLive {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .live-dot {
                    display: inline-block;
                    animation: pulseLive 1.5s infinite ease-in-out;
                    margin-left: 4px;
                }
            `}</style>

            {/* Header */}
            <header style={{
                background: '#1e293b',
                padding: '1.2rem 1rem',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', background: '#0f172a', padding: '2px', borderRadius: '6px', border: '1px solid #334155' }}>
                            <button onClick={() => setLang('es')} style={{ background: lang === 'es' ? '#3b82f6' : 'transparent', border: 'none', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>ES</button>
                            <button onClick={() => setLang('en')} style={{ background: lang === 'en' ? '#3b82f6' : 'transparent', border: 'none', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>EN</button>
                        </div>
                        <div onClick={() => window.location.reload(true)} style={{ fontSize: '0.6rem', color: '#475569', cursor: 'pointer', marginTop: '4px' }}>
                             v2.5.0 ↻
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
                            <ProfileImage
                                photoPath={userProfile?.photo_url || result?.photo_url}
                                displayName={userProfile?.full_name || username}
                                alt={username}
                                style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid #3b82f6', objectFit: 'cover' }}
                            />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold', letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
                                    {t.live} <span className="live-dot">🔴</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                                    {t.follow}
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', lineHeight: '1.2' }}>
                                    {userProfile?.full_name || result?.full_name || username}
                                </div>
                            </div>
                        </div>
                        <h1 style={{ margin: 0, fontSize: '1rem', color: '#cbd5e1' }}>
                            {result?.tournamentName || tournament?.name}
                        </h1>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {result?.tournamentCourse || tournament?.course}
                        </div>

                        {weather && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px', fontSize: '0.75rem', color: '#94a3b8' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Thermometer size={14} color="#3b82f6" /> {weather.temp}°C
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Wind size={14} color="#3b82f6" /> {weather.wind} km/h
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {weather.code >= 60 ? <CloudRain size={14} color="#3b82f6" /> : <Cloud size={14} color="#3b82f6" />}
                                    {weather.humidity}% {t.humidity}
                                </div>
                            </div>
                        )}

                        {activeHole && (
                            <div style={{ background: '#334155', borderRadius: '12px', padding: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #475569' }}>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.playingHole}</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'white' }}>{activeHole} <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 'normal' }}>({t.par} {activePar})</span></div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.average} {activePar}</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#3b82f6' }}>{parStats[activePar]}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Total / Summary Stats */}
            {!result ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    <Flag size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    <p>{t.noResults}</p>
                </div>
            ) : (
                <div style={{ padding: '1rem' }}>
                    <div style={{ padding: '1rem' }}>
                        {/* Summary Loop over Rounds */}
                        {(() => {
                            const roundsKeys = Object.keys(result.scorecards || {});
                            if (roundsKeys.length === 0) return null;

                            // NUEVO: Calcular total acumulado de todas las vueltas
                            let cumulativeScore = 0;
                            let cumulativePar = 0;
                            let totalHolesPlayed = 0;

                            roundsKeys.forEach(rIdx => {
                                const card = result.scorecards[rIdx];
                                for (let i = 0; i < 18; i++) {
                                    const strokeStr = String(card.strokes?.[i] || '');
                                    if (strokeStr !== '' && strokeStr !== '-') {
                                        const s = parseInt(strokeStr);
                                        if (!isNaN(s) && s > 0) {
                                            cumulativeScore += s;
                                            const p = parseInt(card.pars?.[i]);
                                            cumulativePar += (!isNaN(p) && p > 0 ? p : 4);
                                            totalHolesPlayed++;
                                        }
                                    }
                                }
                            });

                            const cumulativeDiff = cumulativeScore - cumulativePar;
                            const cumulativeDiffStr = cumulativeDiff > 0 ? `+${cumulativeDiff}` : cumulativeDiff < 0 ? `${cumulativeDiff}` : 'E';
                            const cumulativeDiffColor = cumulativeDiff > 0 ? '#ef4444' : cumulativeDiff < 0 ? '#10b981' : '#94a3b8';

                            // We want to display the specific round passed via URL query if available
                            let displayRounds = [];

                            if (queryRIdx !== null && roundsKeys.includes(queryRIdx)) {
                                displayRounds = [queryRIdx];
                            } else {
                                // Find the highest round index that actually has strokes or manual scores
                                // Ignore rounds that perfectly match pars for all 18 holes (old auto-populate bug)
                                let activeRIdx = roundsKeys[0];
                                for (let i = roundsKeys.length - 1; i >= 0; i--) {
                                    const rIdx = roundsKeys[i];
                                    const card = result.scorecards[rIdx];
                                    const roundStr = parseInt(rIdx);

                                    let playedHoles = 0;
                                    let strokesMatchParsPrecisely = true;

                                    for (let h = 0; h < 18; h++) {
                                        const s = String(card.strokes?.[h] || '');
                                        const p = String(card.pars?.[h] || '');
                                        if (s !== '' && s !== '-') {
                                            playedHoles++;
                                        }
                                        if (s !== p) {
                                            strokesMatchParsPrecisely = false;
                                        }
                                    }

                                    const isAutoPopulatedDummy = (playedHoles === 18 && strokesMatchParsPrecisely);
                                    const manualStrokesTotal = result.rounds?.[roundStr];

                                    if ((playedHoles > 0 && !isAutoPopulatedDummy) || (manualStrokesTotal && manualStrokesTotal > 0)) {
                                        activeRIdx = rIdx;
                                        break;
                                    }
                                }
                                displayRounds = [activeRIdx];
                            }

                            // Target Diff Logic
                            let targetDiffRender = null;
                            if (tournament?.target_score !== undefined && tournament?.target_score !== null) {
                                const ts = parseInt(tournament.target_score);
                                const tDiff = cumulativeDiff - ts;
                                const tDiffStr = tDiff > 0 ? `+${tDiff}` : tDiff < 0 ? `${tDiff}` : 'E';
                                const tDiffColor = tDiff > 0 ? '#ef4444' : tDiff < 0 ? '#10b981' : '#f1f5f9';
                                targetDiffRender = (
                                    <div style={{ paddingLeft: '15px', borderLeft: '1px solid rgba(255,255,255,0.2)', marginLeft: '10px' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Objetivo ({ts > 0 ? `+${ts}` : ts})</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: tDiffColor }}>
                                            {tDiffStr}
                                        </div>
                                    </div>
                                );
                            }

                            // Map over the correct round(s)
                            return (
                                <>
                                    {/* Mostrar total acumulado solo si hay más de 1 vuelta OR if there is an objective */}
                                    {((roundsKeys.length > 1 || targetDiffRender !== null) && totalHolesPlayed > 0) && (
                                        <div style={{
                                            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                                            borderRadius: '16px',
                                            padding: '1.5rem',
                                            marginBottom: '1.5rem',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                                            border: '2px solid #3b82f6'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem', fontWeight: '800' }}>
                                                    📊 TOTAL ACUMULADO ({totalHolesPlayed} hoyos)
                                                </h3>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                        <span style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white' }}>
                                                            {cumulativeScore}
                                                        </span>
                                                        <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: cumulativeDiffColor }}>
                                                            ({cumulativeDiffStr})
                                                        </span>
                                                    </div>
                                                    {targetDiffRender}
                                                </div>
                                            </div>
                                            <div style={{
                                                marginTop: '10px',
                                                fontSize: '0.9rem',
                                                color: '#94a3b8',
                                                display: 'flex',
                                                gap: '20px'
                                            }}>
                                                <span>🎯 Par acumulado: {cumulativePar}</span>
                                                <span>⛳ Hoyos: {totalHolesPlayed}/{roundsKeys.length * 18}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Vueltas individuales */}
                                    {displayRounds.map((rIdx) => {
                                const roundStr = parseInt(rIdx);
                                const card = result.scorecards[rIdx];

                                let playedStrokes = 0;
                                let playedPar = 0;
                                let holesPlayed = 0;

                                for (let i = 0; i < 18; i++) {
                                    const strokeStr = String(card.strokes?.[i] || '');
                                    if (strokeStr !== '' && strokeStr !== '-') {
                                        const s = parseInt(strokeStr);
                                        if (!isNaN(s) && s > 0) {
                                            playedStrokes += s;
                                            const p = parseInt(card.pars?.[i]);
                                            playedPar += (!isNaN(p) && p > 0 ? p : 4); // default par 4 fallback
                                            holesPlayed++;
                                        }
                                    }
                                }

                                const manualStrokesTotal = result.rounds?.[roundStr];
                                const displayTotal = holesPlayed > 0 ? playedStrokes : manualStrokesTotal;

                                let diffStr = 'E';
                                let diffColor = '#94a3b8';

                                if (holesPlayed > 0) {
                                    const diff = playedStrokes - playedPar;
                                    diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'E';
                                    diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#94a3b8';
                                } else {
                                    if (!displayTotal || displayTotal === '') {
                                        diffStr = '-';
                                        diffColor = '#94a3b8';
                                    } else {
                                        // fallback for manual total score only
                                        const totalPar = (card.pars || []).reduce((a, b) => a + (parseInt(b) || 0), 0) || 72;
                                        const diff = displayTotal - totalPar;
                                        diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'E';
                                        diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#94a3b8';
                                    }
                                }

                                return (
                                    <div key={rIdx} style={{
                                        background: '#1e293b',
                                        borderRadius: '16px',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>
                                                {t.round} {roundStr + 1} {roundsKeys.length > 1 ? `(Vuelta ${roundStr + 1} de ${roundsKeys.length})` : ''}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                <span style={{ fontSize: '2rem', fontWeight: '900', color: 'white' }}>{displayTotal || '-'}</span>
                                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: diffColor }}>
                                                    ({diffStr})
                                                </span>
                                            </div>
                                        </div>

                                        {/* Scorecard Table */}
                                        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '10px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {/* First 9 Holes */}
                                                <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '100%', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                                                    {/* Row: Headers */}
                                                    <div style={{ display: 'flex', background: '#0f172a', fontWeight: 'bold', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', flexShrink: 0, textAlign: 'center', boxSizing: 'border-box' }}>{t.hole}</div>
                                                        {[...Array(9)].map((_, i) => (
                                                            <div key={i} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                {i + 1}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Row: Par */}
                                                    <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', borderTop: '1px solid #334155', flexShrink: 0, textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }}>{t.par}</div>
                                                        {[...Array(9)].map((_, i) => (
                                                            <div key={i} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', borderTop: '1px solid #334155', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                {card.pars?.[i] || '-'}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Row: Strokes */}
                                                    <div style={{ display: 'flex', background: '#334155', fontSize: '1rem', fontWeight: 'bold' }}>
                                                        <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #1e293b', borderTop: '1px solid #1e293b', flexShrink: 0, textAlign: 'center', color: 'white', boxSizing: 'border-box' }}>{t.score}</div>
                                                        {[...Array(9)].map((_, i) => {
                                                            const stroke = card.strokes?.[i] || '';
                                                            const par = parseInt(card.pars?.[i]) || 0;
                                                            const scoreNum = parseInt(stroke);
                                                            const isValidScore = stroke !== '' && stroke !== '-' && scoreNum > 0;
                                                            const bgColor = isValidScore ? getScoreColor(scoreNum, par) : 'transparent';

                                                            return (
                                                                <div key={i} style={{
                                                                    flex: '1 1 0%',
                                                                    padding: '6px 2px',
                                                                    borderRight: i < 8 ? '1px solid #1e293b' : 'none',
                                                                    borderTop: '1px solid #1e293b',
                                                                    display: 'flex',
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    boxSizing: 'border-box',
                                                                    minWidth: 0
                                                                }}>
                                                                    <div style={{
                                                                        width: '24px',
                                                                        height: '24px',
                                                                        display: 'flex',
                                                                        justifyContent: 'center',
                                                                        alignItems: 'center',
                                                                        borderRadius: bgColor !== 'transparent' && scoreNum - par <= 0 ? '50%' : '2px', // Circles for par or better, square for bogeys
                                                                        backgroundColor: bgColor,
                                                                        color: isValidScore ? 'white' : '#64748b',
                                                                    }}>
                                                                        {stroke === '-' ? '' : stroke}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>

                                                    {/* Row: Putts (if tracked) */}
                                                    {(result.track_putts || tournament?.track_putts) && (
                                                        <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.9rem' }}>
                                                            <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', borderTop: '1px solid #334155', flexShrink: 0, textAlign: 'center', color: '#94a3b8', fontWeight: 'bold', boxSizing: 'border-box' }}>Putts</div>
                                                            {[...Array(9)].map((_, i) => {
                                                                const putts = card.putts?.[i] || '';
                                                                return (
                                                                    <div key={i} style={{
                                                                        flex: '1 1 0%',
                                                                        padding: '8px 0',
                                                                        borderRight: i < 8 ? '1px solid #334155' : 'none',
                                                                        borderTop: '1px solid #334155',
                                                                        textAlign: 'center',
                                                                        color: '#cbd5e1',
                                                                        boxSizing: 'border-box',
                                                                        minWidth: 0
                                                                    }}>
                                                                        {putts !== '' && putts !== '-' ? putts : '-'}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Row: GIR (if tracked) */}
                                                    {(result.track_girs || tournament?.track_girs) && (
                                                        <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.9rem' }}>
                                                            <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', borderTop: '1px solid #334155', flexShrink: 0, textAlign: 'center', color: '#94a3b8', fontWeight: 'bold', boxSizing: 'border-box' }}>GIR</div>
                                                            {[...Array(9)].map((_, i) => {
                                                                const gir = card.girs?.[i] || '';
                                                                let girDisplay = '-';
                                                                let girColor = '#64748b';
                                                                if (gir === 'Y') { girDisplay = '✓'; girColor = '#10b981'; }
                                                                else if (gir === 'N') { girDisplay = '✗'; girColor = '#ef4444'; }

                                                                return (
                                                                    <div key={i} style={{
                                                                        flex: '1 1 0%',
                                                                        padding: '8px 0',
                                                                        borderRight: i < 8 ? '1px solid #334155' : 'none',
                                                                        borderTop: '1px solid #334155',
                                                                        textAlign: 'center',
                                                                        color: girColor,
                                                                        fontWeight: 'bold',
                                                                        boxSizing: 'border-box',
                                                                        minWidth: 0
                                                                    }}>
                                                                        {girDisplay}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Second 9 Holes */}
                                                <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '100%', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                                                    {/* Row: Headers */}
                                                    <div style={{ display: 'flex', background: '#0f172a', fontWeight: 'bold', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', flexShrink: 0, textAlign: 'center', boxSizing: 'border-box' }}>{t.hole}</div>
                                                        {[...Array(9)].map((_, i) => (
                                                            <div key={i + 9} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                {i + 10}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Row: Par */}
                                                    <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', borderTop: '1px solid #334155', flexShrink: 0, textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }}>{t.par}</div>
                                                        {[...Array(9)].map((_, i) => (
                                                            <div key={i + 9} style={{ flex: '1 1 0%', padding: '8px 0', borderRight: i < 8 ? '1px solid #334155' : 'none', borderTop: '1px solid #334155', textAlign: 'center', boxSizing: 'border-box', minWidth: 0 }}>
                                                                {card.pars?.[i + 9] || '-'}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Row: Strokes */}
                                                    <div style={{ display: 'flex', background: '#334155', fontSize: '1rem', fontWeight: 'bold' }}>
                                                        <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #1e293b', borderTop: '1px solid #1e293b', flexShrink: 0, textAlign: 'center', color: 'white', boxSizing: 'border-box' }}>{t.score}</div>
                                                        {[...Array(9)].map((_, i) => {
                                                            const stroke = card.strokes?.[i + 9] || '';
                                                            const par = parseInt(card.pars?.[i + 9]) || 0;
                                                            const scoreNum = parseInt(stroke);
                                                            const isValidScore = stroke !== '' && stroke !== '-' && scoreNum > 0;
                                                            const bgColor = isValidScore ? getScoreColor(scoreNum, par) : 'transparent';

                                                            return (
                                                                <div key={i + 9} style={{
                                                                    flex: '1 1 0%',
                                                                    padding: '6px 2px',
                                                                    borderRight: i < 8 ? '1px solid #1e293b' : 'none',
                                                                    borderTop: '1px solid #1e293b',
                                                                    display: 'flex',
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    boxSizing: 'border-box',
                                                                    minWidth: 0
                                                                }}>
                                                                    <div style={{
                                                                        width: '24px',
                                                                        height: '24px',
                                                                        display: 'flex',
                                                                        justifyContent: 'center',
                                                                        alignItems: 'center',
                                                                        borderRadius: bgColor !== 'transparent' && scoreNum - par <= 0 ? '50%' : '2px', // Circles for par or better, square for bogeys
                                                                        backgroundColor: bgColor,
                                                                        color: isValidScore ? 'white' : '#64748b',
                                                                    }}>
                                                                        {stroke === '-' ? '' : stroke}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>

                                                    {/* Row: Putts (if tracked) */}
                                                    {(result.track_putts || tournament?.track_putts) && (
                                                        <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.9rem' }}>
                                                            <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', borderTop: '1px solid #334155', flexShrink: 0, textAlign: 'center', color: '#94a3b8', fontWeight: 'bold', boxSizing: 'border-box' }}>Putts</div>
                                                            {[...Array(9)].map((_, i) => {
                                                                const putts = card.putts?.[i + 9] || '';
                                                                return (
                                                                    <div key={i + 9} style={{
                                                                        flex: '1 1 0%',
                                                                        padding: '8px 0',
                                                                        borderRight: i < 8 ? '1px solid #334155' : 'none',
                                                                        borderTop: '1px solid #334155',
                                                                        textAlign: 'center',
                                                                        color: '#cbd5e1',
                                                                        boxSizing: 'border-box',
                                                                        minWidth: 0
                                                                    }}>
                                                                        {putts !== '' && putts !== '-' ? putts : '-'}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Row: GIR (if tracked) */}
                                                    {(result.track_girs || tournament?.track_girs) && (
                                                        <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.9rem' }}>
                                                            <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #334155', borderTop: '1px solid #334155', flexShrink: 0, textAlign: 'center', color: '#94a3b8', fontWeight: 'bold', boxSizing: 'border-box' }}>GIR</div>
                                                            {[...Array(9)].map((_, i) => {
                                                                const gir = card.girs?.[i + 9] || '';
                                                                let girDisplay = '-';
                                                                let girColor = '#64748b';
                                                                if (gir === 'Y') { girDisplay = '✓'; girColor = '#10b981'; }
                                                                else if (gir === 'N') { girDisplay = '✗'; girColor = '#ef4444'; }

                                                                return (
                                                                    <div key={i + 9} style={{
                                                                        flex: '1 1 0%',
                                                                        padding: '8px 0',
                                                                        borderRight: i < 8 ? '1px solid #334155' : 'none',
                                                                        borderTop: '1px solid #334155',
                                                                        textAlign: 'center',
                                                                        color: girColor,
                                                                        fontWeight: 'bold',
                                                                        boxSizing: 'border-box',
                                                                        minWidth: 0
                                                                    }}>
                                                                        {girDisplay}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                                </>
                            );
                        })()}
                    </div>
                </div >
            )
            }
        </div >
    );
}
