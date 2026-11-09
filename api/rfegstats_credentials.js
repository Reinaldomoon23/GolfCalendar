import {
  assertRfegEncryptionConfigured,
  createRfegStatsSession,
  decryptRfegCredentials,
  encryptRfegCredentials,
  getRfegAdminServices,
  rfegRequest,
  validateRfegStatsLogin,
  verifyRfegRequestUser,
} from './_rfegstats_server.js';
import { load } from 'cheerio';

function json(res, status, payload) {
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido.' });

  try {
    const decoded = await verifyRfegRequestUser(req.headers.authorization);
    const { db } = getRfegAdminServices();
    const credentialRef = db.collection('users').doc(decoded.uid).collection('integrations').doc('rfegstats');
    const action = String(req.body?.action || '');

    if (action === 'catalog') {
      const savedSnapshot = await credentialRef.get();
      if (!savedSnapshot.exists) return json(res, 409, { error: 'Conecta primero tu cuenta RFEGStats.' });
      const credentials = decryptRfegCredentials(savedSnapshot.data());
      const session = await createRfegStatsSession(credentials.username, credentials.password);
      const roundForm = await rfegRequest(session, '/entrenamiento/new');
      if (!roundForm.ok) return json(res, 502, { error: 'RFEGStats no ha devuelto el formulario de nueva ronda.' });

      const $ = load(await roundForm.text());
      const clubs = $('select[name="entrenamiento[id_club]"] option')
        .map((_, option) => ({ id: String($(option).attr('value') || ''), name: $(option).text().trim() }))
        .get()
        .filter((option) => option.id && option.name);
      const mappingSnapshot = await credentialRef.collection('course_mappings').get();
      const courseMappings = mappingSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (!clubs.length) {
        return json(res, 422, { error: 'No se pudo leer el catálogo de clubes de RFEGStats con esta cuenta.' });
      }

      const clubId = String(req.body?.clubId || '');
      if (!clubId) return json(res, 200, { clubs, courseMappings });
      if (!clubs.some((club) => club.id === clubId)) return json(res, 400, { error: 'El club seleccionado no pertenece al catálogo de RFEGStats.' });

      const coursesResponse = await rfegRequest(session, `/entrenamiento/ajax?id_club=${encodeURIComponent(clubId)}`);
      if (!coursesResponse.ok) return json(res, 502, { error: 'No se pudieron cargar los recorridos del club.' });
      const courses = await coursesResponse.json();
      if (!Array.isArray(courses)) return json(res, 502, { error: 'RFEGStats devolvió un catálogo de recorridos inesperado.' });
      return json(res, 200, { clubs, courseMappings, courses: courses.map((course) => ({ id: String(course.id_campo || ''), name: String(course.name || '') })).filter((course) => course.id && course.name) });
    }

    if (action === 'saveCourseMapping') {
      const localCourseName = String(req.body?.localCourseName || '').trim();
      const clubId = String(req.body?.clubId || '').trim();
      const clubName = String(req.body?.clubName || '').trim();
      const courseId = String(req.body?.courseId || '').trim();
      const courseName = String(req.body?.courseName || '').trim();
      if (!localCourseName || localCourseName.length > 180 || !/^\d+$/.test(clubId) || !/^\d+$/.test(courseId) || !clubName || !courseName) {
        return json(res, 400, { error: 'Selecciona un nombre local y un club/recorrido válido antes de guardar la equivalencia.' });
      }
      const key = localCourseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
      if (!key) return json(res, 400, { error: 'El nombre local del campo no se puede normalizar.' });
      const mapping = { localCourseName, clubId, clubName, courseId, courseName, updatedAt: new Date().toISOString() };
      await credentialRef.collection('course_mappings').doc(key).set(mapping);
      return json(res, 200, { id: key, ...mapping });
    }

    if (action === 'status') {
      const snapshot = await credentialRef.get();
      if (!snapshot.exists) return json(res, 200, { connected: false });
      const saved = snapshot.data();
      const credentials = decryptRfegCredentials(saved);
      return json(res, 200, {
        connected: true,
        username: credentials.username,
        updatedAt: saved.updatedAt || null,
      });
    }

    if (action === 'delete') {
      await credentialRef.delete();
      return json(res, 200, { connected: false });
    }

    if (action !== 'save') return json(res, 400, { error: 'Acción no válida.' });

    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password || username.length > 180 || password.length > 512) {
      return json(res, 400, { error: 'Introduce el usuario y la contraseña de RFEGStats.' });
    }

    assertRfegEncryptionConfigured();
    try {
      await validateRfegStatsLogin(username, password);
    } catch (error) {
      if (error.statusCode === 401) {
        return json(res, 401, { error: 'RFEGStats no ha aceptado el acceso. Revisa usuario y contraseña.' });
      }
      throw error;
    }

    const encrypted = encryptRfegCredentials({ username, password });
    const now = new Date().toISOString();
    await credentialRef.set({
      ...encrypted,
      updatedAt: now,
    });

    return json(res, 200, { connected: true, username, updatedAt: now });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    if (error?.message === 'RFEGSTATS_ENCRYPTION_KEY_MISSING') {
      return json(res, 503, { error: 'Falta configurar el secreto de cifrado RFEGStats en el servidor.' });
    }
    if (error?.message === 'RFEGSTATS_ENCRYPTION_KEY_INVALID') {
      return json(res, 503, { error: 'El secreto de cifrado RFEGStats del servidor no tiene el formato esperado.' });
    }
    if (status !== 401) console.error('[rfegstats_credentials] Request failed.');
    return json(res, status, { error: status === 401 ? 'Sesión de RoundTracker caducada. Vuelve a iniciar sesión.' : 'No se pudo actualizar la conexión RFEGStats.' });
  }
}
