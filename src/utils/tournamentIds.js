const MIGRATION_START_ISO_DATE = '2026-05-11';

export const TOURNAMENT_ID_MIGRATION_MAP = Object.freeze({
  '11': 'tt_v2__2026-05-24__2026-05-24__fcg__sant-cugat__xxv-junior-baby-cup__d0c25b26',
  '15': 'tt_v2__2026-05-16__2026-05-17__fcg__club-de-golf-costa-brava__campionat-de-catalunya-infantil__e2f0316c',
  '16': 'tt_v2__2026-05-30__2026-05-31__camiral__tour-stadium__club-championship__4203dd2a',
  '17': 'tt_v2__2026-06-07__2026-06-07__club__llavaneras__xxv-junior-baby-cup-infantil-alevi-benjami__a3ab25eb',
  '18': 'tt_v2__2026-06-14__2026-06-14__camiral__stadium__orden-de-merito__956b23f7',
  '19': 'tt_v2__2026-07-19__2026-07-19__camiral__stadium__orden-de-merito__d5178bdb',
  '20': 'tt_v2__2026-08-23__2026-08-23__camiral__tour__orden-de-merito__298c5cfa',
  '21': 'tt_v2__2026-09-06__2026-09-06__camiral__tour__orden-de-merito__b347da9a',
  '22': 'tt_v2__2026-09-19__2026-09-20__fcg__golf-costa-daurada__campionat-de-catalunya-matchplay-sub-18-16__e477ec19',
  '23': 'tt_v2__2026-10-02__2026-10-04__fcg__fontanals-golf-club__campionat-de-catalunya-sub-18-i-sub-16-wag__b34ddf18',
  '24': 'tt_v2__2026-10-18__2026-10-18__camiral__tour__orden-de-merito__d98a2fa4',
  '25': 'tt_v2__2026-11-29__2026-11-29__camiral__stadium__orden-de-merito__914c3bef',
  '26': 'tt_v2__2026-12-13__2026-12-13__camiral__tour__orden-de-merito__0093b03a',
  '27': 'tt_v2__2026-06-26__2026-06-28__rfeg__real-la-manga-club-la-se__campeonato-de-espana-infantil-alevin-y-ben__8ad47faf',
  '28': 'tt_v2__2026-07-11__2026-07-12__fcg__peralada-golf__campionat-de-catalunya-absolut-i-2a-wagr__d88f9081',
  '103': 'tt_v2__2026-09-12__2026-09-13__club__barcelona__barcelona-junior-golf-open-by-img-academy__73f9b821',
  '104': 'tt_v2__2026-09-27__2026-09-27__fcg__club-de-golf-costa-brava__xxv-junior-baby-cup__524ad5c2',
  'xxv-junior-baby-cup_24052026': 'tt_v2__2026-05-24__2026-05-24__fcg__sant-cugat__xxv-junior-baby-cup__d0c25b26',
  'club-championship_3005202631052026': 'tt_v2__2026-05-30__2026-05-31__camiral__tour-stadium__club-championship__4203dd2a',
  'xxv-junior-baby-cup-infantil-alevi-benjami_07062026': 'tt_v2__2026-06-07__2026-06-07__club__llavaneras__xxv-junior-baby-cup-infantil-alevi-benjami__a3ab25eb',
  'orden-de-merito_14062026': 'tt_v2__2026-06-14__2026-06-14__camiral__stadium__orden-de-merito__956b23f7',
  'orden-de-merito_19072026': 'tt_v2__2026-07-19__2026-07-19__camiral__stadium__orden-de-merito__d5178bdb',
  'orden-de-merito_23082026': 'tt_v2__2026-08-23__2026-08-23__camiral__tour__orden-de-merito__298c5cfa',
  'orden-de-merito_06092026': 'tt_v2__2026-09-06__2026-09-06__camiral__tour__orden-de-merito__b347da9a',
  'campionat-de-catalunya-matchplay-sub-18-16-14-12-10-2026_1909202620092026': 'tt_v2__2026-09-19__2026-09-20__fcg__golf-costa-daurada__campionat-de-catalunya-matchplay-sub-18-16__e477ec19',
  'campionat-de-catalunya-sub-18-i-sub-16-wagr-2026_0210202604102026': 'tt_v2__2026-10-02__2026-10-04__fcg__fontanals-golf-club__campionat-de-catalunya-sub-18-i-sub-16-wag__b34ddf18',
  'orden-de-merito_18102026': 'tt_v2__2026-10-18__2026-10-18__camiral__tour__orden-de-merito__d98a2fa4',
  'orden-de-merito_29112026': 'tt_v2__2026-11-29__2026-11-29__camiral__stadium__orden-de-merito__914c3bef',
  'orden-de-merito_13122026': 'tt_v2__2026-12-13__2026-12-13__camiral__tour__orden-de-merito__0093b03a',
  'campeonato-de-espana-infantil-alevin-y-benjamin-2026-memorial-juan-antonio-andreu_2606202628062026': 'tt_v2__2026-06-26__2026-06-28__rfeg__real-la-manga-club-la-se__campeonato-de-espana-infantil-alevin-y-ben__8ad47faf',
  'campionat-de-catalunya-absolut-i-2a-wagr_1107202612072026': 'tt_v2__2026-07-11__2026-07-12__fcg__peralada-golf__campionat-de-catalunya-absolut-i-2a-wagr__d88f9081',
  'barcelona-junior-golf-open-by-img-academy_1209202613092026': 'tt_v2__2026-09-12__2026-09-13__club__barcelona__barcelona-junior-golf-open-by-img-academy__73f9b821',
  'xxv-junior-baby-cup_27092026': 'tt_v2__2026-09-27__2026-09-27__fcg__club-de-golf-costa-brava__xxv-junior-baby-cup__524ad5c2',
});

const REVERSE_TOURNAMENT_ID_MIGRATION_MAP = Object.freeze(
  Object.entries(TOURNAMENT_ID_MIGRATION_MAP).reduce((acc, [legacyId, canonicalId]) => {
    if (!acc[canonicalId]) acc[canonicalId] = [];
    acc[canonicalId].push(String(legacyId));
    return acc;
  }, {})
);

function coerceTournamentInput(inputOrName, maybeDates, maybeMeta = {}) {
  if (inputOrName && typeof inputOrName === 'object' && !Array.isArray(inputOrName)) {
    return inputOrName;
  }

  if (maybeDates == null && (typeof inputOrName === 'string' || typeof inputOrName === 'number')) {
    return {
      ...maybeMeta,
      id: inputOrName,
    };
  }

  return {
    ...maybeMeta,
    name: inputOrName,
    dates: maybeDates,
  };
}

export function normalizeTournamentIdPart(value, maxLength = 48) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, maxLength) || 'na';
}

export function parseTournamentDateRange(dates = '') {
  const [startRaw, endRaw] = String(dates)
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);

  const toIsoDate = (raw) => {
    const [day, month, year] = String(raw || '').split('/');
    if (!day || !month || !year) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const startIso = toIsoDate(startRaw);
  return {
    startIso,
    endIso: toIsoDate(endRaw || startRaw),
  };
}

function hashTournamentSeed(seed) {
  let hash = 0x811c9dc5;

  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

export function buildLegacyTournamentId(inputOrName, maybeDates) {
  const { name, dates } = coerceTournamentInput(inputOrName, maybeDates);

  if (!name || !dates) return `temp_${Date.now()}`;

  const slug = normalizeTournamentIdPart(name, 128);
  const dateStr = String(dates).replace(/[^0-9]/g, '');
  return `${slug}_${dateStr}`;
}

function shouldUseComplexTournamentId(dates) {
  const { startIso } = parseTournamentDateRange(dates);
  return Boolean(startIso && startIso >= MIGRATION_START_ISO_DATE);
}

export function generateTournamentDeterministicId(inputOrName, maybeDates, maybeMeta = {}) {
  const tournament = coerceTournamentInput(inputOrName, maybeDates, maybeMeta);
  const { name, dates, organizer, course, type } = tournament;

  if (!name || !dates) return `temp_${Date.now()}`;

  if (!shouldUseComplexTournamentId(dates)) {
    return buildLegacyTournamentId(name, dates);
  }

  const { startIso, endIso } = parseTournamentDateRange(dates);
  const organizerSlug = normalizeTournamentIdPart(organizer, 18);
  const courseSlug = normalizeTournamentIdPart(course, 24);
  const nameSlug = normalizeTournamentIdPart(name, 42);
  const typeSlug = normalizeTournamentIdPart(type, 18);
  const seed = [startIso, endIso, organizerSlug, courseSlug, nameSlug, typeSlug].join('|');
  const digest = hashTournamentSeed(seed);

  return `tt_v2__${startIso}__${endIso}__${organizerSlug}__${courseSlug}__${nameSlug}__${digest}`;
}

export function resolveCanonicalTournamentId(id) {
  if (!id) return id;
  return TOURNAMENT_ID_MIGRATION_MAP[String(id)] || String(id);
}

export function getLegacyTournamentIds(id) {
  if (!id) return [];
  return REVERSE_TOURNAMENT_ID_MIGRATION_MAP[String(id)] || [];
}

export function getTournamentIdCandidates(inputOrName, maybeDates, maybeMeta = {}) {
  const tournament = coerceTournamentInput(inputOrName, maybeDates, maybeMeta);
  const explicitId = tournament?.id != null ? String(tournament.id) : null;
  const generatedId = tournament?.name && tournament?.dates
    ? generateTournamentDeterministicId(tournament)
    : null;
  const legacyId = tournament?.name && tournament?.dates
    ? buildLegacyTournamentId(tournament)
    : null;
  const canonicalId = resolveCanonicalTournamentId(explicitId || generatedId || legacyId);
  const reverseLegacyIds = canonicalId ? getLegacyTournamentIds(canonicalId) : [];

  return Array.from(new Set([
    canonicalId,
    explicitId,
    generatedId,
    legacyId,
    ...reverseLegacyIds,
  ].filter(Boolean).map(String)));
}
