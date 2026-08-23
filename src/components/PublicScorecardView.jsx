import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore';
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
import {
    generateTournamentDeterministicId,
    resolveCanonicalTournamentId,
    getTournamentIdCandidates
} from '../services/tournaments.service';
import { getResultProgress, subscribeToLeaderboard } from '../services/leaderboard.service';
import { getKnownProfilePhotoUrl } from '../utils/profilePhotos';

function normalizeTournamentText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function resultMatchesTournament(resultId, resultData, candidateIds, tournamentMeta) {
    if (candidateIds.includes(String(resultId))) return true;

    const resultName = normalizeTournamentText(resultData?.tournamentName || resultData?.name);
    const targetName = normalizeTournamentText(tournamentMeta?.name);
    if (!resultName || !targetName || resultName !== targetName) return false;

    const resultDates = normalizeTournamentText(resultData?.tournamentDates || resultData?.dates);
    const targetDates = normalizeTournamentText(tournamentMeta?.dates);
    if (resultDates && targetDates && resultDates !== targetDates) return false;

    const resultCourse = normalizeTournamentText(resultData?.tournamentCourse || resultData?.course);
    const targetCourse = normalizeTournamentText(tournamentMeta?.course);
    if (resultCourse && targetCourse && resultCourse !== targetCourse) return false;

    return true;
}

function summarizeResultForLeaderboard(profile, resultData, fallbackUsername) {
    const username = profile?.username || fallbackUsername;
    const fullName = profile?.full_name || resultData?.full_name || username;
    const photoUrl = profile?.photo_url || resultData?.photo_url || null;
    const rounds = [];
    let total = 0;
    let totalPar = 0;

    if (resultData?.scorecards) {
        Object.keys(resultData.scorecards)
            .sort((a, b) => Number(a) - Number(b))
            .forEach((roundKey) => {
                const card = resultData.scorecards[roundKey];
                let roundScore = 0;
                let roundPar = 0;

                for (let i = 0; i < 18; i += 1) {
                    const stroke = parseInt(card?.strokes?.[i], 10);
                    if (!Number.isFinite(stroke) || stroke <= 0) continue;

                    const holePar = parseInt(card?.pars?.[i], 10);
                    roundScore += stroke;
                    roundPar += Number.isFinite(holePar) && holePar > 0 ? holePar : 4;
                }

                if (roundScore > 0) {
                    rounds.push(roundScore);
                    total += roundScore;
                    totalPar += roundPar;
                }
            });
    }

    if (rounds.length === 0 && Array.isArray(resultData?.rounds)) {
        resultData.rounds.forEach((roundScore) => {
            const score = Number(roundScore);
            if (!Number.isFinite(score) || score <= 0) return;
            rounds.push(score);
            total += score;
        });
        const par = Number(resultData?.tournamentPar || resultData?.par || 72);
        totalPar = par * rounds.length;
    }
    const progress = getResultProgress(resultData);

    return {
        id: username,
        username,
        fullName,
        photo_url: photoUrl,
        total: total > 0 ? total : null,
        roundsPlayed: rounds.length,
        vspar: total > 0 ? total - totalPar : null,
        rounds,
        hasScore: total > 0,
        scorecards: resultData?.scorecards || null,
        tournamentPar: resultData?.tournamentPar || resultData?.par || null,
        status: progress.status,
        currentRound: progress.currentRound,
        currentHole: progress.currentHole,
        holesPlayed: progress.holesPlayed,
        progressLabel: progress.progressLabel,
        updatedAt: resultData?.updatedAt || resultData?.savedAt || null,
    };
}

function mergeParticipants(primaryParticipants, discoveredParticipants) {
    const byUsername = new Map();

    [...primaryParticipants, ...discoveredParticipants].forEach((participant) => {
        const username = participant?.username || participant?.id;
        if (!username) return;

        const previous = byUsername.get(username);
        if (!previous || (!previous.hasScore && participant.hasScore)) {
            byUsername.set(username, { ...previous, ...participant, username });
            return;
        }

        byUsername.set(username, {
            ...participant,
            ...previous,
            total: participant.hasScore ? participant.total : (previous.total || participant.total || null),
            roundsPlayed: participant.hasScore ? participant.roundsPlayed : (previous.roundsPlayed || participant.roundsPlayed || 0),
            vspar: participant.hasScore ? participant.vspar : (previous.vspar ?? participant.vspar ?? null),
            hasScore: Boolean(previous.hasScore || participant.hasScore),
            photo_url: previous.photo_url || participant.photo_url || null,
            scorecards: participant.scorecards || previous.scorecards || null,
            tournamentPar: participant.tournamentPar || previous.tournamentPar || null,
            status: participant.status || previous.status || 'pending',
            currentRound: participant.currentRound ?? previous.currentRound ?? null,
            currentHole: participant.currentHole ?? previous.currentHole ?? null,
            holesPlayed: participant.holesPlayed ?? previous.holesPlayed ?? 0,
            progressLabel: participant.progressLabel || previous.progressLabel || 'Pendiente',
        });
    });

    return Array.from(byUsername.values()).sort((a, b) => {
        if (a.hasScore && !b.hasScore) return -1;
        if (!a.hasScore && b.hasScore) return 1;
        if (!a.hasScore && !b.hasScore) return String(a.fullName || a.username).localeCompare(String(b.fullName || b.username));
        return (a.total || 999) - (b.total || 999);
    });
}

export default function PublicScorecardView() {
    const { username, id: eventId } = useParams();
    const canonicalEventId = resolveCanonicalTournamentId(eventId);
    const notificationIconUrl = `${import.meta.env.BASE_URL}pwa-192x192.png`;
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const queryRIdx = searchParams.get('r');
    const queryView = searchParams.get('view');

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
    const [activeRoundTab, setActiveRoundTab] = useState(null);
    const [activeViewTab, setActiveViewTab] = useState(queryView === 'scorecard' ? 'scorecard' : 'leaderboard'); // 'scorecard' | 'leaderboard'
    const [leaderboardParticipants, setLeaderboardParticipants] = useState([]);
    const [leaderboardLoading, setLeaderboardLoading] = useState(true);
    const [discoveredParticipants, setDiscoveredParticipants] = useState([]);
    const [leaderboardProfiles, setLeaderboardProfiles] = useState({});
    const [expandedParticipant, setExpandedParticipant] = useState(null);

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

    useEffect(() => {
        if (queryView === 'scorecard') {
            setActiveViewTab('scorecard');
        } else if (queryView === 'leaderboard') {
            setActiveViewTab('leaderboard');
        }
    }, [queryView, username, eventId]);
    
    // ── Derived Data Declarations (Pre-declared to avoid TDZ) ───────────────
    let tournamentInfo = null;
    let activeResult = null;
    let roundsKeys = [];
    let foundActiveRIdx = null;
    let activeHole = null;
    let activePar = null;
    let paceData = null;

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
            if (!profileReady) return;
            setError(null);
            let foundTournament = null;
            
            try {
                // 1. User's custom overrides (highest priority)
                for (const candidateId of getTournamentIdCandidates(canonicalEventId)) {
                    const customRef = getUserSubdocRef(db, userProfile || username, 'custom_tournaments', candidateId);
                    const customSnap = await getDoc(customRef);
                    if (customSnap.exists()) {
                        foundTournament = { id: customSnap.id, ...customSnap.data() };
                        break;
                    }
                }
            } catch { 
                /* ignore, likely permission error for guest */ 
            }

            if (!foundTournament) {
                try {
                    // 2. User's subscribed official/shared snapshot
                    for (const candidateId of getTournamentIdCandidates(canonicalEventId)) {
                        const subscribedRef = getUserSubdocRef(db, userProfile || username, 'subscribed_tournaments', candidateId);
                        const subscribedSnap = await getDoc(subscribedRef);
                        if (subscribedSnap.exists()) {
                            foundTournament = {
                                id: candidateId,
                                ...subscribedSnap.data(),
                            };
                            break;
                        }
                    }
                } catch {
                    /* ignore, likely permission error for guest */
                }
            }

            if (!foundTournament) {
                // 3. Local official JSON
                const localOfficial = tournamentsData.find((t) =>
                    getTournamentIdCandidates(t).includes(String(canonicalEventId))
                    || getTournamentIdCandidates(t).includes(String(eventId))
                );
                if (localOfficial) {
                    foundTournament = {
                        ...localOfficial,
                        id: canonicalEventId,
                    };
                }
            }

            if (!foundTournament) {
                try {
                    // 4. Firebase official tournaments collection
                    const docRef = doc(db, 'tournaments', canonicalEventId);
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
                setError(null);
            } else {
                // Last ditch effort: matches numeric ID even if string comparison failed
                const numericId = parseInt(canonicalEventId);
                if (!isNaN(numericId)) {
                    const altMatch = tournamentsData.find(t => t.id === numericId);
                    if (altMatch) {
                        setTournament(altMatch);
                        setError(null);
                        return;
                    }
                }
                setError(`Torneo no encontrado`);
            }
        };
        fetchTournament();
    }, [canonicalEventId, profileDocId, username, userProfile, profileReady]);

    useEffect(() => {
        if (!profileReady) return;

        const effectiveId = canonicalEventId;
        const resultRef = getUserSubdocRef(db, userProfile || username, 'results', effectiveId);
        
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
                                        body: msg, icon: notificationIconUrl
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
                        id: canonicalEventId,
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
                // FALLBACK LOGIC: If no results for legacy ID, try deterministic ID
                const isLegacyId = String(canonicalEventId) !== String(eventId);
                if (isLegacyId && tournament) {
                    const detId = generateTournamentDeterministicId(tournament);
                    if (detId !== canonicalEventId) {
                        const fallbackRef = getUserSubdocRef(db, userProfile || username, 'results', detId);
                        getDoc(fallbackRef).then(fallbackSnap => {
                            if (fallbackSnap.exists()) {
                                setResult(fallbackSnap.data());
                            } else {
                                setResult(null);
                            }
                        }).catch(() => setResult(null));
                    } else {
                        setResult(null);
                    }
                } else {
                    setResult(null);
                }
            }
            setLoading(false);
        }, (err) => {
            console.error("Error listening to results", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profileDocId, username, canonicalEventId, eventId, profileReady, tournament?.id]);

    // ── Public shared leaderboard for the same tournament ─────────────────
    useEffect(() => {
        if (!canonicalEventId) {
            setLeaderboardLoading(false);
            return undefined;
        }

        setLeaderboardLoading(true);
        const unsubscribe = subscribeToLeaderboard(canonicalEventId, (participants) => {
            setLeaderboardParticipants(participants);
            setLeaderboardLoading(false);
        });

        return () => unsubscribe();
    }, [canonicalEventId]);

    useEffect(() => {
        const tournamentMeta = {
            name: result?.tournamentName || tournament?.name || '',
            dates: result?.tournamentDates || tournament?.dates || '',
            course: result?.tournamentCourse || tournament?.course || '',
        };
        const candidateIds = Array.from(new Set([
            String(canonicalEventId),
            String(eventId),
            ...getTournamentIdCandidates(canonicalEventId),
            ...getTournamentIdCandidates(eventId),
        ].filter(Boolean)));

        if (!candidateIds.length && !tournamentMeta.name) {
            setDiscoveredParticipants([]);
            return undefined;
        }

        let cancelled = false;
        const unsubs = [];
        const byUsername = new Map();

        const publish = () => {
            if (!cancelled) setDiscoveredParticipants(Array.from(byUsername.values()));
        };

        const start = async () => {
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                if (cancelled) return;

                usersSnap.docs.forEach((userDoc) => {
                    const profile = { docId: userDoc.id, ...userDoc.data() };
                    const playerUsername = profile.username || userDoc.id;
                    const resultsRef = collection(db, 'users', userDoc.id, 'results');

                    const unsubscribe = onSnapshot(resultsRef, (snapshot) => {
                        let bestMatch = null;

                        snapshot.docs.forEach((resultDoc) => {
                            const resultData = resultDoc.data();
                            if (!resultMatchesTournament(resultDoc.id, resultData, candidateIds, tournamentMeta)) return;

                            const participant = summarizeResultForLeaderboard(profile, resultData, playerUsername);
                            if (!bestMatch || (participant.total || 0) > (bestMatch.total || 0)) {
                                bestMatch = participant;
                            }
                        });

                        if (bestMatch) {
                            byUsername.set(playerUsername, bestMatch);
                        } else {
                            byUsername.delete(playerUsername);
                        }

                        publish();
                    }, (err) => {
                        console.warn('[live leaderboard] Could not read user results:', playerUsername, err.code || err.message);
                    });

                    unsubs.push(unsubscribe);
                });
            } catch (err) {
                console.warn('[live leaderboard] Could not discover active players:', err.code || err.message);
                publish();
            }
        };

        start();

        return () => {
            cancelled = true;
            unsubs.forEach((unsubscribe) => unsubscribe());
        };
    }, [
        canonicalEventId,
        eventId,
        result?.tournamentName,
        result?.tournamentDates,
        result?.tournamentCourse,
        tournament?.name,
        tournament?.dates,
        tournament?.course,
    ]);

    useEffect(() => {
        const usernames = Array.from(new Set(
            [...leaderboardParticipants, ...discoveredParticipants]
                .map((participant) => participant?.username || participant?.id)
                .filter(Boolean)
        )).filter((participantUsername) => !leaderboardProfiles[participantUsername]);

        if (usernames.length === 0) return undefined;

        let cancelled = false;

        Promise.all(usernames.map(async (participantUsername) => {
            const profile = await fetchUserProfileByUsername(db, participantUsername);
            return [participantUsername, profile];
        })).then((entries) => {
            if (cancelled) return;

            setLeaderboardProfiles((previousProfiles) => {
                const nextProfiles = { ...previousProfiles };
                entries.forEach(([participantUsername, profile]) => {
                    if (profile) {
                        nextProfiles[participantUsername] = profile;
                    }
                });
                return nextProfiles;
            });
        }).catch((err) => {
            console.warn('[live leaderboard] Could not enrich participant profiles:', err.code || err.message);
        });

        return () => {
            cancelled = true;
        };
    }, [leaderboardParticipants, discoveredParticipants, leaderboardProfiles]);

    // Synchronize selected tab with detected round if not set
    useEffect(() => {
        if (activeRoundTab === null && foundActiveRIdx !== null) {
            setActiveRoundTab(foundActiveRIdx);
        }
    }, [foundActiveRIdx]);

    // ── Update derived data BEFORE conditional returns ──────────────────────
    
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

    tournamentInfo = tournament || (result?.tournamentName ? {
        id: canonicalEventId,
        name: result.tournamentName,
        course: result.tournamentCourse || '',
        dates: result.tournamentDates || '',
        par: result.tournamentPar || result.par || null
    } : null);

    if (tournamentInfo) {
        activeResult = result || {
            tournamentName: tournamentInfo.name,
            tournamentCourse: tournamentInfo.course || '',
            tournamentDates: tournamentInfo.dates || '',
            tournamentPar: tournamentInfo.par || null,
            scorecards: {},
            rounds: {}
        };

        if (activeResult) {
            // Ensure essential properties exist
            if (!activeResult.scorecards) activeResult.scorecards = {};
            if (!activeResult.rounds) activeResult.rounds = {};
            const dateInfo = parseDateHelper(activeResult.tournamentDates || tournament?.dates || '');
            const maxRounds = dateInfo.days;
            const allPossibleKeys = new Set(Object.keys(activeResult.scorecards || {}));
            for (let i = 0; i < maxRounds; i++) allPossibleKeys.add(String(i));
            roundsKeys = Array.from(allPossibleKeys).sort((a, b) => parseInt(a) - parseInt(b));
            
            if (activeRoundTab !== null && roundsKeys.includes(String(activeRoundTab))) {
                foundActiveRIdx = String(activeRoundTab);
            }
            if (foundActiveRIdx === null) {
                const requestedR = queryRIdx !== null ? queryRIdx : searchParams.get('round');
                if (requestedR !== null) {
                    const match = roundsKeys.find(rk => String(rk) === String(requestedR));
                    if (match) foundActiveRIdx = match;
                }
            }
            if (foundActiveRIdx === null) {
                for (let i = roundsKeys.length - 1; i >= 0; i--) {
                    const rIdx = roundsKeys[i];
                    const card = activeResult?.scorecards?.[rIdx];
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
            if (foundActiveRIdx === null) {
                for (let i = roundsKeys.length - 1; i >= 0; i--) {
                    const rIdx = roundsKeys[i];
                    const card = activeResult?.scorecards?.[rIdx];
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
            if (foundActiveRIdx === null && roundsKeys.length > 0) {
                foundActiveRIdx = roundsKeys[0];
            }

            if (foundActiveRIdx !== null) {
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
    }

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
    const hasRoundResult = (participant, roundIdx) => {
        if (roundIdx === null || roundIdx === undefined) {
            return Boolean(participant.hasScore) || Number(participant.total) > 0 || Number(participant.roundsPlayed) > 0;
        }

        const roundScore = Number(participant.rounds?.[Number(roundIdx)]);
        if (Number.isFinite(roundScore) && roundScore > 0) return true;

        const card = participant.scorecards?.[String(roundIdx)];
        return Array.isArray(card?.strokes) && card.strokes.some((stroke) => {
            const value = String(stroke || '').trim();
            return value !== '' && value !== '-' && value !== '0';
        });
    };
    const getTodayRoundIndex = (dates) => {
        const parts = String(dates || '').split(' - ');
        const parse = (value) => {
            const [day, month, year] = String(value || '').split('/').map(Number);
            if (!day || !month || !year) return null;
            return new Date(year, month - 1, day).setHours(0, 0, 0, 0);
        };
        const start = parse(parts[0]);
        if (!start) return null;
        const end = parse(parts[1]) || start;
        const today = new Date().setHours(0, 0, 0, 0);
        if (today < start || today > end) return null;
        return String(Math.floor((today - start) / (24 * 60 * 60 * 1000)));
    };
    const todayRoundIndex = getTodayRoundIndex(activeResult?.tournamentDates || tournament?.dates);
    const rawActiveLeaderboardRound = queryRIdx !== null
        ? String(queryRIdx)
        : activeRoundTab !== null
            ? String(activeRoundTab)
            : todayRoundIndex !== null
                ? todayRoundIndex
                : foundActiveRIdx !== null && foundActiveRIdx !== undefined
                    ? String(foundActiveRIdx)
                    : null;
    const activeLeaderboardRoundNumber = rawActiveLeaderboardRound !== null ? Number(rawActiveLeaderboardRound) : null;
    const activeLeaderboardRound = Number.isFinite(activeLeaderboardRoundNumber)
        ? String(activeLeaderboardRoundNumber)
        : null;
    const displayedLeaderboardParticipants = mergeParticipants(leaderboardParticipants, discoveredParticipants)
        .map((participant) => {
            const profile = leaderboardProfiles[participant.username] || {};
            const fullName = participant.fullName || profile.full_name || profile.username || participant.username;
            const enrichedParticipant = { ...participant, fullName };
            return {
                ...enrichedParticipant,
                photo_url: participant.photo_url || profile.photo_url || getKnownProfilePhotoUrl(enrichedParticipant),
            };
        })
        .sort((a, b) => {
            const aHasRound = hasRoundResult(a, activeLeaderboardRound);
            const bHasRound = hasRoundResult(b, activeLeaderboardRound);
            if (aHasRound && !bHasRound) return -1;
            if (!aHasRound && bHasRound) return 1;
            if (!aHasRound && !bHasRound) {
                return String(a.fullName || a.username).localeCompare(String(b.fullName || b.username));
            }
            return Number(a.total || 999) - Number(b.total || 999);
        });
    const rankedLeaderboardParticipants = displayedLeaderboardParticipants.filter((participant) => (
        hasRoundResult(participant, activeLeaderboardRound)
    ));
    const renderParticipantHoleScores = (participant) => {
        const scorecards = participant?.scorecards || {};
        const roundEntries = Object.keys(scorecards)
            .sort((a, b) => Number(a) - Number(b))
            .map((roundKey) => [roundKey, scorecards[roundKey]])
            .filter(([, card]) => Array.isArray(card?.strokes) && card.strokes.some((stroke) => {
                const value = String(stroke || '');
                return value !== '' && value !== '-' && value !== '0';
            }));

        if (roundEntries.length === 0) {
            return (
                <div style={{ padding: '18px 16px', color: '#94a3b8', fontWeight: '700' }}>
                    Todavia no hay puntuacion por hoyos para esta jugadora.
                </div>
            );
        }

        return (
            <div style={{ padding: '14px', background: '#111827', borderTop: '1px solid #334155', borderBottom: '1px solid #334155' }}>
                {roundEntries.map(([roundKey, card]) => {
                    let totalStrokes = 0;
                    let totalPar = 0;
                    let holesPlayed = 0;

                    for (let i = 0; i < 18; i += 1) {
                        const stroke = parseInt(card.strokes?.[i], 10);
                        if (!Number.isFinite(stroke) || stroke <= 0) continue;
                        const par = parseInt(card.pars?.[i], 10);
                        totalStrokes += stroke;
                        totalPar += Number.isFinite(par) && par > 0 ? par : 4;
                        holesPlayed += 1;
                    }

                    const diff = holesPlayed > 0 ? totalStrokes - totalPar : null;
                    const diffLabel = diff === null ? '-' : diff > 0 ? `+${diff}` : diff === 0 ? 'E' : String(diff);
                    const diffColor = diff === null ? '#94a3b8' : diff <= 0 ? '#10b981' : '#ef4444';

                    return (
                        <div key={roundKey} style={{ marginBottom: '12px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                color: '#e2e8f0',
                                fontWeight: '900',
                                marginBottom: '8px',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                fontSize: '0.72rem'
                            }}>
                                <span>Ronda {Number(roundKey) + 1} · {holesPlayed} hoyo{holesPlayed === 1 ? '' : 's'}</span>
                                <span>{totalStrokes || '-'} <span style={{ color: diffColor }}>({diffLabel})</span></span>
                            </div>

                            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                <div style={{ minWidth: '720px', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(18, 1fr)', background: '#0f172a', color: '#94a3b8', fontSize: '0.68rem', fontWeight: '900' }}>
                                        <div style={{ padding: '8px', borderRight: '1px solid #334155' }}>HOYO</div>
                                        {Array.from({ length: 18 }, (_, i) => (
                                            <div key={i} style={{ padding: '8px 4px', textAlign: 'center', borderRight: i < 17 ? '1px solid #334155' : 'none' }}>{i + 1}</div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(18, 1fr)', background: '#1e293b', color: '#cbd5e1', fontSize: '0.72rem' }}>
                                        <div style={{ padding: '8px', borderTop: '1px solid #334155', borderRight: '1px solid #334155', fontWeight: '900' }}>PAR</div>
                                        {Array.from({ length: 18 }, (_, i) => (
                                            <div key={i} style={{ padding: '8px 4px', textAlign: 'center', borderTop: '1px solid #334155', borderRight: i < 17 ? '1px solid #334155' : 'none' }}>{card.pars?.[i] || '-'}</div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(18, 1fr)', background: '#24324a', color: 'white', fontSize: '0.82rem', fontWeight: '900' }}>
                                        <div style={{ padding: '8px', borderTop: '1px solid #1e293b', borderRight: '1px solid #1e293b' }}>GOLPES</div>
                                        {Array.from({ length: 18 }, (_, i) => {
                                            const stroke = card.strokes?.[i] || '';
                                            const par = parseInt(card.pars?.[i], 10) || 0;
                                            const scoreNum = parseInt(stroke, 10);
                                            const isValidScore = stroke !== '' && stroke !== '-' && Number.isFinite(scoreNum) && scoreNum > 0;
                                            const bgColor = isValidScore ? getScoreColor(scoreNum, par) : 'transparent';

                                            return (
                                                <div key={i} style={{ padding: '6px 2px', textAlign: 'center', borderTop: '1px solid #1e293b', borderRight: i < 17 ? '1px solid #1e293b' : 'none', display: 'flex', justifyContent: 'center' }}>
                                                    <span style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        borderRadius: bgColor !== 'transparent' && scoreNum - par <= 0 ? '50%' : '4px',
                                                        background: bgColor,
                                                        color: isValidScore ? 'white' : '#64748b'
                                                    }}>
                                                        {stroke === '-' ? '' : stroke}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };
    // Once tournamentInfo is available, render immediately.
    // This ensures users always see the scorecard structure right away.
    if (!tournamentInfo && !error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', background: '#0f172a' }}>
                 <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #334155', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }} />
                    <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>{t.loading}</p>
                 </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'white' }}>
                <h2>Ups!</h2>
                <p>{error}</p>
                <Link to="/" style={{ color: '#3b82f6' }}>Volver a la App</Link>
            </div>
        );
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
                                username={username}
                                displayName={userProfile?.full_name || username}
                                alt={username}
                                style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #3b82f6', objectFit: 'cover' }}
                            />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'livePulse 1.5s infinite' }}></div>
                                    {result ? t.live : 'ESPERANDO INICIO...'}
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', lineHeight: '1.1' }}>
                                    {userProfile?.full_name || activeResult?.full_name || username}
                                </div>
                                {(userProfile?.club || activeResult?.club) && (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {userProfile?.club || activeResult?.club}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* VIEW TABS: Scorecard vs Leaderboard */}
                        <div style={{ 
                            display: 'flex', 
                            background: '#0f172a', 
                            padding: '4px', 
                            borderRadius: '10px', 
                            margin: '10px auto',
                            maxWidth: '300px',
                            border: '1px solid #334155'
                        }}>
                            <button 
                                onClick={() => setActiveViewTab('scorecard')}
                                style={{ 
                                    flex: 1, 
                                    padding: '8px', 
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: activeViewTab === 'scorecard' ? '#3b82f6' : 'transparent',
                                    color: activeViewTab === 'scorecard' ? 'white' : '#64748b',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >MI VUELTA</button>
                            <button 
                                onClick={() => setActiveViewTab('leaderboard')}
                                style={{ 
                                    flex: 1, 
                                    padding: '8px', 
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: activeViewTab === 'leaderboard' ? '#3b82f6' : 'transparent',
                                    color: activeViewTab === 'leaderboard' ? 'white' : '#64748b',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >CLASIFICACIÓN</button>
                        </div>
                        <h1 style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>
                            {activeResult?.tournamentName || tournament?.name}
                        </h1>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <MapPin size={10} /> {activeResult?.tournamentCourse || tournament?.course}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
                            {roundsKeys.map((rk) => {
                                const isActive = String(rk) === String(foundActiveRIdx);
                                const card = activeResult?.scorecards?.[rk];
                                const hasData = card && Object.values(card.strokes || {}).some(s => s !== '' && s !== '-');
                                return (
                                    <button
                                        key={rk}
                                        onClick={() => setActiveRoundTab(rk)}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '15px',
                                            border: isActive ? '1px solid #3b82f6' : '1px solid #334155',
                                            background: isActive ? '#3b82f6' : (hasData ? '#1e293b' : 'transparent'),
                                            color: isActive ? 'white' : (hasData ? '#cbd5e1' : '#64748b'),
                                            fontSize: '0.8rem',
                                            fontWeight: isActive ? 'bold' : 'normal',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        R{parseInt(rk) + 1}
                                    </button>
                                );
                            })}
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

            {activeViewTab === 'scorecard' ? (
                <div style={{ padding: '0.5rem 0.6rem' }}>
                    {/* Active Hole & Pace Card */}
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

                            {/* Previous Rounds Comparison */}
                            {(() => {
                                const prevScores = roundsKeys
                                    .filter(rk => String(rk) !== String(foundActiveRIdx))
                                    .map(rk => {
                                        const s = activeResult.scorecards[rk]?.strokes?.[activeHole - 1];
                                        if (s && s !== '-' && s !== '') return { round: parseInt(rk) + 1, score: s, par: activeResult.scorecards[rk]?.pars?.[activeHole - 1] };
                                        return null;
                                    })
                                    .filter(Boolean);

                                if (prevScores.length > 0) {
                                    return (
                                        <div style={{ borderTop: '1px solid #475569', paddingTop: '8px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                            {prevScores.map(ps => {
                                                const diff = parseInt(ps.score) - (parseInt(ps.par) || activePar);
                                                const sColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#cbd5e1';
                                                return (
                                                    <div key={ps.round} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <span style={{ color: '#94a3b8' }}>R{ps.round}:</span>
                                                        <span style={{ fontWeight: 'bold', color: sColor }}>{ps.score}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }
                                return null;
                            })()}

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
                                const card = activeResult?.scorecards?.[rIdx];
                                if (!card) return;
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
                            }
                            // If it's a partial round, we KEEP the exact sum of the pars of the holes played 
                            // (which is already in cumulativePar) instead of scaling proportionally.

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
                                const card = activeResult?.scorecards?.[rIdx];

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

                                const manualStrokesTotal = activeResult?.rounds?.[roundStr];
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
                                        }
                                        // If not 18 holes, DO NOT scale proportionally. Use exact playedPar!
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
                                                    {(activeResult.track_putts || tournament?.track_putts) && (
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
                                                    {(activeResult.track_girs || tournament?.track_girs) && (
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
                                                    {(activeResult.track_putts || tournament?.track_putts) && (
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
                                                    {(activeResult.track_girs || tournament?.track_girs) && (
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
                </div>
            ) : (
                /* ── LEADERBOARD VIEW ── */
                <div style={{ padding: '0.8rem', animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '34px minmax(136px, 1fr) 52px 44px 48px',
                            background: '#0f172a',
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            fontSize: '0.65rem',
                            letterSpacing: '0.1em',
                            fontWeight: '800'
                        }}>
                            <div style={{ padding: '12px 6px' }}>POS</div>
                            <div style={{ padding: '12px 8px' }}>JUGADORA</div>
                            <div style={{ padding: '12px 4px', textAlign: 'center' }}>HOYO</div>
                            <div style={{ padding: '12px 4px', textAlign: 'center' }}>TOT</div>
                            <div style={{ padding: '12px 6px', textAlign: 'right' }}>PAR</div>
                        </div>

                        {leaderboardLoading ? (
                            <div style={{ padding: '36px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: '700' }}>
                                Cargando clasificación conjunta...
                            </div>
                        ) : displayedLeaderboardParticipants.length === 0 ? (
                            <div style={{ padding: '36px 14px', textAlign: 'center', color: '#94a3b8' }}>
                                <div style={{ fontWeight: '800', color: '#e2e8f0', marginBottom: '6px' }}>Sin jugadoras apuntadas todavía</div>
                                <div style={{ fontSize: '0.8rem' }}>Cuando alguien se apunte o guarde resultado, aparecerá aquí.</div>
                            </div>
                        ) : (
                            displayedLeaderboardParticipants.map((participant, idx) => {
                                const hasActiveRoundResult = hasRoundResult(participant, activeLeaderboardRound);
                                const rankedIndex = rankedLeaderboardParticipants.findIndex((candidate) => (
                                    (candidate.username || candidate.id) === (participant.username || participant.id)
                                ));
                                const position = rankedIndex + 1;
                                const relative = participant.vspar;
                                const relativeStr = relative === null || relative === undefined
                                    ? '-'
                                    : relative > 0 ? `+${relative}` : (relative === 0 ? 'E' : relative);
                                const relativeColor = relative === null || relative === undefined
                                    ? '#94a3b8'
                                    : relative <= 0 ? '#10b981' : '#ef4444';
                                const isCurrent = participant.username === username;
                                const isExpanded = expandedParticipant === participant.username;
                                const progressLabel = participant.progressLabel || (participant.hasScore ? 'Finalizada' : 'Pendiente');
                                const progressColor = participant.status === 'in_progress'
                                    ? '#60a5fa'
                                    : participant.status === 'finished' && hasActiveRoundResult ? '#10b981' : '#94a3b8';
                                const activeRoundLabel = activeLeaderboardRound === null
                                    ? null
                                    : `R${Number(activeLeaderboardRound) + 1}`;
                                const secondaryLabel = !hasActiveRoundResult
                                    ? (activeRoundLabel ? `Sin resultados ${activeRoundLabel}` : 'Sin resultados')
                                    : participant.status === 'in_progress' && Number(participant.holesPlayed) > 0
                                    ? `${participant.holesPlayed} hoyo${participant.holesPlayed === 1 ? '' : 's'} jugado${participant.holesPlayed === 1 ? '' : 's'}`
                                    : participant.roundsPlayed > 0 ? `${participant.roundsPlayed} vuelta${participant.roundsPlayed === 1 ? '' : 's'}` : 'Pendiente';
                                const displayedProgressLabel = hasActiveRoundResult ? progressLabel : '—';

                                return (
                                    <React.Fragment key={participant.id || participant.username}>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setExpandedParticipant(isExpanded ? null : participant.username)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    setExpandedParticipant(isExpanded ? null : participant.username);
                                                }
                                            }}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '34px minmax(136px, 1fr) 52px 44px 48px',
                                                alignItems: 'center',
                                                borderBottom: isExpanded ? '1px solid #1d4ed8' : '1px solid #334155',
                                                background: isExpanded ? '#1d4ed855' : (isCurrent ? '#1e3a8a44' : 'transparent'),
                                                color: 'inherit',
                                                textDecoration: 'none',
                                                cursor: 'pointer',
                                                outline: 'none'
                                            }}
                                            title={`Ver puntuacion por hoyos de ${participant.fullName || participant.username}`}
                                        >
                                            <div style={{
                                                padding: '14px 6px',
                                                fontWeight: '900',
                                                color: !hasActiveRoundResult ? '#64748b' : (position === 1 ? '#eab308' : (position === 2 ? '#cbd5e1' : (position === 3 ? '#f97316' : '#64748b')))
                                            }}>
                                                {hasActiveRoundResult ? position : '—'}
                                            </div>
                                            <div style={{ padding: '12px 8px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <ProfileImage
                                                    photoPath={participant.photo_url}
                                                    username={participant.username}
                                                    displayName={participant.fullName || participant.username}
                                                    alt={participant.fullName || participant.username}
                                                    style={{
                                                        width: '30px',
                                                        height: '30px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                        border: isExpanded || isCurrent ? '2px solid #3b82f6' : '1px solid #334155',
                                                        flexShrink: 0
                                                    }}
                                                />
                                                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                                                    <div style={{
                                                        fontWeight: '800',
                                                        color: isCurrent || isExpanded ? '#bfdbfe' : 'white',
                                                        whiteSpace: 'normal',
                                                        overflow: 'hidden',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        lineHeight: 1.05,
                                                        fontSize: '0.92rem'
                                                    }}>
                                                        {participant.fullName || participant.username}
                                                    </div>
                                                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase', lineHeight: 1.15, marginTop: '3px' }}>
                                                        {isExpanded ? 'Ocultar hoyos' : secondaryLabel}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{
                                                padding: '14px 4px',
                                                textAlign: 'center',
                                                fontWeight: '900',
                                                color: hasActiveRoundResult ? progressColor : '#94a3b8',
                                                fontSize: hasActiveRoundResult ? '0.68rem' : '0.9rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.02em',
                                                lineHeight: 1.05,
                                                overflowWrap: 'anywhere'
                                            }}>
                                                {displayedProgressLabel}
                                            </div>
                                            <div style={{ padding: '14px 4px', textAlign: 'center', fontWeight: '900', color: '#e2e8f0' }}>
                                                {hasActiveRoundResult ? (participant.total || '-') : '-'}
                                            </div>
                                            <div style={{ padding: '14px 6px', textAlign: 'right', fontWeight: '900', color: relativeColor }}>
                                                {hasActiveRoundResult ? relativeStr : '-'}
                                            </div>
                                        </div>
                                        {isExpanded && renderParticipantHoleScores(participant)}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
