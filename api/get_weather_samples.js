import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp, sendJson } from './_weather_utils.js';

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 500;
  return Math.min(Math.floor(parsed), 1000);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Metodo no permitido.' });

  const tournamentId = String(req.query?.tournamentId || '').trim();
  if (!tournamentId) {
    return sendJson(res, 400, { error: 'Falta tournamentId.' });
  }

  try {
    getAdminApp();
    const db = getFirestore();
    const limit = normalizeLimit(req.query?.limit);
    const snapshot = await db.collection('tournaments').doc(tournamentId).collection('weather_samples').limit(limit).get();
    const samples = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.sampledAtIso || a.id).localeCompare(String(b.sampledAtIso || b.id)));

    return sendJson(res, 200, {
      ok: true,
      tournamentId,
      count: samples.length,
      samples,
    });
  } catch (error) {
    console.error('[get_weather_samples] Error:', error);
    return sendJson(res, 500, { error: error.message || 'Error leyendo meteorologia del torneo.' });
  }
}
