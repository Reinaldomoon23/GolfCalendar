import { load } from 'cheerio';
import {
  createRfegStatsSession,
  decryptRfegCredentials,
  getRfegAdminServices,
  getRfegOrigin,
  rfegRequest,
  verifyRfegRequestUser,
} from './_rfegstats_server.js';

const ORIGIN = getRfegOrigin();
const SEGMENT_STEPS = [2, 3];
const HOLE_FIELD_MAP = ['resultado', 'fir', 'dth', 'gir', 'putts', 'dp', 'dp2', 'recuperacion', 'lie', 'rec_dth', 'tee_penalty', 'other_penalty'];
export const config = { maxDuration: 60 };

function isValidFederationDate(value) {
  const match = String(value || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return false;
  const [, dayText, monthText, yearText] = match;
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
  return date.getFullYear() === Number(yearText)
    && date.getMonth() === Number(monthText) - 1
    && date.getDate() === Number(dayText);
}

function respond(res, status, payload) {
  return res.status(status).json(payload);
}

function formControls($, form) {
  const result = new URLSearchParams();
  $(form).find('input[name], select[name], textarea[name]').each((_, control) => {
    const element = $(control);
    const name = element.attr('name');
    const type = String(element.attr('type') || '').toLowerCase();
    if (!name || ['submit', 'button', 'file', 'reset'].includes(type)) return;
    if (type === 'checkbox' || type === 'radio') {
      if (element.is(':checked')) result.append(name, String(element.val() || ''));
      return;
    }
    if (control.tagName?.toLowerCase() === 'select') {
      const selected = element.find('option:selected').first().val();
      if (selected !== undefined) result.append(name, String(selected));
      return;
    }
    result.append(name, String(element.val() || ''));
  });
  return result;
}

function selectedOptionIds($, selectName) {
  return $(`select[name="${selectName}"] option`)
    .map((_, option) => String($(option).attr('value') || ''))
    .get()
    .filter(Boolean);
}

function extractTrainingId(response, html) {
  const fromUrl = String(response.url || '').match(/id_entrenamiento\/(\d+)/i);
  if (fromUrl) return fromUrl[1];
  const $ = load(html);
  const hrefs = $('a[href]').map((_, link) => $(link).attr('href') || '').get();
  for (const href of hrefs) {
    const match = href.match(/id_entrenamiento\/(\d+)/i);
    if (match) return match[1];
  }
  return '';
}

function findDuplicateTrainingId(html, roundCode) {
  const $ = load(html);
  const match = $('tr, li, .entrenamiento, .panel, .card')
    .filter((_, element) => $(element).text().includes(roundCode)).first();
  const hrefs = match.find('a[href]').map((_, link) => $(link).attr('href') || '').get();
  for (const href of hrefs) {
    const id = href.match(/id_entrenamiento\/(\d+)/i)?.[1];
    if (id) return id;
  }
  return '';
}

async function verifyStatsProtocol(session, roundsHtml) {
  const $rounds = load(roundsHtml);
  const sampleHref = $rounds('a[href*="id_entrenamiento/"]')
    .map((_, link) => $rounds(link).attr('href') || '').get()
    .find((href) => /id_entrenamiento\/\d+/.test(href));
  const sampleId = sampleHref?.match(/id_entrenamiento\/(\d+)/)?.[1];
  if (!sampleId) throw new Error('RFEGSTATS_STATS_PROTOCOL_UNVERIFIED');

  const segments = [];
  for (const step of SEGMENT_STEPS) {
    const response = await rfegRequest(session, `/entrenamiento/estadisticas/id_entrenamiento/${sampleId}/vuelta/1/paso/${step}/check_values/true`);
    const html = await response.text();
    if (!response.ok || /name=["']signin\[username\]/i.test(html)) throw new Error('RFEGSTATS_STATS_PROTOCOL_UNVERIFIED');
    const $ = load(html);
    const holes = [...new Set($('form [name]').map((_, control) => {
      const name = String($(control).attr('name') || '');
      return Number(name.match(/^(\d+)\[(?:resultado|dth|gir|putts|dp)\]$/)?.[1] || 0);
    }).get().filter(Boolean))].sort((a, b) => a - b);
    segments.push(holes);
  }
  const firstNine = Array.from({ length: 9 }, (_, index) => index + 1);
  const backNine = Array.from({ length: 9 }, (_, index) => index + 10);
  if (JSON.stringify(segments[0]) !== JSON.stringify(firstNine) || JSON.stringify(segments[1]) !== JSON.stringify(backNine)) {
    throw new Error('RFEGSTATS_STATS_PROTOCOL_UNVERIFIED');
  }
}

function buildStatsValues(round, hole) {
  const source = round.holes[hole - 1];
  const fields = source.values;
  return Object.fromEntries(HOLE_FIELD_MAP.map((key) => [key, String(fields[key] ?? '')]));
}

function isValidTransferRound(round) {
  if (!isValidFederationDate(round?.date)) return false;
  const validDth = new Set(['less_40', 'between_41_60', 'between_61_80', 'between_81_100', 'between_101_120', 'between_121_140', 'between_141_160', 'between_161_180', 'between_181_200', 'more_200']);
  const validDistances = new Set(['0.1', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '6', '7', '8', '9', '10', '12', '15', '18', '25']);
  return Array.isArray(round?.holes) && round.holes.length === 18 && round.holes.every((hole) => {
    const values = hole?.values || {};
    const par = Number(hole.par);
    const handicap = Number(hole.handicap);
    const score = Number(values.resultado);
    const rawPutts = String(values.putts ?? '');
    const penaltiesValid = [values.tee_penalty, values.other_penalty].every((value) => ['0', '1', '2'].includes(String(value)));
    const recoveryValid = !values.recuperacion || (['1', '2'].includes(String(values.recuperacion)) && ['1', '2', '3'].includes(String(values.lie)) && ['0', 'less_10', 'between_11_20', 'between_21_30', 'between_31_40', 'more_41'].includes(String(values.rec_dth)));
    return Number.isInteger(par) && par >= 3 && par <= 6
      && Number.isInteger(handicap) && handicap >= 1 && handicap <= 18
      && Number.isInteger(score) && score >= 1 && score <= 9
      && (par === 3 || ['1', '2', '3'].includes(String(values.fir)))
      && validDth.has(String(values.dth))
      && ['1', '2', '3'].includes(String(values.gir))
      && /^(0|[1-4])$/.test(rawPutts)
      && validDistances.has(String(values.dp))
      && (Number(rawPutts) < 2 || validDistances.has(String(values.dp2)))
      && recoveryValid
      && penaltiesValid;
  });
}

async function postStatsSegment(session, trainingId, segmentStep, round) {
  const path = `/entrenamiento/estadisticas/id_entrenamiento/${trainingId}/vuelta/1/paso/${segmentStep}/check_values/true`;
  const getResponse = await rfegRequest(session, path);
  const html = await getResponse.text();
  if (!getResponse.ok || /name=["']signin\[username\]/i.test(html)) throw new Error('RFEGSTATS_SESSION_EXPIRED');
  const $ = load(html);
  const form = $('form').first().get(0);
  if (!form) throw new Error('RFEGSTATS_STATS_FORM_MISSING');

  const values = formControls($, form);
  const inputNames = new Set();
  $(form).find('[name]').each((_, control) => inputNames.add(String($(control).attr('name') || '')));
  const representedHoles = [...inputNames].map((name) => name.match(/^(\d+)\[(?:resultado|fir|dth|gir|putts|dp|dp2|recuperacion|lie|rec_dth|tee_penalty|other_penalty)\]$/)?.[1]).filter(Boolean).map(Number);
  const uniqueHoles = [...new Set(representedHoles)].sort((a, b) => a - b);
  if (!uniqueHoles.length) throw new Error('RFEGSTATS_HOLE_FIELDS_UNRECOGNIZED');

  for (const hole of uniqueHoles) {
    const mapped = buildStatsValues(round, hole);
    for (const [key, value] of Object.entries(mapped)) {
      const name = `${hole}[${key}]`;
      if (inputNames.has(name) && value !== '') values.set(name, value);
    }
    if (!inputNames.has(`${hole}[fir]`)) values.delete(`${hole}[fir]`);
  }

  const action = new URL($(form).attr('action') || path, ORIGIN);
  if (action.origin !== ORIGIN) throw new Error('RFEGSTATS_ORIGIN_REJECTED');
  const response = await rfegRequest(session, action.pathname + action.search, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${ORIGIN}${path}` },
    body: values,
  });
  if (!response.ok) throw new Error('RFEGSTATS_STATS_REJECTED');
  const verifyResponse = await rfegRequest(session, path);
  const verifiedHtml = await verifyResponse.text();
  if (!verifyResponse.ok) throw new Error('RFEGSTATS_STATS_REJECTED');
  const $verify = load(verifiedHtml);
  const verifyForm = $verify('form').first();
  if (!verifyForm.length) throw new Error('RFEGSTATS_STATS_REJECTED');
  for (const hole of uniqueHoles) {
    const expected = buildStatsValues(round, hole);
    for (const [key, value] of Object.entries(expected)) {
      if (value === '') continue;
      const name = `${hole}[${key}]`;
      const control = verifyForm.find(`[name="${name}"]`).first();
      if (!control.length) {
        if (key === 'fir' && Number(round.holes[hole - 1].par) === 3) continue;
        throw new Error('RFEGSTATS_STATS_REJECTED');
      }
      let actual = '';
      if (String(control.attr('type') || '').toLowerCase() === 'radio') {
        actual = verifyForm.find(`[name="${name}"]:checked`).val() || '';
      } else if (control.is('select')) {
        actual = control.find('option:selected').val() || '';
      } else {
        actual = control.val() || '';
      }
      if (String(actual) !== String(value || '')) throw new Error('RFEGSTATS_STATS_REJECTED');
    }
  }
  return uniqueHoles;
}

export default async function handler(req, res) {
  const origin = String(req.headers.origin || '');
  const allowedOrigins = new Set(['https://reinaldomoon.top', 'https://www.reinaldomoon.top', 'https://golf-calendar-v3.vercel.app']);
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Origen no permitido.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return respond(res, 405, { error: 'Método no permitido.' });

  let transferRef;
  let transferReserved = false;
  let externalWriteStarted = false;
  try {
    const decoded = await verifyRfegRequestUser(req.headers.authorization);
    const { db } = getRfegAdminServices();
    const credentialRef = db.collection('users').doc(decoded.uid).collection('integrations').doc('rfegstats');
    const credentialSnapshot = await credentialRef.get();
    if (!credentialSnapshot.exists) return respond(res, 409, { error: 'Conecta primero tu cuenta RFEGStats.' });
    const credentials = decryptRfegCredentials(credentialSnapshot.data());
    const session = await createRfegStatsSession(credentials.username, credentials.password);

    const round = req.body?.round;
    if (req.body?.confirmed !== true) return respond(res, 400, { error: 'Confirma primero la revisión de la vuelta en RoundTracker.' });
    const roundCode = String(round?.roundCode || '').trim();
    if (!/^RT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/.test(roundCode)) return respond(res, 400, { error: 'El identificador RT de la vuelta no es válido.' });
    if (!isValidTransferRound(round)) {
      return respond(res, 400, { error: 'Completa los datos obligatorios de los 18 hoyos antes de transferir.' });
    }
    const clubId = String(round.clubId || '');
    const courseId = String(round.courseId || '');
    if (!clubId || !courseId || !/^\d+$/.test(clubId) || !/^\d+$/.test(courseId)) {
      return respond(res, 400, { error: 'Selecciona un club y un recorrido del catálogo de RFEGStats.' });
    }

    const transferDoc = credentialRef.collection('rounds').doc(roundCode);
    const previous = await transferDoc.get();
    if (previous.exists) {
      const saved = previous.data();
      if (saved.status === 'complete') return respond(res, 200, { transferred: true, duplicate: true, trainingId: saved.trainingId, roundCode });
      return respond(res, 409, { error: 'Hay un envío previo de esta vuelta pendiente de verificar. No la reenvío para evitar duplicados.', reviewRequired: true });
    }
    const roundsPage = await rfegRequest(session, '/entrenamiento');
    const roundsHtml = await roundsPage.text();
    const $rounds = load(roundsHtml);
    const recognizableList = $rounds('a[href*="id_entrenamiento/"]').length > 0 || /no existen vueltas|no hay vueltas|sin rondas|nueva ronda/i.test($rounds.text());
    if (!roundsPage.ok || /name=["']signin\[username\]/i.test(roundsHtml) || !recognizableList) throw new Error('RFEGSTATS_DUPLICATE_CHECK_UNAVAILABLE');
    if (roundsPage.ok && roundsHtml.includes(roundCode)) {
      const duplicateId = findDuplicateTrainingId(roundsHtml, roundCode);
      await transferDoc.set({ status: 'complete', trainingId: duplicateId, roundCode, completedAt: new Date().toISOString(), foundExisting: true });
      return respond(res, 200, { transferred: true, duplicate: true, trainingId: duplicateId, roundCode });
    }
    await verifyStatsProtocol(session, roundsHtml);

    transferRef = transferDoc;
    try {
      await transferRef.create({ status: 'pending', roundCode, startedAt: new Date().toISOString() });
      transferReserved = true;
    } catch (error) {
      if (error?.code === 6 || error?.code === 'already-exists') return respond(res, 409, { error: 'Esta vuelta ya tiene un envío en curso. No la reenvío.' });
      throw error;
    }

    const createPage = await rfegRequest(session, '/entrenamiento/new');
    const createHtml = await createPage.text();
    if (!createPage.ok || /name=["']signin\[username\]/i.test(createHtml)) throw new Error('RFEGSTATS_SESSION_EXPIRED');
    const $ = load(createHtml);
    const form = $('form').first().get(0);
    if (!form) throw new Error('RFEGSTATS_CREATE_FORM_MISSING');
    const availableClubs = selectedOptionIds($, 'entrenamiento[id_club]');
    if (!availableClubs.includes(clubId)) throw new Error('RFEGSTATS_CLUB_NOT_IN_CATALOG');
    const courseResponse = await rfegRequest(session, `/entrenamiento/ajax?id_club=${encodeURIComponent(clubId)}`);
    const courseOptions = await courseResponse.json();
    if (!Array.isArray(courseOptions) || !courseOptions.some((course) => String(course.id_campo) === courseId)) throw new Error('RFEGSTATS_COURSE_NOT_IN_CATALOG');

    const values = formControls($, form);
    values.set('entrenamiento[id_club]', clubId);
    values.set('entrenamiento[id_campo]', courseId);
    values.set('entrenamiento[fecha]', String(round.date || ''));
    values.set('entrenamiento[descripcion]', `RoundTracker ${roundCode} · ${String(round.tournamentName || '')}`.slice(0, 250));
    values.set('entrenamiento[observaciones]', String(round.observations || '').slice(0, 2000));
    values.delete('entrenamiento[hoyos_jugados][]');
    values.append('entrenamiento[hoyos_jugados][]', '1');
    values.append('entrenamiento[hoyos_jugados][]', '2');
    values.delete('entrenamiento[entrenamientocondicionescampo_list][]');
    for (const condition of round.conditions || []) {
      if (['1', '2', '3', '4'].includes(String(condition))) values.append('entrenamiento[entrenamientocondicionescampo_list][]', String(condition));
    }
    const createAction = new URL($(form).attr('action') || '/entrenamiento/create', ORIGIN);
    if (createAction.origin !== ORIGIN) throw new Error('RFEGSTATS_ORIGIN_REJECTED');
    externalWriteStarted = true;
    const createResponse = await rfegRequest(session, createAction.pathname + createAction.search, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${ORIGIN}/entrenamiento/new` },
      body: values,
    });
    const createResponseHtml = await createResponse.text();
    const trainingId = extractTrainingId(createResponse, createResponseHtml);
    if (!createResponse.ok || !trainingId) throw new Error('RFEGSTATS_ROUND_CREATE_UNVERIFIED');
    await transferRef.set({ status: 'created', trainingId, roundCode, createdAt: new Date().toISOString() }, { merge: true });

    const submittedHoles = [];
    for (const step of SEGMENT_STEPS) submittedHoles.push(...await postStatsSegment(session, trainingId, step, round));
    const uniqueSubmitted = [...new Set(submittedHoles)].sort((a, b) => a - b);
    if (uniqueSubmitted.length < 18) throw new Error('RFEGSTATS_HOLES_NOT_CONFIRMED');

    await transferRef.set({ status: 'complete', trainingId, roundCode, completedAt: new Date().toISOString(), holes: uniqueSubmitted }, { merge: true });
    return respond(res, 200, { transferred: true, duplicate: false, trainingId, roundCode, holes: uniqueSubmitted });
  } catch (error) {
    if (transferRef && transferReserved) {
      if (externalWriteStarted) {
        await transferRef.set({ status: 'review', errorCode: String(error?.message || 'TRANSFER_FAILED'), updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      } else {
        await transferRef.delete().catch(() => {});
      }
    }
    const messages = {
      RFEGSTATS_LOGIN_FAILED: [401, 'RFEGStats no aceptó el acceso guardado. Vuelve a conectar la cuenta.'],
      RFEGSTATS_DUPLICATE_CHECK_UNAVAILABLE: [502, 'No se pudo comprobar si el código ya existe en RFEGStats; no se creó otra ronda.'],
      RFEGSTATS_STATS_PROTOCOL_UNVERIFIED: [502, 'No se pudo validar la navegación de los hoyos 1–9 y 10–18 usando una ronda existente; no se creó otra ronda.'],
      RFEGSTATS_SESSION_EXPIRED: [401, 'La sesión de RFEGStats caducó. Vuelve a conectar la cuenta.'],
      RFEGSTATS_CLUB_NOT_IN_CATALOG: [400, 'El club ya no aparece en el catálogo actual de RFEGStats.'],
      RFEGSTATS_COURSE_NOT_IN_CATALOG: [400, 'El recorrido ya no aparece en el catálogo actual del club.'],
      RFEGSTATS_CREATE_FORM_MISSING: [502, 'No se pudo leer el formulario de alta de RFEGStats.'],
      RFEGSTATS_ROUND_CREATE_UNVERIFIED: [502, 'RFEGStats no confirmó el alta; el envío queda bloqueado para evitar duplicados.'],
      RFEGSTATS_STATS_FORM_MISSING: [502, 'No se encontró el formulario de estadísticas; requiere revisión manual.'],
      RFEGSTATS_HOLE_FIELDS_UNRECOGNIZED: [502, 'No se reconocieron los campos de hoyo del formulario actual.'],
      RFEGSTATS_STATS_REJECTED: [502, 'RFEGStats rechazó o no confirmó las estadísticas. Revisa la ronda antes de reintentar.'],
      RFEGSTATS_HOLES_NOT_CONFIRMED: [502, 'RFEGStats no confirmó los 18 hoyos; revisa la ronda antes de reintentar.'],
    };
    const [status, message] = messages[error?.message] || [500, 'No se pudo completar la transferencia. La ronda puede requerir revisión en RFEGStats.'];
    if (status >= 500) console.error('[rfegstats_transfer] Transfer stopped; external review may be required.');
    return respond(res, status, { error: message, reviewRequired: externalWriteStarted });
  }
}
