import { useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, Download, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { buildRfegCsv, buildRfegDescription, createRfegRoundCode, getCourseMappingConfidence, getRfegRoundReadiness, mapRfegHoleForTransfer, normalizeRfegMappingKey, rankRfegNameMatches } from '../utils/rfegStats';
import { deleteRfegStatsCredentials, getRfegStatsCatalog, getRfegStatsConnectionStatus, saveRfegCourseMapping, saveRfegStatsCredentials, transferRfegStatsRound } from '../services/rfegStats.service';

const FIELD_OPTIONS = {
    fir: [
        ['', 'Seleccionar'],
        ['hit', 'Calle cogida'],
        ['left', 'Calle fallada por la izquierda'],
        ['right', 'Calle fallada por la derecha'],
    ],
    dth: [
        ['', 'Seleccionar'], ['40<', 'Menos de 40 m'], ['41-60', '41–60 m'],
        ['61-80', '61–80 m'], ['81-100', '81–100 m'], ['101-120', '101–120 m'],
        ['121-140', '121–140 m'], ['141-160', '141–160 m'], ['161-180', '161–180 m'],
        ['181-200', '181–200 m'], ['200>', 'Más de 200 m'],
    ],
    gir: [['', 'Seleccionar'], ['yes', 'Cogido en regulación'], ['no', 'Fallado en regulación'], ['impossible', 'Sin posibilidad de cogerlo']],
    recovery: [['', 'Seleccionar'], ['yes', 'Recuperación conseguida'], ['no', 'Recuperación no conseguida']],
    lie: [['', 'Seleccionar'], ['F', 'Fairway'], ['R', 'Rough'], ['B', 'Bunker']],
    recoveryDistance: [['', 'Seleccionar'], ['10<', 'Menos de 10 m'], ['11-20', '11–20 m'], ['21-30', '21–30 m'], ['31-40', '31–40 m'], ['40>', 'Más de 40 m']],
    d1p: [['', 'Seleccionar'], ...['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '6', '7', '8', '9', '10', '12', '15', '18', '25'].map((v) => [v, `${v} m`])],
    d2p: [['', 'Seleccionar'], ...['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '6', '7', '8', '9', '10', '12', '15', '18', '25'].map((v) => [v, `${v} m`])],
};

const selectStyle = { width: '100%', minWidth: 0, padding: '9px 10px', border: 'var(--border-thin)', borderRadius: 'var(--radius-bd)', background: 'var(--color-surface)', color: 'var(--color-text-main)', fontSize: 14 };
const labelStyle = { display: 'grid', gap: 5, color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 700 };

function FieldSelect({ label, value, options, onChange, disabled = false }) {
    return <label style={labelStyle}>{label}<select value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} style={selectStyle}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

export default function RfegStatsPanel({ card, onUpdate, tournamentName, courseName, roundDate, roundNumber = 1, notify = () => {} }) {
    const [holeIndex, setHoleIndex] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [connectionOpen, setConnectionOpen] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [connectionLoading, setConnectionLoading] = useState(false);
    const [connectionSaving, setConnectionSaving] = useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const [clubOptions, setClubOptions] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [courseMappings, setCourseMappings] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogLoaded, setCatalogLoaded] = useState(false);
    const [mappingSaving, setMappingSaving] = useState(false);
    const [transferLoading, setTransferLoading] = useState(false);
    const [showTransferReview, setShowTransferReview] = useState(false);
    const [rfegUsername, setRfegUsername] = useState('');
    const [rfegPassword, setRfegPassword] = useState('');
    const rfeg = card?.rfeg || {};
    const roundCode = rfeg.roundCode || '';
    const onUpdateRef = useRef(onUpdate);
    const roundCodeGenerationRequested = useRef(false);
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);
    const pars = card?.pars || [];
    const strokes = card?.strokes || [];
    const putts = card?.putts || [];
    const girs = card?.girs || [];
    const currentHole = holeIndex + 1;
    const par = Number(pars[holeIndex]) || 4;
    const girValue = rfeg.gir?.[holeIndex] || (girs[holeIndex] === 'G' ? 'yes' : (girs[holeIndex] ? 'no' : ''));
    const recovery = rfeg.recovery?.[holeIndex] || '';
    const readiness = useMemo(() => getRfegRoundReadiness(card), [card]);
    const clubMatches = useMemo(() => rankRfegNameMatches(courseName, clubOptions, 'club').slice(0, 3), [courseName, clubOptions]);
    const courseMatches = useMemo(() => rankRfegNameMatches(courseName, courseOptions, 'course').slice(0, 3), [courseName, courseOptions]);
    const savedCourseMapping = courseMappings.find((mapping) => normalizeRfegMappingKey(mapping.localCourseName) === normalizeRfegMappingKey(courseName));
    const totalScore = strokes.reduce((total, value) => total + (Number(value) || 0), 0);
    const totalPar = pars.reduce((total, value) => total + (Number(value) || 0), 0);
    const persistMetadata = (key, value) => onUpdate(0, `rfeg.${key}`, value);

    const loadFederationCatalog = async (clubId = '') => {
        setCatalogLoading(true);
        try {
            const result = await getRfegStatsCatalog(clubId || rfeg.clubId || '');
            setClubOptions(result.clubs || []);
            setCourseOptions(result.courses || []);
            setCourseMappings(result.courseMappings || []);
            setCatalogLoaded(true);
            if (!result.clubs?.length) notify('RFEGStats no devolvió clubes disponibles.', 'error');
            return result;
        } catch (error) {
            notify(error.message || 'No se pudo cargar el catálogo de RFEGStats.', 'error');
            return null;
        } finally {
            setCatalogLoading(false);
        }
    };

    const handleClubChange = async (clubId) => {
        const club = clubOptions.find((item) => item.id === clubId);
        persistMetadata('clubId', clubId);
        persistMetadata('clubName', club?.name || '');
        persistMetadata('courseId', '');
        persistMetadata('courseName', '');
        setCourseOptions([]);
        if (clubId) await loadFederationCatalog(clubId);
    };

    const handleCourseChange = (courseId) => {
        const course = courseOptions.find((item) => item.id === courseId);
        persistMetadata('courseId', courseId);
        persistMetadata('courseName', course?.name || '');
    };

    const applySavedCourseMapping = async () => {
        if (!savedCourseMapping) return;
        const clubExists = clubOptions.some((club) => club.id === savedCourseMapping.clubId);
        if (!clubExists) {
            notify('El club guardado ya no aparece en el catálogo de RFEGStats.', 'warning');
            return;
        }
        persistMetadata('clubId', savedCourseMapping.clubId);
        persistMetadata('clubName', savedCourseMapping.clubName);
        const catalog = await loadFederationCatalog(savedCourseMapping.clubId);
        const course = catalog?.courses?.find((item) => item.id === savedCourseMapping.courseId);
        if (!course) {
            persistMetadata('courseId', '');
            persistMetadata('courseName', '');
            notify('El recorrido guardado ya no está disponible; elige otro del catálogo.', 'warning');
            return;
        }
        persistMetadata('courseId', course.id);
        persistMetadata('courseName', course.name);
        notify(`Equivalencia aplicada: ${courseName} → ${course.name}.`, 'success');
    };

    const saveCurrentCourseMapping = async () => {
        if (!courseName || !rfeg.clubId || !rfeg.courseId || !rfeg.clubName || !rfeg.courseName) return;
        setMappingSaving(true);
        try {
            const saved = await saveRfegCourseMapping({
                localCourseName: courseName,
                clubId: rfeg.clubId,
                clubName: rfeg.clubName,
                courseId: rfeg.courseId,
                courseName: rfeg.courseName,
            });
            setCourseMappings((current) => [...current.filter((item) => item.id !== saved.id), saved]);
            notify(`Equivalencia guardada para futuros torneos: ${courseName} → ${rfeg.courseName}.`, 'success');
        } catch (error) {
            notify(error.message || 'No se pudo guardar la equivalencia.', 'error');
        } finally {
            setMappingSaving(false);
        }
    };

    const formattedDate = (() => {
        const date = roundDate instanceof Date ? roundDate : new Date(roundDate);
        if (!roundDate || Number.isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}-${month}-${date.getFullYear()}`;
    })();

    const createTransferPayload = () => ({
        roundCode,
        tournamentName: String(tournamentName || '').trim(),
        courseName: String(courseName || '').trim(),
        date: formattedDate,
        roundNumber,
        clubId: rfeg.clubId || '',
        courseId: rfeg.courseId || '',
        clubName: rfeg.clubName || '',
        federationCourseName: rfeg.courseName || '',
        conditions: Array.isArray(rfeg.conditions) ? rfeg.conditions : [],
        observations: String(rfeg.observations || ''),
        holes: Array.from({ length: 18 }, (_, index) => ({
            hole: index + 1,
            handicap: card?.handicaps?.[index],
            par: card?.pars?.[index],
            values: mapRfegHoleForTransfer(card, index),
        })),
    });

    const submitTransfer = async () => {
        setTransferLoading(true);
        try {
            const result = await transferRfegStatsRound(createTransferPayload());
            setShowTransferReview(false);
            notify(result.duplicate
                ? `La vuelta ${roundCode} ya estaba en RFEGStats (registro ${result.trainingId || 'encontrado'}).`
                : `Vuelta ${roundCode} transferida y verificada en RFEGStats (registro ${result.trainingId}).`, 'success');
        } catch (error) {
            notify(error.message || 'No se pudo transferir la vuelta.', error.reviewRequired ? 'warning' : 'error');
        } finally {
            setTransferLoading(false);
        }
    };

    useEffect(() => {
        if (!roundCode) {
            if (roundCodeGenerationRequested.current) return;
            roundCodeGenerationRequested.current = true;
            onUpdateRef.current(0, 'rfeg.roundCode', createRfegRoundCode());
        } else {
            roundCodeGenerationRequested.current = false;
        }
    }, [roundCode]);

    const updateRfeg = (field, value) => onUpdate(holeIndex, `rfeg.${field}`, value);
    const updateGir = (value) => {
        onUpdate(holeIndex, 'girs', value === 'yes' ? 'G' : value ? '+' : '');
        updateRfeg('gir', value);
    };
    const updatePutts = (value) => onUpdate(holeIndex, 'putts', value);

    const copyCsv = async () => {
        try {
            await navigator.clipboard.writeText(buildRfegCsv(card, { tournamentName, courseName, roundNumber, roundCode }));
            notify('Tarjeta RFEG copiada en CSV.', 'success');
        } catch (error) {
            console.warn('[rfeg] Clipboard unavailable:', error);
            notify('No se pudo acceder al portapapeles. Descarga el CSV.', 'warning');
        }
    };

    const downloadCsv = () => {
        const csv = buildRfegCsv(card, { tournamentName, courseName, roundNumber, roundCode });
        const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `RFEG-${String(tournamentName || 'ronda').replace(/[^a-z0-9-]/gi, '-')}-R${roundNumber}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
        notify('CSV de estadísticas descargado.', 'success');
    };

    const copyRfegDescription = async () => {
        try {
            await navigator.clipboard.writeText(buildRfegDescription(roundCode, tournamentName));
            notify('Descripción con el código de vuelta copiada.', 'success');
        } catch (error) {
            console.warn('[rfeg] Clipboard unavailable:', error);
            notify('No se pudo copiar la descripción.', 'warning');
        }
    };

    const toggleConnection = async () => {
        const willOpen = !connectionOpen;
        setConnectionOpen(willOpen);
        if (!willOpen || connectionStatus !== null) return;
        setConnectionLoading(true);
        try {
            const status = await getRfegStatsConnectionStatus();
            setConnectionStatus(status);
            setRfegUsername(status.username || '');
        } catch (error) {
            notify(error.message || 'No se pudo consultar la conexión RFEGStats.', 'error');
        } finally {
            setConnectionLoading(false);
        }
    };

    const connectRfegStats = async () => {
        if (!rfegUsername.trim() || !rfegPassword) {
            notify('Introduce el usuario y la contraseña de RFEGStats.', 'warning');
            return;
        }
        setConnectionSaving(true);
        try {
            const status = await saveRfegStatsCredentials(rfegUsername.trim(), rfegPassword);
            setConnectionStatus(status);
            setRfegUsername(status.username || rfegUsername.trim());
            setRfegPassword('');
            notify('Cuenta RFEGStats validada y credenciales guardadas cifradas.', 'success');
        } catch (error) {
            notify(error.message || 'No se pudo validar la cuenta RFEGStats.', 'error');
        } finally {
            setConnectionSaving(false);
        }
    };

    const disconnectRfegStats = async () => {
        setConnectionSaving(true);
        try {
            await deleteRfegStatsCredentials();
            setConnectionStatus({ connected: false });
            setRfegUsername('');
            setRfegPassword('');
            setConfirmDisconnect(false);
            notify('Credenciales de RFEGStats eliminadas de RoundTracker.', 'success');
        } catch (error) {
            notify(error.message || 'No se pudieron eliminar las credenciales.', 'error');
        } finally {
            setConnectionSaving(false);
        }
    };

    const fields = [
        ...(par === 3 ? [] : [{ key: 'fir', label: 'FIR · salida', options: FIELD_OPTIONS.fir }]),
        { key: 'dth', label: 'DTH · distancia al hoyo en el golpe a green', options: FIELD_OPTIONS.dth },
        { key: 'gir', label: 'GIR · green en regulación', options: FIELD_OPTIONS.gir, value: girValue, onChange: updateGir },
        { key: 'putts', label: 'Putts', options: [['', 'Seleccionar'], ...['0', '1', '2', '3', '4', '5'].map((v) => [v, v === '5' ? '5 o más' : v])], value: putts[holeIndex], onChange: updatePutts },
        { key: 'd1p', label: 'D1P · distancia del primer putt', options: FIELD_OPTIONS.d1p },
        { key: 'd2p', label: 'D2P · distancia del segundo putt', options: FIELD_OPTIONS.d2p },
        { key: 'recovery', label: 'Up & Down / Sand Save', options: FIELD_OPTIONS.recovery },
        { key: 'lie', label: 'Lie de recuperación', options: FIELD_OPTIONS.lie },
        { key: 'recoveryDistance', label: 'Distancia de recuperación', options: FIELD_OPTIONS.recoveryDistance },
    ];

    return (
        <section style={{ marginTop: 12, border: 'var(--border-thin)', borderRadius: 'var(--radius-bd)', background: 'var(--color-surface)', overflow: 'hidden' }}>
            <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} style={{ width: '100%', padding: '14px 16px', border: 0, borderBottom: expanded ? 'var(--border-thin)' : 0, background: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 700, textAlign: 'left' }}>
                <span style={{ letterSpacing: '0.03em' }}>Estadísticas RFEG</span>
                <span style={{ color: readiness.complete ? '#4f765d' : 'var(--color-text-muted)', fontSize: 12, fontWeight: 600 }}>{readiness.complete ? 'Lista para transferir' : `${readiness.completedHoles}/18 hoyos`} · {expanded ? 'Ocultar' : 'Abrir'}</span>
            </button>
            {expanded && <div style={{ padding: 14 }}>
                <p style={{ margin: '0 0 12px', color: '#6b625b', fontSize: 13, lineHeight: 1.5 }}>Registra los datos según las instrucciones de Nivel II/III para torneos o vueltas libres. Putts, GIR y golpes se comparten con la tarjeta clásica; el resto de estadísticas federativas se guarda de forma privada con esta vuelta.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, marginBottom: 14, border: 'var(--border-thin)', borderRadius: 'var(--radius-bd)', background: 'var(--color-surface-soft)' }}>
                    <div>
                        <div style={{ color: '#6b625b', fontSize: 11, fontWeight: 700 }}>Identificador compartido de la vuelta</div>
                        <code style={{ display: 'inline-block', marginTop: 3, color: 'var(--color-primary)', fontSize: 15, fontWeight: 700 }}>{roundCode || 'Preparando código…'}</code>
                        <div style={{ marginTop: 3, color: '#8c857f', fontSize: 12 }}>Pega la descripción copiada en el campo «Descripción» de RFEGStats.</div>
                    </div>
                    <button type="button" onClick={copyRfegDescription} disabled={!roundCode} style={{ display: 'inline-flex', gap: 7, alignItems: 'center', padding: '8px 10px', border: 'var(--border-thin)', borderRadius: 'var(--radius-bd)', background: 'var(--color-surface)', color: 'var(--color-primary)', fontWeight: 600, cursor: roundCode ? 'pointer' : 'wait' }}><Clipboard size={15} />Copiar código</button>
                </div>
                <div style={{ marginBottom: 14, border: '1px solid #e5e1de', borderRadius: 8, background: 'white', overflow: 'hidden' }}>
                    <button type="button" onClick={toggleConnection} aria-expanded={connectionOpen} style={{ width: '100%', padding: '10px 12px', border: 0, background: '#faf9f8', display: 'flex', justifyContent: 'space-between', gap: 8, color: '#333333', fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
                        <span>Conexión con RFEGStats</span>
                        <span style={{ color: connectionStatus?.connected ? '#15803d' : '#8c857f', fontSize: 12 }}>{connectionLoading ? 'Comprobando…' : connectionStatus?.connected ? `Conectada · ${connectionStatus.username}` : 'No conectada'} · {connectionOpen ? 'Ocultar' : 'Configurar'}</span>
                    </button>
                    {connectionOpen && <div style={{ display: 'grid', gap: 9, padding: 12 }}>
                    {connectionStatus?.connected && <p style={{ margin: 0, color: '#166534', fontSize: 12 }}>Cuenta validada. Las credenciales permanecen cifradas en el servidor y solo se usan para acciones que inicies desde esta pantalla.</p>}
                        <label style={labelStyle}>Usuario RFEGStats<input type="text" value={rfegUsername} onChange={(event) => setRfegUsername(event.target.value)} autoComplete="username" disabled={connectionSaving} style={selectStyle} /></label>
                        <label style={labelStyle}>Contraseña RFEGStats<input type="password" value={rfegPassword} onChange={(event) => setRfegPassword(event.target.value)} autoComplete="off" disabled={connectionSaving} style={selectStyle} /></label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <button type="button" onClick={connectRfegStats} disabled={connectionSaving || connectionLoading} style={{ padding: '8px 11px', border: 0, borderRadius: 7, background: '#333333', color: 'white', fontWeight: 700, cursor: connectionSaving ? 'wait' : 'pointer' }}>{connectionSaving ? 'Validando…' : connectionStatus?.connected ? 'Actualizar y validar' : 'Validar y guardar cifrada'}</button>
                            {connectionStatus?.connected && !confirmDisconnect && <button type="button" onClick={() => setConfirmDisconnect(true)} disabled={connectionSaving} style={{ padding: '8px 11px', border: '1px solid #fecaca', borderRadius: 7, background: '#fff7f7', color: '#b91c1c', fontWeight: 700, cursor: connectionSaving ? 'wait' : 'pointer' }}>Eliminar credenciales</button>}
                        </div>
                        {confirmDisconnect && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 9, borderRadius: 7, background: '#fff7ed', color: '#9a3412', fontSize: 12 }}>
                            <span>Se eliminarán las credenciales guardadas. Podrás conectarte de nuevo cuando quieras.</span>
                            <button type="button" onClick={disconnectRfegStats} disabled={connectionSaving} style={{ padding: '6px 9px', border: 0, borderRadius: 6, background: '#b91c1c', color: 'white', fontWeight: 700, cursor: connectionSaving ? 'wait' : 'pointer' }}>{connectionSaving ? 'Eliminando…' : 'Confirmar eliminación'}</button>
                            <button type="button" onClick={() => setConfirmDisconnect(false)} disabled={connectionSaving} style={{ padding: '6px 9px', border: '1px solid #fdba74', borderRadius: 6, background: 'white', color: '#9a3412', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                        </div>}
                        <p style={{ margin: 0, color: '#8c857f', fontSize: 11, lineHeight: 1.45 }}>La contraseña se envía por HTTPS al servidor, se valida en RFEGStats y se guarda cifrada; no se conserva en el navegador ni en texto legible en Firestore.</p>
                    </div>}
                </div>
                <div style={{ display: 'grid', gap: 10, padding: 12, marginBottom: 14, border: '1px solid #e5e1de', borderRadius: 8, background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ color: '#333333', fontSize: 13 }}>Destino federativo</strong>
                        <button type="button" onClick={() => loadFederationCatalog()} disabled={catalogLoading || !connectionStatus?.connected} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 9px', border: '1px solid #e5e1de', borderRadius: 7, background: 'white', color: '#333333', fontWeight: 700, cursor: catalogLoading ? 'wait' : 'pointer' }}><RefreshCw size={14} />{catalogLoading ? 'Cargando…' : catalogLoaded ? 'Actualizar catálogo' : 'Cargar catálogo RFEG'}</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 9 }}>
                        <label style={labelStyle}>Club RFEG<select value={rfeg.clubId || ''} onChange={(event) => handleClubChange(event.target.value)} disabled={!clubOptions.length || catalogLoading} style={selectStyle}><option value="">Selecciona un club</option>{clubOptions.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
                        <label style={labelStyle}>Recorrido RFEG<select value={rfeg.courseId || ''} onChange={(event) => handleCourseChange(event.target.value)} disabled={!courseOptions.length || catalogLoading} style={selectStyle}><option value="">Selecciona un recorrido</option>{courseOptions.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
                    </div>
                    {courseName && <div style={{ display: 'grid', gap: 7, padding: 9, border: '1px solid #e5e1de', borderRadius: 7, background: '#faf9f8', color: '#333333', fontSize: 12 }}>
                        <div>Nombre en RoundTracker: <strong>{courseName}</strong></div>
                        {savedCourseMapping && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
                            <span>Equivalencia guardada: {savedCourseMapping.clubName} · {savedCourseMapping.courseName}</span>
                            {(rfeg.clubId !== savedCourseMapping.clubId || rfeg.courseId !== savedCourseMapping.courseId) && <button type="button" onClick={applySavedCourseMapping} disabled={catalogLoading} style={{ padding: '5px 8px', border: '1px solid #86efac', borderRadius: 6, background: '#f0fdf4', color: '#166534', fontWeight: 700, cursor: 'pointer' }}>Aplicar equivalencia guardada</button>}
                        </div>}
                        {!rfeg.clubId && clubMatches.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                            <span>Posibles clubes RFEG:</span>
                            {clubMatches.map((club) => <button key={club.id} type="button" onClick={() => handleClubChange(club.id)} disabled={catalogLoading} style={{ padding: '5px 8px', border: '1px solid #e5e1de', borderRadius: 6, background: 'white', color: '#333333', fontWeight: 700, cursor: 'pointer' }}>{club.name} · {getCourseMappingConfidence(club.matchScore)}</button>)}
                        </div>}
                        {rfeg.clubId && !rfeg.courseId && courseMatches.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                            <span>Posibles recorridos RFEG:</span>
                            {courseMatches.map((course) => <button key={course.id} type="button" onClick={() => handleCourseChange(course.id)} disabled={catalogLoading} style={{ padding: '5px 8px', border: '1px solid #e5e1de', borderRadius: 6, background: 'white', color: '#333333', fontWeight: 700, cursor: 'pointer' }}>{course.name} · {getCourseMappingConfidence(course.matchScore)}</button>)}
                        </div>}
                        {rfeg.clubId && rfeg.courseId && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
                            <span>Asociación seleccionada: <strong>{rfeg.clubName} · {rfeg.courseName}</strong></span>
                            {savedCourseMapping?.clubId === rfeg.clubId && savedCourseMapping?.courseId === rfeg.courseId
                                ? <span style={{ color: '#15803d', fontWeight: 700 }}>Guardada para próximos torneos</span>
                                : <button type="button" onClick={saveCurrentCourseMapping} disabled={mappingSaving || !connectionStatus?.connected} style={{ padding: '5px 8px', border: '1px solid #86efac', borderRadius: 6, background: '#f0fdf4', color: '#166534', fontWeight: 700, cursor: mappingSaving ? 'wait' : 'pointer' }}>{mappingSaving ? 'Guardando…' : 'Guardar equivalencia para próximos torneos'}</button>}
                        </div>}
                        <span style={{ color: '#8c857f' }}>Las sugerencias solo comparan nombres normalizados. Confirma que el campo y el recorrido sean los mismos antes de transferir.</span>
                    </div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: '#6b625b', fontSize: 12 }}>
                        {[[1, 'Seco'], [2, 'Húmedo'], [3, 'Frío'], [4, 'Viento']].map(([id, label]) => <label key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><input type="checkbox" checked={(rfeg.conditions || []).includes(String(id))} onChange={(event) => {
                            const current = Array.isArray(rfeg.conditions) ? rfeg.conditions : [];
                            const next = event.target.checked ? [...new Set([...current, String(id)])] : current.filter((item) => item !== String(id));
                            persistMetadata('conditions', next);
                        }} />{label}</label>)}
                    </div>
                    <label style={labelStyle}>Observaciones de la ronda<textarea value={rfeg.observations || ''} onChange={(event) => persistMetadata('observations', event.target.value)} rows={2} maxLength={2000} style={{ ...selectStyle, resize: 'vertical' }} /></label>
                    <div style={{ color: '#8c857f', fontSize: 12 }}>Fecha prevista: {formattedDate || 'sin fecha'} · Ronda {roundNumber} · Código {roundCode || 'pendiente'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 12 }}>
                    {Array.from({ length: 18 }, (_, index) => {
                        const complete = readiness.holeErrors[index].length === 0;
                        return <button key={index} type="button" onClick={() => setHoleIndex(index)} aria-current={holeIndex === index ? 'step' : undefined} style={{ flex: '0 0 38px', height: 38, border: holeIndex === index ? '2px solid #333333' : '1px solid #e5e1de', borderRadius: 20, background: complete ? '#dcfce7' : 'white', color: complete ? '#166534' : '#333333', fontWeight: 800, cursor: 'pointer' }}>{index + 1}</button>;
                    })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 10, padding: 12, borderRadius: 9, background: 'white', border: '1px solid #e5e1de' }}>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: 8, color: '#333333', fontWeight: 800 }}>Hoyo {currentHole} · HCP {card?.handicaps?.[holeIndex] || '—'} · Par {par}<span>{strokes[holeIndex] ? `${strokes[holeIndex]} golpes` : 'Añade primero los golpes'}</span></div>
                    {fields.map((field) => <FieldSelect key={field.key} label={field.label} value={field.value ?? rfeg[field.key]?.[holeIndex] ?? ''} options={field.options} disabled={field.key === 'fir' && par === 3} onChange={field.onChange || ((value) => updateRfeg(field.key, value))} />)}
                    <label style={labelStyle}>Penalidades desde el tee<input type="number" min="0" max="2" value={rfeg.teePenalties?.[holeIndex] ?? ''} onChange={(event) => updateRfeg('teePenalties', event.target.value)} style={selectStyle} /></label>
                    <label style={labelStyle}>Otras penalidades<input type="number" min="0" max="2" value={rfeg.otherPenalties?.[holeIndex] ?? ''} onChange={(event) => updateRfeg('otherPenalties', event.target.value)} style={selectStyle} /></label>
                </div>
                {readiness.holeErrors[holeIndex].length > 0 && <p style={{ margin: '10px 0', color: '#92400e', fontSize: 12 }}>Para exportar este hoyo faltan: {readiness.holeErrors[holeIndex].join(', ')}.</p>}
                {recovery === 'yes' && <p style={{ margin: '8px 0 0', color: '#8c857f', fontSize: 12 }}>Marca lie y distancia cuando corresponda a una recuperación de hasta 40 m; la documentación RFEG excluye de la estadística las de más de 40 m.</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    <button type="button" onClick={copyCsv} style={{ display: 'inline-flex', gap: 7, alignItems: 'center', padding: '9px 12px', border: 0, borderRadius: 8, background: '#333333', color: 'white', fontWeight: 700, cursor: 'pointer' }}><Clipboard size={16} />Copiar CSV</button>
                    <button type="button" onClick={downloadCsv} style={{ display: 'inline-flex', gap: 7, alignItems: 'center', padding: '9px 12px', border: '1px solid #c5b4a5', borderRadius: 8, background: 'white', color: '#333333', fontWeight: 700, cursor: 'pointer' }}><Download size={16} />Descargar CSV</button>
                    <a href="https://rfegolfstats.es/entrenamiento" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 7, alignItems: 'center', padding: '9px 12px', border: '1px solid #e5e1de', borderRadius: 8, background: 'white', color: '#333333', fontWeight: 700, textDecoration: 'none' }}><ExternalLink size={16} />Abrir RFEG</a>
                    <button type="button" onClick={() => setShowTransferReview((value) => !value)} disabled={!readiness.complete || !connectionStatus?.connected || !rfeg.clubId || !rfeg.courseId || !roundCode || !formattedDate || transferLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: 0, borderRadius: 8, background: '#333333', color: 'white', fontWeight: 700, cursor: !readiness.complete || !connectionStatus?.connected || !rfeg.courseId ? 'not-allowed' : 'pointer', opacity: !readiness.complete || !connectionStatus?.connected || !rfeg.clubId || !rfeg.courseId || !formattedDate ? 0.55 : 1 }}><Send size={15} />Revisar transferencia</button>
                </div>
                {!readiness.complete && <p style={{ margin: '9px 0 0', color: '#92400e', fontSize: 12 }}>Faltan datos obligatorios en {18 - readiness.completedHoles} hoyos. Completa golpes, HCP, par y estadísticas antes de enviar.</p>}
                {showTransferReview && <div style={{ marginTop: 12, padding: 12, border: '1px solid #fbbf24', borderRadius: 8, background: '#fffbeb' }}>
                    <strong style={{ color: '#92400e' }}>Revisión antes de enviar</strong>
                    <p style={{ margin: '6px 0 10px', color: '#78350f', fontSize: 12, lineHeight: 1.5 }}>Se creará una ronda en RFEGStats para {rfeg.clubName} · {rfeg.courseName}, el {formattedDate}, con 18 hoyos, resultado {totalScore} (par {totalPar}) y código {roundCode}. Las condiciones seleccionadas: {(rfeg.conditions || []).map((condition) => ({ '1': 'seco', '2': 'húmedo', '3': 'frío', '4': 'viento' }[condition])).filter(Boolean).join(', ') || 'ninguna'}. También se enviarán las estadísticas hoyo a hoyo y las observaciones. Si la web responde de forma ambigua, no se reintentará automáticamente.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button type="button" onClick={submitTransfer} disabled={transferLoading} style={{ padding: '8px 11px', border: 0, borderRadius: 7, background: '#b45309', color: 'white', fontWeight: 800, cursor: transferLoading ? 'wait' : 'pointer' }}>{transferLoading ? 'Enviando y verificando…' : 'Confirmar envío a RFEGStats'}</button>
                        <button type="button" onClick={() => setShowTransferReview(false)} disabled={transferLoading} style={{ padding: '8px 11px', border: '1px solid #d6d3d1', borderRadius: 7, background: 'white', color: '#44403c', fontWeight: 700, cursor: 'pointer' }}>Volver a revisar</button>
                    </div>
                </div>}
                <p style={{ margin: '10px 0 0', color: '#8c857f', fontSize: 12, lineHeight: 1.5 }}>La transferencia usa el formulario autenticado de RFEGStats; no hay importación CSV visible en la web. Revisa siempre club, recorrido y código RT antes de confirmar.</p>
            </div>}
        </section>
    );
}
