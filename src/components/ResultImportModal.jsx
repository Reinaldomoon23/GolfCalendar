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

function buildImportedResult(tournament, rows) {
    const scores = rows.map((row) => row.score || '');
    const putts = rows.map((row) => row.putts || '');
    const penalties = rows.map((row) => row.penalties || '');
    const girs = rows.map((row) => row.gir || '');
    const totalScore = scores.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const totalPutts = putts.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const par = Number(tournament?.par) || 72;

    return {
        tournamentName: tournament?.name || '',
        tournamentCourse: tournament?.course || '',
        tournamentDates: tournament?.dates || '',
        tournamentPar: par,
        rounds: [totalScore || ''],
        totalPutts: [totalPutts || ''],
        scorecards: {
            0: {
                pars: Array(18).fill(Math.round(par / 18)),
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
    const [sourceText, setSourceText] = useState(initialText || initialUrl || '');
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState(() => parseRows(initialText || '').rows);
    const [message, setMessage] = useState('');

    const selectedTournament = orderedTournaments.find((tournament) => String(tournament.id) === selectedId) || null;

    const updateRow = (index, field, value) => {
        setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    };

    const handleTextChange = (value) => {
        setSourceText(value);
        const parsed = parseRows(value);
        if (parsed.parsed > 0) {
            setRows(parsed.rows);
            setMessage(`${parsed.parsed} hoyos detectados. Revisa los datos antes de guardar.`);
        } else if (value.trim()) {
            setMessage('No se han detectado filas automáticamente. Puedes introducir los datos en la tabla.');
        } else {
            setMessage('');
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
        await onSave(String(selectedTournament.id), buildImportedResult(selectedTournament, rows));
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
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem' }}>
                    <option value="">Selecciona un torneo</option>
                    {orderedTournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name} · {tournament.dates} · {tournament.course || 'Campo sin indicar'}</option>)}
                </select>

                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Texto o enlace compartido</label>
                <textarea value={sourceText} onChange={(event) => handleTextChange(event.target.value)} placeholder="Pega aquí el texto o enlace exportado desde otra app" rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: '0.7rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }} />

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', margin: '0.75rem 0 1rem', padding: '0.65rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: 700 }}>
                    <FileUp size={17} /> Añadir foto, PDF o CSV
                    <input type="file" accept="image/*,.pdf,.csv,.tsv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
                </label>
                {fileName && <span style={{ marginLeft: '0.6rem', color: '#64748b', fontSize: '0.85rem' }}>{fileName}</span>}
                {initialUrl && <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', fontSize: '0.85rem', marginBottom: '0.75rem' }}><Link2 size={15} /> Enlace recibido desde otra aplicación</div>}

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
