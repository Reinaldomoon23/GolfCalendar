import { API_ENDPOINTS, API_TIMEOUT } from '../config/api';

export async function fetchTournamentWeatherSamples(tournamentId) {
  const cleanId = String(tournamentId || '').trim();
  if (!cleanId) return [];

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const url = new URL(API_ENDPOINTS.weatherSamples);
    url.searchParams.set('tournamentId', cleanId);
    const response = await fetch(url.toString(), { signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'No se pudo cargar la meteorologia del torneo.');
    }
    return Array.isArray(payload.samples) ? payload.samples : [];
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.warn('[weather] No se pudieron cargar las muestras meteorologicas:', error);
    }
    return [];
  } finally {
    window.clearTimeout(timeout);
  }
}
