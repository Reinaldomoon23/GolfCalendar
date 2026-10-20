import { useMemo, useState } from 'react';
import { FileUp, Link2, X } from 'lucide-react';

const emptyRow = (hole) => ({ hole, score: '', putts: '', penalties: '', gir: '' });

function parseRows(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const rows = Array.from({ length: 18 }, (_, index) => emptyRow(index + 1));
    let parsed = 0;

    lines.forEach((line) => {
        const values = line.split(/[;,\t|]+/).map((value) => value.trim());
        const numbers = values.filter((value) => /^\d+$/.test(value));
        const hole = Number(numbers[0]);
        if (!hole || hole < 1 || hole > 18) return;

        const row = rows[hole - 1];
        row.score = numbers[1] || row.score;
        row.putts = numbers[2] || row.putts;
        row.penalties = numbers[3] || row.penalties;
        row.gir = values.find((value) => /^(G|\+1|\+2|-)$/.test(value)) || row.gir;
        parsed += 1;
    });

    return { rows, parsed };
}

function numbersAfterLabel(line, label) {
    const clean = String(line || '').replace(/[|]/g, ' ').replace(/,/g, ' ');
    const match = clean.match(new RegExp(`${label}\\s+(.+)`, 'i'));
    if (!match) return [];
    return (match[1].match(/\d+/g) || []).map(Number);
}

function parseGolfGameBookText(text) {
    const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const rows = Array.from({ length: 18 }, (_, index) => emptyRow(index + 1));
    const parLines = lines.filter((line) => /^Par\b/i.test(line));
    const resultLines = lines.filter((line) => /^Resultad/i.test(line));
    const pars = parLines.flatMap((line) => numbersAfterLabel(line, 'Par').slice(0, 9)).filter((value) => value >= 2 && value <= 6);
    const scores = resultLines.flatMap((line) => numbersAfterLabel(line, 'Resultad').slice(0, 9)).filter((value) => value >= 1 && value <= 15);
    const normalizedScores = scores.length >= 18 ? scores.slice(0, 18) : scores;

    normalizedScores.forEach((score, index) => {
        if (rows[index]) rows[index].score = String(score);
    });

    const totalPuttsMatch = lines.join(' ').match(/Putts\s+(\d{1,2})/i);
    const girMatch = lines.join(' ').match(/GIR\s+(\d{1,2})\s*\/\s*18/i);
    const handicapMatch = lines.join(' ').match(/HCP\s*([\d.,]+)/i);
    const slopeMatch = lines.join(' ').match(/Slope\s*(\d{2,3})/i);
    const crMatch = lines.join(' ').match(/CR\s*([\d.,]+)/i);
    const dateMatch = lines.join(' ').match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fieldLine = lines.find((line) => /Golf|Course|Camiral|Club/i.test(line) && !/^HCP/i.test(line));

    return {
        rows,
        parsed: normalizedScores.length,
        summary: {
            pars: pars.length >= 18 ? pars.slice(0, 18) : [],
            totalPutts: totalPuttsMatch ? Number(totalPuttsMatch[1]) : null,
            gir: girMatch ? Number(girMatch[1]) : null,
            handicap: handicapMatch ? Number(handicapMatch[1].replace(',', '.')) : null,
            slope: slopeMatch ? Number(slopeMatch[1]) : null,
            course: fieldLine || '',
            date: dateMatch ? dateMatch[1] : '',
            cr: crMatch ? Number(crMatch[1].replace(',', '.')) : null
        }
    };
}

function buildImportedResult(tournament, rows, sourceSummary = {}) {
    const scores = rows.map((row) => row.score || '');
    const putts = rows.map((row) => row.putts || '');
    const penalties = rows.map((row) => row.penalties || '');
    const girs = rows.map((row) => row.gir || '');
    const totalScore = scores.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const totalPutts = putts.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const par = Number(tournament?.par) || 72;
    const pars = sourceSummary.pars?.length === 18
        ? sourceSummary.pars
        : Array(18).fill(Math.round(par / 18));

    return {
        tournamentName: tournament?.name || '',
        tournamentCourse: tournament?.course || '',
        tournamentDates: tournament?.dates || '',
        tournamentPar: par,
        rounds: [totalScore || ''],
        totalPutts: [sourceSummary.totalPutts || totalPutts || ''],
        sourceSummary: {
            ...sourceSummary,
            importedFrom: 'Golf GameBook OCR'
        },
        scorecards: {
            0: {
                pars,
                strokes: scores,
                putts,
                penalties,
                girs,
                puttDistances: Array.from({ length: 18 }, () => [])
            }
        },
        importedAt: new Date().toISOString(),
        importSource: 'share-or-manual'
    };
}

export default function ResultImportModal({
    tournaments = [],
    initialText = '',
    initialUrl = '',
    onClose,
    onSave
}) {
    const orderedTournaments = useMemo(() => [...tournaments].sort((a, b) => String(a.dates || '').localeCompare(String(b.dates || ''))), [tournaments]);
    const [selectedId, setSelectedId] = useState('');
    const [tournamentQuery, setTournamentQuery] = useState('');
    const [sourceText, setSourceText] = useState(initialText || initialUrl || '');
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState(() => parseRows(initialText || '').rows);
    const [sourceSummary, setSourceSummary] = useState({});
    const [message, setMessage] = useState('');
    const [isOcrRunning, setIsOcrRunning] = useState(false);

    const selectedTournament = orderedTournaments.find((tournament) => String(tournament.id) === selectedId) || null;
    const filteredTournaments = orderedTournaments.filter((tournament) => {
        const query = tournamentQuery.trim().toLowerCase();
        if (!query) return true;
        return [tournament.name, tournament.course, tournament.dates, tournament.organizer]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
    });

    const updateRow = (index, field, value) => {
        setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    };

    const handleTextChange = (value) => {
        setSourceText(value);
        const parsed = parseGolfGameBookText(value).parsed > 0 ? parseGolfGameBookText(value) : parseRows(value);
        if (parsed.parsed > 0) {
            setRows(parsed.rows);
            if (parsed.summary) setSourceSummary(parsed.summary);
            setMessage(`${parsed.parsed} hoyos detectados. Revisa los datos antes de guardar.`);
        } else if (value.trim()) {
            setMessage('No se han detectado filas automáticamente. Puedes introducir los datos en la tabla.');
        } else {
            setMessage('');
        }
    };

    const handleImageOcr = async (file) => {
        setIsOcrRunning(true);
        setMessage('Leyendo la tarjeta. Puede tardar unos segundos...');
        try {
            const { createWorker } = await import('tesseract.js');
            const worker = await createWorker('eng');
            const result = await worker.recognize(file);
            await worker.terminate();
            const text = result?.data?.text || '';
            setSourceText(text);
            const parsed = parseGolfGameBookText(text);
            setRows(parsed.rows);
            setSourceSummary(parsed.summary || {});
            setMessage(parsed.parsed >= 18
                ? 'Tarjeta reconocida. Revisa todos los campos antes de guardar.'
                : 'OCR completado parcialmente. Revisa y completa los hoyos que falten.');
        } catch (error) {
            console.warn('[import] OCR failed:', error);
            setMessage('No se pudo leer automáticamente la imagen. Puedes introducir los datos manualmente.');
        } finally {
            setIsOcrRunning(false);
        }
    };

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        if (file.type.startsWith('text/') || /\.(csv|tsv)$/i.test(file.name)) {
            handleTextChange(await file.text());
            return;
        }
        if (file.type.startsWith('image/')) {
            await handleImageOcr(file);
            return;
        }
        setMessage('Archivo recibido. Para imágenes y PDF, revisa o introduce los datos manualmente en la tabla.');
    };

    const handleSave = async () => {
        if (!selectedTournament) {
            setMessage('Selecciona primero el torneo de destino.');
            return;
        }
        if (!rows.some((row) => row.score || row.putts || row.gir || row.penalties)) {
            setMessage('Añade al menos un resultado antes de guardar.');
            return;
        }
        await onSave(String(selectedTournament.id), buildImportedResult(selectedTournament, rows, sourceSummary));
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15, 23, 42, 0.58)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 1rem', overflowY: 'auto' }}>
            <div style={{ width: 'min(100%, 760px)', background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>Importar resultados</h2>
                        <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.88rem' }}>Selecciona el torneo destino y revisa la tarjeta antes de guardarla.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar importación" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><X size={22} /></button>
                </div>

                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Torneo de destino</label>
                <input value={tournamentQuery} onChange={(event) => setTournamentQuery(event.target.value)} placeholder="Buscar por nombre, campo o fecha..." aria-label="Buscar torneo de destino" style={{ width: '100%', boxSizing: 'border-box', padding: '0.7rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '0.45rem' }} />
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.35rem' }}>{filteredTournaments.length} torneo{filteredTournaments.length === 1 ? '' : 's'} encontrado{filteredTournaments.length === 1 ? '' : 's'}</div>
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} size={Math.min(Math.max(filteredTournaments.length + 1, 2), 7)} style={{ width: '100%', padding: '0.35rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem', background: 'white' }}>
                    <option value="">Selecciona un torneo</option>
                    {filteredTournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name} · {tournament.dates} · {tournament.course || 'Campo sin indicar'}</option>)}
                </select>

                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Texto o enlace compartido</label>
                <textarea value={sourceText} onChange={(event) => handleTextChange(event.target.value)} placeholder="Pega aquí el texto o enlace exportado desde otra app" rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: '0.7rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }} />

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', margin: '0.75rem 0 1rem', padding: '0.65rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: isOcrRunning ? 'wait' : 'pointer', color: '#334155', fontWeight: 700, opacity: isOcrRunning ? 0.65 : 1 }}>
                    <FileUp size={17} /> {isOcrRunning ? 'Leyendo tarjeta...' : 'Añadir foto, PDF o CSV'}
                    <input type="file" accept="image/*,.pdf,.csv,.tsv,text/csv" onChange={handleFile} disabled={isOcrRunning} style={{ display: 'none' }} />
                </label>
                {fileName && <span style={{ marginLeft: '0.6rem', color: '#64748b', fontSize: '0.85rem' }}>{fileName}</span>}
                {initialUrl && <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', fontSize: '0.85rem', marginBottom: '0.75rem' }}><Link2 size={15} /> Enlace recibido desde otra aplicación</div>}

                {(sourceSummary.totalPutts || sourceSummary.gir || sourceSummary.course || sourceSummary.date) && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.8rem' }}>
                    {sourceSummary.totalPutts && <span style={{ padding: '0.35rem 0.55rem', borderRadius: '999px', background: '#f0fdf4', color: '#166534', fontSize: '0.78rem', fontWeight: 700 }}>Putts totales: {sourceSummary.totalPutts}</span>}
                    {sourceSummary.gir && <span style={{ padding: '0.35rem 0.55rem', borderRadius: '999px', background: '#eff6ff', color: '#1e40af', fontSize: '0.78rem', fontWeight: 700 }}>GIR: {sourceSummary.gir}/18</span>}
                    {sourceSummary.date && <span style={{ padding: '0.35rem 0.55rem', borderRadius: '999px', background: '#f8fafc', color: '#475569', fontSize: '0.78rem' }}>Fecha detectada: {sourceSummary.date}</span>}
                </div>}

                {message && <div style={{ padding: '0.65rem 0.8rem', background: '#eff6ff', borderRadius: '8px', color: '#1e40af', marginBottom: '0.8rem', fontSize: '0.85rem' }}>{message}</div>}

                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                        <thead><tr style={{ background: '#f8fafc' }}>{['Hoyo', 'Golpes', 'Putts', 'Penal.', 'GIR'].map((header) => <th key={header} style={{ padding: '0.55rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>{header}</th>)}</tr></thead>
                        <tbody>{rows.map((row, index) => <tr key={row.hole}>
                            <td style={{ padding: '0.35rem 0.55rem', fontWeight: 700 }}>{row.hole}</td>
                            {['score', 'putts', 'penalties', 'gir'].map((field) => <td key={field} style={{ padding: '0.25rem' }}><input value={row[field]} onChange={(event) => updateRow(index, field, event.target.value)} inputMode={field === 'gir' ? 'text' : 'numeric'} placeholder={field === 'gir' ? 'G/+1' : '-'} style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></td>)}
                        </tr>)}</tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
                    <button type="button" onClick={onClose} style={{ padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>Cancelar</button>
                    <button type="button" onClick={handleSave} disabled={!selectedTournament} style={{ padding: '0.7rem 1rem', borderRadius: '8px', border: 0, background: 'var(--color-primary)', color: 'white', cursor: selectedTournament ? 'pointer' : 'not-allowed', opacity: selectedTournament ? 1 : 0.55, fontWeight: 700 }}>Revisar y guardar</button>
                </div>
            </div>
        </div>
    );
}
