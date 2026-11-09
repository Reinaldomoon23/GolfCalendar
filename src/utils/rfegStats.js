const RFEG_FIELDS = ['fir', 'dth', 'gir', 'd1p', 'd2p', 'recovery', 'lie', 'recoveryDistance', 'teePenalties', 'otherPenalties'];

const ROUND_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const normalizeCourseTokens = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token && !['campo', 'club', 'de', 'del', 'el', 'golf', 'la', 'las', 'los', 'course', 'resort', 'pga', 'cataluna', 'catalunya'].includes(token));

export const normalizeRfegMappingKey = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

const CAMIRAL_ALIASES = {
    club: ['Camiral', 'Camiral Tour', 'Camiral Stadium', 'PGA Catalunya', 'PGA Cataluña'],
    tour: ['Camiral Tour', 'Tour Course'],
    stadium: ['Camiral Stadium', 'Stadium Course'],
};

function diceSimilarity(left, right) {
    if (!left.length || !right.length) return 0;
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    const shared = [...leftSet].filter((token) => rightSet.has(token)).length;
    return (2 * shared) / (leftSet.size + rightSet.size);
}

export function rankRfegNameMatches(localName, federationOptions = [], kind = 'course') {
    const original = String(localName || '').trim();
    const normalized = normalizeCourseTokens(original);
    if (!original || !Array.isArray(federationOptions)) return [];
    const camiralKey = /camiral/i.test(original) ? (/tour/i.test(original) ? 'tour' : /stadium/i.test(original) ? 'stadium' : 'club') : '';
    const aliases = camiralKey ? CAMIRAL_ALIASES[camiralKey] : [];
    const aliasTokens = aliases.map((alias) => normalizeCourseTokens(alias));

    return federationOptions.map((option) => {
        const name = String(option?.name || '');
        const tokens = normalizeCourseTokens(name);
        let score = diceSimilarity(normalized, tokens);
        if (aliasTokens.some((alias) => alias.join(' ') === tokens.join(' '))) score = 1;
        if (kind === 'club' && /camiral/i.test(original) && /pga\s*catalu[nñ]a|pga\s*catalunya/i.test(name)) score = 1;
        if (kind === 'course' && camiralKey === 'tour' && /tour/i.test(name) && !/stadium/i.test(name)) score = 1;
        if (kind === 'course' && camiralKey === 'stadium' && /stadium/i.test(name)) score = 1;
        return { ...option, matchScore: score };
    }).filter((option) => option.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name, 'es'));
}

export function getCourseMappingConfidence(score) {
    if (score >= 0.999) return 'equivalencia directa';
    if (score >= 0.65) return 'coincidencia posible';
    return 'coincidencia débil';
}

export function createRfegRoundCode() {
    const randomValues = new Uint8Array(10);
    globalThis.crypto.getRandomValues(randomValues);
    const suffix = Array.from(randomValues, (value) => ROUND_CODE_ALPHABET[value % ROUND_CODE_ALPHABET.length]).join('');
    return `RT-${suffix}`;
}

export function buildRfegDescription(roundCode, tournamentName = '') {
    const name = String(tournamentName || '').trim();
    const code = String(roundCode || '').trim();
    return [`RoundTracker ${code}`, name].filter(Boolean).join(' · ');
}

const valueFor = (card, field, index) => card?.rfeg?.[field]?.[index] ?? '';

const legacyGirValue = (value) => {
    if (value === 'G') return 'yes';
    if (value === '' || value === null || value === undefined || value === '-') return '';
    return 'no';
};

export function getRfegRoundReadiness(card) {
    const holeErrors = Array.from({ length: 18 }, (_, index) => {
        const errors = [];
        const par = Number(card?.pars?.[index]) || 4;
        const handicap = card?.handicaps?.[index];
        const score = card?.strokes?.[index];
        const gir = valueFor(card, 'gir', index) || legacyGirValue(card?.girs?.[index]);
        const putts = card?.putts?.[index];

        if (score === '' || score === undefined || score === null || score === '-') errors.push('resultado');
        if (handicap === '' || handicap === undefined || handicap === null) errors.push('HCP');
        if (!Number(card?.pars?.[index])) errors.push('par');
        if (par !== 3 && !valueFor(card, 'fir', index)) errors.push('FIR');
        if (!valueFor(card, 'dth', index)) errors.push('DTH');
        if (!gir) errors.push('GIR');
        if (putts === '' || putts === undefined || putts === null) errors.push('putts');
        if (valueFor(card, 'd1p', index) === '') errors.push('D1P');
        if (Number(putts) >= 2 && valueFor(card, 'd2p', index) === '') errors.push('D2P');
        const recovery = valueFor(card, 'recovery', index);
        if (recovery) {
            if (!valueFor(card, 'lie', index)) errors.push('lie');
            if (!valueFor(card, 'recoveryDistance', index)) errors.push('distancia de recuperación');
        }
        if (valueFor(card, 'teePenalties', index) === '') errors.push('penalidad de tee');
        if (valueFor(card, 'otherPenalties', index) === '') errors.push('otras penalidades');
        return errors;
    });

    const completedHoles = holeErrors.reduce((count, errors) => count + (errors.length === 0 ? 1 : 0), 0);
    return { holeErrors, completedHoles, complete: completedHoles === 18 };
}

const DTH_RFEG = {
    '40<': 'less_40', '41-60': 'between_41_60', '61-80': 'between_61_80',
    '81-100': 'between_81_100', '101-120': 'between_101_120', '121-140': 'between_121_140',
    '141-160': 'between_141_160', '161-180': 'between_161_180', '181-200': 'between_181_200', '200>': 'more_200',
};
const RECOVERY_DISTANCE_RFEG = {
    '10<': 'less_10', '11-20': 'between_11_20', '21-30': 'between_21_30',
    '31-40': 'between_31_40', '40>': 'more_41',
};

export function mapRfegHoleForTransfer(card, index) {
    const par = Number(card?.pars?.[index]);
    const score = Number(card?.strokes?.[index]);
    const putts = Number(card?.putts?.[index]);
    const gir = valueFor(card, 'gir', index) || legacyGirValue(card?.girs?.[index]);
    const firMap = { left: '1', hit: '2', right: '3' };
    const girMap = { yes: '1', no: '2', impossible: '3' };
    const recoveryMap = { yes: '1', no: '2' };
    const lieMap = { F: '1', R: '2', B: '3' };
    const distanceValue = (value) => value === '0' ? '0.1' : String(value || '');

    return {
        resultado: Number.isInteger(score) && score >= 1 && score <= 9 ? String(score) : '',
        fir: par === 3 ? undefined : firMap[valueFor(card, 'fir', index)] || '',
        dth: DTH_RFEG[valueFor(card, 'dth', index)] || '',
        gir: girMap[gir] || '',
        putts: Number.isFinite(putts) ? String(Math.min(putts, 4)) : '',
        dp: distanceValue(valueFor(card, 'd1p', index)),
        dp2: distanceValue(valueFor(card, 'd2p', index)),
        recuperacion: recoveryMap[valueFor(card, 'recovery', index)] || '',
        lie: lieMap[valueFor(card, 'lie', index)] || '',
        rec_dth: RECOVERY_DISTANCE_RFEG[valueFor(card, 'recoveryDistance', index)] || '0',
        tee_penalty: String(valueFor(card, 'teePenalties', index) || '0'),
        other_penalty: String(valueFor(card, 'otherPenalties', index) || '0'),
    };
}

function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
}

function exportLabel(field, value) {
    const labels = {
        fir: { hit: 'Calle cogida', left: 'Calle fallada por la izquierda', right: 'Calle fallada por la derecha' },
        dth: { '40<': 'Menos de 40 m', '41-60': '41–60 m', '61-80': '61–80 m', '81-100': '81–100 m', '101-120': '101–120 m', '121-140': '121–140 m', '141-160': '141–160 m', '161-180': '161–180 m', '181-200': '181–200 m', '200>': 'Más de 200 m' },
        gir: { yes: 'Cogido en regulación', no: 'Fallado en regulación', impossible: 'Sin posibilidad de cogerlo' },
        recovery: { yes: 'Recuperación conseguida', no: 'Recuperación no conseguida' },
        lie: { F: 'Fairway (F)', R: 'Rough (R)', B: 'Bunker (B)' },
        recoveryDistance: { '10<': 'Menos de 10 m', '11-20': '11–20 m', '21-30': '21–30 m', '31-40': '31–40 m', '40>': 'Más de 40 m' },
    };
    return labels[field]?.[value] ?? value;
}

export function buildRfegCsv(card, metadata = {}) {
    const header = ['Código RoundTracker', 'Torneo', 'Campo', 'Ronda', 'Hoyo', 'Hándicap', 'Par', 'Resultado', 'FIR', 'DTH', 'GIR', 'Putts', 'D1P (m)', 'D2P (m)', 'Recuperación', 'Lie', 'Distancia recuperación', 'Penalidades tee', 'Otras penalidades'];
    const rows = Array.from({ length: 18 }, (_, index) => {
        const gir = valueFor(card, 'gir', index) || legacyGirValue(card?.girs?.[index]);
        return [
            metadata.roundCode || card?.rfeg?.roundCode || '', metadata.tournamentName, metadata.courseName, metadata.roundNumber, index + 1,
            card?.handicaps?.[index] ?? '', card?.pars?.[index] ?? '', card?.strokes?.[index] ?? '',
            exportLabel('fir', valueFor(card, 'fir', index)), exportLabel('dth', valueFor(card, 'dth', index)), exportLabel('gir', gir),
            card?.putts?.[index] ?? '', valueFor(card, 'd1p', index), valueFor(card, 'd2p', index),
            exportLabel('recovery', valueFor(card, 'recovery', index)), exportLabel('lie', valueFor(card, 'lie', index)), exportLabel('recoveryDistance', valueFor(card, 'recoveryDistance', index)),
            valueFor(card, 'teePenalties', index), valueFor(card, 'otherPenalties', index),
        ];
    });
    return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export function createEmptyRfegStats() {
    return Object.fromEntries(RFEG_FIELDS.map((field) => [field, Array(18).fill('')]));
}
