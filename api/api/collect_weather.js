import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  getAdminApp,
  getMadridParts,
  isTournamentActiveToday,
  resolveTournamentLocation,
  sendJson,
  windDirectionFromDegrees,
} from './_weather_utils.js';

function isAuthorized(req) {
  const configuredSecret = process.env.CRON_SECRET;
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const querySecret = String(req.query?.secret || '').trim();

  if (configuredSecret) {
    return token === configuredSecret || querySecret === configuredSecret;
  }

  return String(req.headers['user-agent'] || '').includes('vercel-cron/1.0')
    || Boolean(req.headers['x-vercel-cron-schedule']);
}

async function loadTournamentDocs(db) {
  const [officialSnap, sharedSnap] = await Promise.all([
    db.collection('tournaments').get(),
    db.collection('shared_tournaments').get(),
  ]);

  const byId = new Map();
  [officialSnap, sharedSnap].forEach((snapshot) => {
    snapshot.docs.forEach((doc) => {
      byId.set(String(doc.id), { id: String(doc.id), ...doc.data() });
    });
  });
  return Array.from(byId.values());
}

async function fetchCurrentWeather(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    wind_speed_unit: 'kmh',
    timezone: 'Europe/Madrid',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo ha respondido ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.current) {
    throw new Error('Open-Meteo no ha devuelto datos actuales.');
  }
  return payload.current;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-vercel-cron-schedule');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'Metodo no permitido.' });
  if (!isAuthorized(req)) return sendJson(res, 401, { error: 'No autorizado.' });

  try {
    getAdminApp();
    const db = getFirestore();
    const { dateIso, hour } = getMadridParts();
    const tournaments = await loadTournamentDocs(db);
    const activeTournaments = tournaments.filter((tournament) => isTournamentActiveToday(tournament, dateIso));

    const collected = [];
    const skipped = [];
    const errors = [];

    for (const tournament of activeTournaments) {
      const location = resolveTournamentLocation(tournament);
      if (!location) {
        skipped.push({ id: tournament.id, reason: 'sin_coordenadas', course: tournament.course || tournament.location || tournament.name || '' });
        continue;
      }

      try {
        const current = await fetchCurrentWeather(location);
        const docId = `${dateIso}_${hour}`;
        const windDirectionDeg = Number(current.wind_direction_10m);
        const sample = {
          tournamentId: String(tournament.id),
          tournamentName: tournament.name || '',
          course: tournament.course || tournament.location || location.label,
          location: location.label,
          locationSource: location.source,
          latitude: location.latitude,
          longitude: location.longitude,
          dateIso,
          hour,
          sampledAtIso: current.time || new Date().toISOString(),
          temperatureC: Number(current.temperature_2m),
          humidity: Number(current.relative_humidity_2m),
          windKmh: Number(current.wind_speed_10m),
          windGustKmh: Number(current.wind_gusts_10m),
          windDirectionDeg,
          windDirection: windDirectionFromDegrees(windDirectionDeg),
          source: 'open-meteo',
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        };

        await db.collection('tournaments').doc(String(tournament.id)).collection('weather_samples').doc(docId).set(sample, { merge: true });
        collected.push({ id: tournament.id, docId, location: location.label, windKmh: sample.windKmh });
      } catch (error) {
        errors.push({ id: tournament.id, message: error.message });
      }
    }

    return sendJson(res, 200, {
      ok: errors.length === 0,
      dateIso,
      hour,
      checked: tournaments.length,
      active: activeTournaments.length,
      collected,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('[collect_weather] Error:', error);
    return sendJson(res, 500, { error: error.message || 'Error recogiendo datos meteorologicos.' });
  }
}
