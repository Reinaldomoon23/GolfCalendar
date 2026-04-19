import React, { useState, useEffect, useRef } from 'react';
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
    const [toast, setToast] = useState(null); // { message, emoji, color }
    const prevScoresRef = useRef({});
    const [profileReady, setProfileReady] = useState(false);

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
            } finally {
                setProfileReady(true); // unblock tournament fetch regardless of success/failure
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
            setError(null);
            let foundTournament = null;

            // For custom tournaments, we NEED the real user UID to find the doc.
            // Wait for profile fetch to complete (success OR failure) before trying.
            const isCustomId = String(eventId).startsWith('custom_');
            if (isCustomId && !profileReady) {
                return; // will re-run once profileReady is true
            }
            
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
                setError(`Torneo no encontrado`);
            }
        };
        fetchTournament();
    }, [eventId, profileDocId, username, userProfile, profileReady]);

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

                // ── Score change notifications ────────────────────────────
                const playerName = data.full_name || userProfile?.full_name || username;
                if (data.scorecards) {
                    Object.keys(data.scorecards).forEach(rIdx => {
                        const card = data.scorecards[rIdx];
                        if (!card?.strokes) return;
                        for (let i = 0; i < 18; i++) {
                            const key = `${rIdx}_${i}`;
                            const newStroke = parseInt(card.strokes[i]);
                            const prevStroke = prevScoresRef.current[key];
                            if (!isNaN(newStroke) && newStroke > 0 && newStroke !== prevStroke) {
                                // New score detected!
                                const par = parseInt(card.pars?.[i]) || 4;
                                const diff = newStroke - par;
                                const holeNum = i + 1;
                                let emoji, label, color;
                                if (diff <= -2) { emoji = '🦅'; label = 'Eagle'; color = '#eab308'; }
                                else if (diff === -1) { emoji = '🐦'; label = 'Birdie'; color = '#10b981'; }
                                else if (diff === 0) { emoji = '⛳'; label = 'Par'; color = '#3b82f6'; }
                                else if (diff === 1) { emoji = '😤'; label = 'Bogey'; color = '#f97316'; }
                                else if (diff === 2) { emoji = '😬'; label = 'Doble Bogey'; color = '#ef4444'; }
                                else { emoji = '💀'; label = `+${diff}`; color = '#7f1d1d'; }

                                const msg = `${playerName} — Hoyo ${holeNum}: ${label} (${newStroke} golpes)`;
                                setToast({ message: msg, emoji, color });
                                setTimeout(() => setToast(null), 5000);

                                // Browser notification if permitted
                                if ('Notification' in window && Notification.permission === 'granted') {
                                    new Notification(`${emoji} ${label} — Hoyo ${holeNum}`, {
                                        body: msg, icon: '/pwa-192x192.png'
                                    });
                                }
                            }
                            prevScoresRef.current[key] = newStroke;
                        }
                    });
                }
                // If result has embedded tournament metadata, use it to ensure correct pars/course
                if (data.tournamentName) {
                    setError(null);
                    setTournament(prev => ({
                        ...prev,
                        id: eventId,
                        name: data.tournamentName,
                        course: data.tournamentCourse || prev?.course || '',
                        dates: data.tournamentDates || prev?.dates || '',
                        // Preserve or set par — use result's saved par, then previous, then compute from scorecards
                        par: data.tournamentPar || prev?.par || (() => {
                            // Compute total par from the first complete round's hole pars
                            if (data.scorecards) {
                                const firstCard = data.scorecards[Object.keys(data.scorecards)[0]];
                                if (firstCard?.pars) {
                                    const sum = firstCard.pars.reduce((acc, p) => acc + (parseInt(p) > 0 ? parseInt(p) : 0), 0);
                                    if (sum > 60 && sum < 80) return sum; // sanity check
                                }
                            }
                            return null;
                        })()
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
        dates: result.tournamentDates || '',
        par: result.tournamentPar || result.par || null
    } : null);

    // Once tournamentInfo is available, render immediately — even before the Firestore listener responds.
    // This ensures users always see the scorecard structure right away (never blank).
    if (!tournamentInfo) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', background: '#0f172a' }}>
                 <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #334155', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }} />
                    <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>{t.loading}</p>
                 </div>
            </div>
        );
    }

    // Determine the active hole
    let activeHole = null;
    let activePar = null;
    let paceData = null;
    let foundActiveRIdx = null;

    // Always synthesize a result object — even if no Firestore doc exists yet.
    // This ensures the scorecard grid renders immediately without waiting for live data.
    let activeResult = result || {
        tournamentName: tournamentInfo.name,
        tournamentCourse: tournamentInfo.course || '',
        tournamentDates: tournamentInfo.dates || '',
        tournamentPar: tournamentInfo.par || null,
        scorecards: {},
        rounds: {}
    };

    const parseDateHelper = (dateStr) => {
        if (!dateStr) return { start: 0, end: 0, days: 1 };
        const parts = dateStr.split(' - ');
        if (parts.length === 0) return { start: 0, end: 0, days: 1 };
        const d1Part = parts[0].split('/');
        const d2Part = parts.length > 1 ? parts[1].split('/') : d1Part;
        const d1 = new Date(d1Part[2], d1Part[1] - 1, d1Part[0]).setHours(0, 0, 0, 0);
        const d2 = new Date(d2Part[2], d2Part[1] - 1, d2Part[0]).setHours(0, 0, 0, 0);
        const days = Math.min(10, Math.max(1, Math.round((d2 - d1) / (24 * 60 * 60 * 1000)) + 1));
        return { start: d1, end: d2, days };
    };

    let roundsKeys = [];
    if (activeResult) {
        // Ensure activeResult.scorecards exists
        if (!activeResult.scorecards) activeResult.scorecards = {};

        // Calculate expected rounds based on dates
        const dateInfo = parseDateHelper(activeResult.tournamentDates || tournament?.dates || '');
        const maxRounds = dateInfo.days;

        // Populate roundsKeys with all possible rounds (0 to maxRounds-1)
        // AND any rounds that might already be in scorecards (just in case)
        const allPossibleKeys = new Set(Object.keys(activeResult.scorecards || {}));
        for (let i = 0; i < maxRounds; i++) allPossibleKeys.add(String(i));
        roundsKeys = Array.from(allPossibleKeys).sort((a, b) => parseInt(a) - parseInt(b));
        
        // 1. Try to find the round from the URL (check for ?r=X or ?round=X)
        const requestedR = queryRIdx !== null ? queryRIdx : searchParams.get('round');
        if (requestedR !== null) {
            const match = roundsKeys.find(rk => String(rk) === String(requestedR));
            if (match) {
                foundActiveRIdx = match;
            }
        }

        // 2. If no valid round in URL, find a round in progress (< 18 holes)
        if (foundActiveRIdx === null) {
            for (let i = roundsKeys.length - 1; i >= 0; i--) {
                const rIdx = roundsKeys[i];
                const card = activeResult.scorecards[rIdx];
                if (!card) continue;
                let playedHoles = 0;
                for (let h = 0; h < 18; h++) {
                    const s = String(card?.strokes?.[h] || '');
                    if (s !== '' && s !== '-' && s !== '0') playedHoles++;
                }
                if (playedHoles > 0 && playedHoles < 18) {
                    foundActiveRIdx = rIdx;
                    break;
                }
            }
        }

        // 3. Fallback to any round with data
        if (foundActiveRIdx === null) {
            for (let i = roundsKeys.length - 1; i >= 0; i--) {
                const rIdx = roundsKeys[i];
                const card = activeResult.scorecards[rIdx];
                if (!card) continue;
                let playedHoles = 0;
                for (let h = 0; h < 18; h++) {
                    const s = String(card?.strokes?.[h] || '');
                    if (s !== '' && s !== '-') playedHoles++;
                }
                if (playedHoles > 0 || activeResult.rounds?.[parseInt(rIdx)]) {
                    foundActiveRIdx = rIdx;
                    break;
                }
            }
        }

        // 4. Ultimate fallback: last round available
        if (foundActiveRIdx === null && roundsKeys.length > 0) {
            foundActiveRIdx = roundsKeys[roundsKeys.length - 1];
        }

        if (foundActiveRIdx !== null) {
            // Ensure the active scorecard exists even if empty, to avoid crashes
            if (!activeResult.scorecards[foundActiveRIdx]) {
                activeResult.scorecards[foundActiveRIdx] = {
                    strokes: Array(18).fill('-'),
                    pars: Array(18).fill(activeResult.tournamentPar ? Math.round(activeResult.tournamentPar / 18) : 4),
                    putts: Array(18).fill('-'),
                    girs: Array(18).fill('-')
                };
            }

            const card = activeResult.scorecards[foundActiveRIdx];
            if (card) {
                let currentRoundHoles = 0;
                for (let i = 0; i < 18; i++) {
                    const stroke = String(card.strokes?.[i] || '');
                    if (stroke !== '' && stroke !== '-' && stroke !== '0') {
                        currentRoundHoles++;
                    }
                    if (activeHole === null && (stroke === '' || stroke === '-' || stroke === '0')) {
                        activeHole = i + 1;
                        activePar = parseInt(card.pars?.[i]) || 4;
                    }
                }

                // Pace Calculation
                const teeTimeStr = activeResult.tee_time || tournament?.tee_time;
                if (teeTimeStr && currentRoundHoles > 0) {
                    try {
                        const [hours, mins] = teeTimeStr.split(':').map(Number);
                        const start = new Date();
                        start.setHours(hours, mins, 0, 0);
                        
                        const now = new Date();
                        const elapsedMs = now - start;
                        if (elapsedMs > 0) {
                            const elapsedMins = Math.floor(elapsedMs / 60000);
                            const minsPerHole = elapsedMins / currentRoundHoles;
                            const remainingHoles = 18 - currentRoundHoles;
                            const remainingMins = Math.round(remainingHoles * minsPerHole);
                            const finishTime = new Date(now.getTime() + remainingMins * 60000);
                            
                            paceData = {
                                elapsed: `${Math.floor(elapsedMins / 60) > 0 ? `${Math.floor(elapsedMins / 60)}h ` : ''}${elapsedMins % 60}m`,
                                finish: finishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                minsPerHole: minsPerHole.toFixed(1)
                            };
                        }
                    } catch (e) {
                        console.error("Error calculating pace:", e);
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
                @keyframes slideInDown {
                    from { transform: translateY(-80px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {/* Toast notification */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 9999, animation: 'slideInDown 0.4s ease',
                    background: '#1e293b', border: `2px solid ${toast.color}`,
                    borderRadius: '16px', padding: '12px 20px', minWidth: '280px', maxWidth: '90vw',
                    boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 15px ${toast.color}33`,
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <span style={{ fontSize: '2rem' }}>{toast.emoji}</span>
                    <div>
                        <div style={{ color: toast.color, fontWeight: '800', fontSize: '0.85rem' }}>RESULTADO EN VIVO</div>
                        <div style={{ color: 'white', fontSize: '0.9rem', marginTop: '2px' }}>{toast.message}</div>
                    </div>
                </div>
            )}

            {/* Notification permission prompt */}
            {'Notification' in window && Notification.permission === 'default' && (
                <div style={{
                    background: '#1e3a5f', borderBottom: '1px solid #1d4ed8',
                    padding: '8px 16px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: '8px', fontSize: '0.8rem', color: '#93c5fd'
                }}>
                    <span>🔔 ¿Recibir notificaciones de golpes en tiempo real?</span>
                    <button
                        onClick={() => Notification.requestPermission()}
                        style={{
                            background: '#1d4ed8', border: 'none', color: 'white',
                            padding: '4px 12px', borderRadius: '8px', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap'
                        }}
                    >Activar</button>
                </div>
            )}

            {/* Header */}
            <header style={{
                background: '#1e293b',
                padding: '0.8rem 1rem',
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
                    </div>

                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                            <ProfileImage
                                photoPath={userProfile?.photo_url || activeResult?.photo_url}
                                displayName={userProfile?.full_name || username}
                                alt={username}
                                style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #3b82f6', objectFit: 'cover' }}
                            />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold', letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
                                    {t.live} <span className="live-dot">🔴</span>
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', lineHeight: '1.1' }}>
                                    {userProfile?.full_name || activeResult?.full_name || username}
                                </div>
                            </div>
                        </div>
                        <h1 style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>
                            {activeResult?.tournamentName || tournament?.name}
                        </h1>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <MapPin size={10} /> {activeResult?.tournamentCourse || tournament?.course}
                        </div>

                        {weather && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '4px', fontSize: '0.65rem', color: '#94a3b8' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Thermometer size={12} color="#3b82f6" /> {weather.temp}°C
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Wind size={12} color="#3b82f6" /> {weather.wind} km/h
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {weather.code >= 60 ? <CloudRain size={12} color="#3b82f6" /> : <Cloud size={12} color="#3b82f6" />}
                                    {weather.humidity}%
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {activeResult && (
                <div style={{ padding: '0.5rem 0.6rem' }}>
                    {/* Active Hole & Pace Card - MOVED HERE for visibility */}
                    {activeHole && (
                        <div style={{ background: '#334155', borderRadius: '10px', padding: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #475569', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.playingHole}</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{activeHole} <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'normal' }}>({t.par} {activePar})</span></div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.average} {activePar}</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6' }}>{parStats[activePar]}</div>
                                </div>
                            </div>

                            {paceData && (
                                <div style={{ 
                                    paddingTop: '8px', 
                                    borderTop: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    fontSize: '0.75rem' 
                                }}>
                                    <div style={{ color: '#94a3b8' }}>
                                        🕒 Transcurrido: <span style={{ color: 'white', fontWeight: 'bold' }}>{paceData.elapsed}</span>
                                    </div>
                                    <div style={{ color: '#94a3b8' }}>
                                        🏁 Est. Fin: <span style={{ color: '#10b981', fontWeight: 'bold' }}>{paceData.finish}</span>
                                    </div>
                                    <div style={{ color: '#94a3b8' }}>
                                        ⏱️ {paceData.minsPerHole} m/h
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        {/* Summary Loop over Rounds */}
                        {(() => {
                            let cumulativeScore = 0;
                            let cumulativePar = 0;
                            let totalHolesPlayed = 0;
                            const roundsSummary = [];
                            roundsKeys.forEach(rIdx => {
                                let rScore = 0;
                                let rPar = 0;
                                let rHoles = 0;
                                const card = activeResult.scorecards[rIdx];
                                if (card?.strokes) {
                                    for (let i = 0; i < 18; i++) {
                                        const strokeStr = String(card.strokes[i] || '');
                                        if (strokeStr !== '' && strokeStr !== '-') {
                                            const s = parseInt(strokeStr);
                                            if (!isNaN(s) && s > 0) {
                                                rScore += s;
                                                const p = parseInt(card.pars?.[i]);
                                                rPar += (!isNaN(p) && p > 0 ? p : 4);
                                                rHoles++;
                                            }
                                        }
                                    }
                                }
                                cumulativeScore += rScore;
                                cumulativePar += rPar;
                                totalHolesPlayed += rHoles;
                                roundsSummary.push({ rIdx, score: rScore, par: rPar, holes: rHoles });
                            });

                            // If tournament declares a specific par, use it to correct rounding
                            // e.g. Par 73 field where one hole par wasn't saved correctly
                            const declaredCoursePar = parseInt(tournamentInfo?.par || tournamentInfo?.course_par);
                            if (!isNaN(declaredCoursePar) && declaredCoursePar > 0 && totalHolesPlayed === 18 * roundsKeys.length) {
                                // All holes played: use declared par per round × rounds
                                cumulativePar = declaredCoursePar * roundsKeys.length;
                            } else if (!isNaN(declaredCoursePar) && declaredCoursePar > 0 && totalHolesPlayed > 0) {
                                // Partial round: scale declared par proportionally
                                const totalPossibleHoles = 18 * roundsKeys.length;
                                cumulativePar = Math.round((declaredCoursePar * roundsKeys.length) * (totalHolesPlayed / totalPossibleHoles));
                            }

                            const cumulativeDiff = cumulativeScore - cumulativePar;
                            const cumulativeDiffStr = cumulativeDiff > 0 ? `+${cumulativeDiff}` : cumulativeDiff < 0 ? `${cumulativeDiff}` : 'E';
                            const cumulativeDiffColor = cumulativeDiff > 0 ? '#ef4444' : cumulativeDiff < 0 ? '#10b981' : '#94a3b8';

                            // Use the active round detected at the top
                            let displayRounds = [foundActiveRIdx];

                            // Target Diff Logic
                            let targetDiffRender = null;
                            if (activeResult.target_score !== undefined && activeResult.target_score !== null) {
                                const ts = parseInt(activeResult.target_score);
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
                                            borderRadius: '10px',
                                            padding: '0.8rem 1rem',
                                            marginBottom: '0.6rem',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                                            border: '2px solid #3b82f6'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                {/* Header and Total */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                                                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem', fontWeight: '800' }}>
                                                        📊 TOTAL TORNEO
                                                    </h3>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                        <span style={{ fontSize: '2rem', fontWeight: '900', color: 'white' }}>
                                                            {cumulativeScore}
                                                        </span>
                                                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: cumulativeDiffColor }}>
                                                            ({cumulativeDiffStr})
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Round List */}
                                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                                    {roundsSummary.map((rs, idx) => {
                                                        const diff = rs.score - rs.par;
                                                        const diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'E';
                                                        const diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#94a3b8';
                                                        return (
                                                            <div key={rs.rIdx} style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Día {idx + 1}</span>
                                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{rs.score || '-'}</span>
                                                                    {rs.holes > 0 && (
                                                                        <span style={{ color: diffColor, fontSize: '0.9rem', fontWeight: 'bold' }}>({diffStr})</span>
                                                                    )}
                                                                </div>
                                                                <span style={{ fontSize: '0.65rem', color: '#475569' }}>{rs.holes} hoyos</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Vueltas individuales */}
                                    {displayRounds.map((rIdx) => {
                                const roundStr = parseInt(rIdx);
                                const card = activeResult.scorecards[rIdx];

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
                                    let roundPar = playedPar;
                                    // Correct using tournament's declared par if all 18 holes are played
                                    const declaredPar = parseInt(tournamentInfo?.par || tournamentInfo?.course_par);
                                    if (!isNaN(declaredPar) && declaredPar > 0) {
                                        if (holesPlayed === 18) {
                                            roundPar = declaredPar;
                                        } else {
                                            // Proportional: scale declared par to holes played
                                            roundPar = Math.round(declaredPar * holesPlayed / 18);
                                        }
                                    }
                                    const diff = playedStrokes - roundPar;
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
                                        borderRadius: '10px',
                                        padding: '1rem',
                                        marginBottom: '0.8rem',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '10px', flexWrap: 'wrap' }}>
                                            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem', flex: '1 1 150px', lineHeight: '1.2' }}>
                                                {t.round} {roundStr + 1} {roundsKeys.length > 1 ? `(Vuelta ${roundStr + 1} de ${roundsKeys.length})` : ''}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexShrink: 0 }}>
                                                <span style={{ fontSize: '1.8rem', fontWeight: '900', color: 'white' }}>{displayTotal || '-'}</span>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: diffColor }}>
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
