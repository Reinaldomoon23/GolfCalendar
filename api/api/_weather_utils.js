import { cert, getApps, initializeApp } from 'firebase-admin/app';

export const PROJECT_ID = 'golfscorings-e4338';
export const TIME_ZONE = 'Europe/Madrid';

export function parseServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (rawJson) return JSON.parse(rawJson);
  if (rawBase64) return JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8'));
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  return null;
}

export function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw new Error('Firebase Admin no esta configurado en el servidor.');
  }

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || PROJECT_ID,
  });
}

export function sendJson(res, status, payload) {
  return res.status(status).json(payload);
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getMadridParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    dateIso: `${parts.year}-${parts.month}-${parts.day}`,
    hour: String(parts.hour || '00').padStart(2, '0'),
  };
}

export function parseTournamentRange(tournament = {}) {
  const dates = String(tournament.dates || tournament.date || '').trim();
  const parseSlashDate = (value) => {
    const [day, month, year] = String(value || '').trim().split('/');
    if (!day || !month || !year) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  if (dates) {
    const [startRaw, endRaw] = dates.split(' - ');
    const startIso = parseSlashDate(startRaw);
    if (startIso) {
      return {
        startIso,
        endIso: parseSlashDate(endRaw || startRaw) || startIso,
      };
    }
  }

  const idMatch = String(tournament.id || '').match(/tt_v2__(\d{4}-\d{2}-\d{2})__(\d{4}-\d{2}-\d{2})__/);
  if (idMatch) {
    return { startIso: idMatch[1], endIso: idMatch[2] };
  }

  return { startIso: null, endIso: null };
}

export function isTournamentActiveToday(tournament, dateIso) {
  const { startIso, endIso } = parseTournamentRange(tournament);
  return Boolean(startIso && endIso && dateIso >= startIso && dateIso <= endIso);
}

const KNOWN_LOCATIONS = [
  { tokens: ['la manga', 'campo sur'], latitude: 37.6047, longitude: -0.8068, label: 'La Manga Campo Sur' },
  { tokens: ['real la manga'], latitude: 37.6047, longitude: -0.8068, label: 'La Manga Campo Sur' },
  { tokens: ['la serena'], latitude: 37.7447, longitude: -0.8407, label: 'La Serena Golf' },
  { tokens: ['sant cugat'], latitude: 41.4694, longitude: 2.0838, label: 'Golf Sant Cugat' },
  { tokens: ['camiral'], latitude: 41.8736, longitude: 2.7445, label: 'Camiral Golf & Wellness' },
  { tokens: ['stadium'], latitude: 41.8736, longitude: 2.7445, label: 'Camiral Stadium' },
  { tokens: ['tour'], latitude: 41.8736, longitude: 2.7445, label: 'Camiral Tour' },
  { tokens: ['llavaneras'], latitude: 41.5556, longitude: 2.4998, label: 'Club de Golf Llavaneras' },
  { tokens: ['peralada'], latitude: 42.3092, longitude: 3.0092, label: 'Peralada Golf' },
  { tokens: ['costa brava'], latitude: 41.8394, longitude: 2.9543, label: 'Club de Golf Costa Brava' },
  { tokens: ['fontanals'], latitude: 42.3917, longitude: 1.9151, label: 'Fontanals Golf Club' },
  { tokens: ['barcelona'], latitude: 41.5932, longitude: 1.8844, label: 'Barcelona Golf' },
  { tokens: ['costa daurada'], latitude: 41.1449, longitude: 1.2443, label: 'Golf Costa Daurada' },
];

export function resolveTournamentLocation(tournament = {}) {
  const lat = Number(tournament.latitude ?? tournament.lat);
  const lon = Number(tournament.longitude ?? tournament.lng ?? tournament.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      latitude: lat,
      longitude: lon,
      label: tournament.location || tournament.course || tournament.name || 'Campo',
      source: 'tournament_coordinates',
    };
  }

  const haystack = normalizeText([
    tournament.course,
    tournament.location,
    tournament.venue,
    tournament.name,
    tournament.id,
  ].filter(Boolean).join(' '));

  const found = KNOWN_LOCATIONS.find((item) => item.tokens.every((token) => haystack.includes(token)));
  if (!found) return null;

  return {
    latitude: found.latitude,
    longitude: found.longitude,
    label: found.label,
    source: 'known_course_map',
  };
}

export function windDirectionFromDegrees(value) {
  const deg = Number(value);
  if (!Number.isFinite(deg)) return '';
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return labels[Math.round(deg / 45) % 8];
}
