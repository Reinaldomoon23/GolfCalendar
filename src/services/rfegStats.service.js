import { auth } from '../firebase';
import { API_ENDPOINTS } from '../config/api';

async function credentialsRequest(action, data = {}) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Inicia sesión en RoundTracker para conectar RFEGStats.');

    const token = await currentUser.getIdToken();
    const response = await fetch(API_ENDPOINTS.rfegStatsCredentials, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...data }),
        signal: AbortSignal.timeout(30000),
    });

    let result = {};
    try {
        result = await response.json();
    } catch {
        // Use the status-based message below when the server returns non-JSON.
    }
    if (!response.ok) {
        throw new Error(result.error || 'No se pudo contactar con el servicio RFEGStats.');
    }
    return result;
}

export function getRfegStatsConnectionStatus() { return credentialsRequest('status'); }
export function saveRfegStatsCredentials(username, password) { return credentialsRequest('save', { username, password }); }
export function deleteRfegStatsCredentials() { return credentialsRequest('delete'); }

export function getRfegStatsCatalog(clubId = '') {
    return credentialsRequest('catalog', clubId ? { clubId } : {});
}

export function saveRfegCourseMapping(mapping) {
    return credentialsRequest('saveCourseMapping', mapping);
}

export async function transferRfegStatsRound(round) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Inicia sesión en RoundTracker para transferir a RFEGStats.');
    const token = await currentUser.getIdToken();
    const response = await fetch(API_ENDPOINTS.rfegStatsTransfer, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ round, confirmed: true }),
        signal: AbortSignal.timeout(120000),
    });
    let result = {};
    try { result = await response.json(); } catch { /* handled through status */ }
    if (!response.ok) {
        const error = new Error(result.error || 'No se pudo completar la transferencia a RFEGStats.');
        error.reviewRequired = Boolean(result.reviewRequired);
        throw error;
    }
    return result;
}
