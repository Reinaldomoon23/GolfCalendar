import { useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, Save, Search, Calculator } from 'lucide-react';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { updateParticipantScore } from '../../services/leaderboard.service';
import { dedupeAdminUsers } from '../../utils/adminUserRecords';
import { resolveCanonicalTournamentId } from '../../utils/tournamentIds';
import { useFeedbackLayer } from '../FeedbackLayer';

const DEFAULT_PARS = Array(18).fill(4);

function parseNumbersFromText(text) {
  const toScoreNumbers = (value) => (
    (String(value || '').match(/\d+/g)?.map(Number) || [])
      .filter((number) => number >= 1 && number <= 12)
  );

  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of [...lines].reverse()) {
    let numbers = toScoreNumbers(line);

    // Rows copied from leaderboards often start with the round number: "1  5 4 3..."
    if (numbers.length === 19 && /^[rR]?(nd|onda)?\s*1?\s*\d/.test(line)) {
      numbers = numbers.slice(1);
    }

    if (numbers.length === 18) return numbers;
  }

  const allNumbers = toScoreNumbers(text);
  if (allNumbers.length === 19) return allNumbers.slice(1);
  return allNumbers.slice(0, 18);
}

function sum(values) {
  return values.reduce((acc, value) => acc + (Number(value) || 0), 0);
}

function toDateValue(dates) {
  const [day, month, year] = String(dates || '').split(' - ')[0]?.split('/').map(Number) || [];
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function resolveTournamentPars(tournament, existingResult, roundIndex) {
  const existingCard = existingResult?.scorecards?.[String(roundIndex)] || existingResult?.scorecards?.[roundIndex];
  if (Array.isArray(existingCard?.pars) && existingCard.pars.length === 18) {
    return existingCard.pars.map((value) => Number(value) || 4);
  }

  if (Array.isArray(tournament?.pars) && tournament.pars.length === 18) {
    return tournament.pars.map((value) => Number(value) || 4);
  }

  if (Array.isArray(tournament?.scorecard?.pars) && tournament.scorecard.pars.length === 18) {
    return tournament.scorecard.pars.map((value) => Number(value) || 4);
  }

  const par = Number(tournament?.par || existingResult?.tournamentPar);
  if (Number.isFinite(par) && par > 0) {
    const base = Math.floor(par / 18);
    const remainder = par - base * 18;
    return Array.from({ length: 18 }, (_, index) => base + (index >= 18 - remainder ? 1 : 0));
  }

  return DEFAULT_PARS;
}

function buildResultPayload(existingResult, tournament, roundIndex, strokes, pars) {
  const scorecards = { ...(existingResult?.scorecards || {}) };
  scorecards[roundIndex] = {
    ...(scorecards[roundIndex] || scorecards[String(roundIndex)] || {}),
    pars,
    strokes,
  };

  const rounds = Array.isArray(existingResult?.rounds) ? [...existingResult.rounds] : [];
  rounds[roundIndex] = sum(strokes);

  const stableford = Array.isArray(existingResult?.stableford) ? [...existingResult.stableford] : [];
  if (stableford[roundIndex] === undefined) stableford[roundIndex] = '';

  const validRounds = rounds.filter((value) => Number(value) > 0).map(Number);
  const total = sum(validRounds);

  return {
    ...(existingResult || {}),
    position: existingResult?.position || '',
    points: existingResult?.points || '',
    comments: existingResult?.comments || '',
    handicap: existingResult?.handicap || '',
    rounds,
    stableford,
    total,
    average: validRounds.length ? (total / validRounds.length).toFixed(1) : 0,
    stablefordTotal: Number(existingResult?.stablefordTotal || 0),
    scorecards,
    updatedAt: new Date().toISOString(),
    tournamentName: tournament?.name || existingResult?.tournamentName || '',
    tournamentCourse: tournament?.course || tournament?.location || existingResult?.tournamentCourse || '',
    tournamentDates: tournament?.dates || existingResult?.tournamentDates || '',
    tournamentPar: sum(pars),
    track_putts: existingResult?.track_putts === true,
    track_girs: existingResult?.track_girs === true,
    tee_time: existingResult?.tee_time || null,
  };
}

function QuickResultsAdminPanel() {
  const [users, setUsers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [tournamentSearch, setTournamentSearch] = useState('campeonato de españa');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [roundIndex, setRoundIndex] = useState(1);
  const [pasteText, setPasteText] = useState('');
  const [strokes, setStrokes] = useState(Array(18).fill(''));
  const [existingResult, setExistingResult] = useState(null);
  const [existingLoading, setExistingLoading] = useState(false);
  const { notify, confirm, FeedbackLayer } = useFeedbackLayer();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [usersSnap, tournamentsSnap, sharedSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'tournaments')),
          getDocs(collection(db, 'shared_tournaments')),
        ]);

        const loadedUsers = dedupeAdminUsers(usersSnap.docs.map((userDoc) => ({
          id: userDoc.id,
          ...userDoc.data(),
        }))).sort((a, b) => String(a.full_name || a.username || '').localeCompare(String(b.full_name || b.username || '')));

        const byId = new Map();
        [...tournamentsSnap.docs, ...sharedSnap.docs].forEach((tournamentDoc) => {
          const data = { id: resolveCanonicalTournamentId(tournamentDoc.id), ...tournamentDoc.data() };
          byId.set(String(data.id), data);
        });

        const loadedTournaments = Array.from(byId.values()).sort((a, b) => toDateValue(b.dates) - toDateValue(a.dates));
        setUsers(loadedUsers);
        setTournaments(loadedTournaments);

        const championship = loadedTournaments.find((tournament) => normalizeText(tournament.name).includes('campeonato de espana'));
        if (championship) setSelectedTournamentId(String(championship.id));
      } catch (error) {
        notify(`Error cargando datos: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = normalizeText(userSearch);
    return users.filter((user) => {
      if (!term) return true;
      return normalizeText(`${user.full_name || ''} ${user.username || ''} ${user.federation_id || ''}`).includes(term);
    }).slice(0, 80);
  }, [users, userSearch]);

  const filteredTournaments = useMemo(() => {
    const term = normalizeText(tournamentSearch);
    return tournaments.filter((tournament) => {
      if (!term) return true;
      return normalizeText(`${tournament.name || ''} ${tournament.course || ''} ${tournament.location || ''} ${tournament.dates || ''}`).includes(term);
    }).slice(0, 80);
  }, [tournaments, tournamentSearch]);

  const selectedUser = users.find((user) => String(user.id) === String(selectedUserId));
  const selectedTournament = tournaments.find((tournament) => String(tournament.id) === String(selectedTournamentId));
  const parsedStrokes = strokes.map((value) => Number(value) || 0);
  const filledCount = parsedStrokes.filter((value) => value > 0).length;
  const outTotal = sum(parsedStrokes.slice(0, 9));
  const inTotal = sum(parsedStrokes.slice(9, 18));
  const total = outTotal + inTotal;
  const roundKey = Math.max(0, Number(roundIndex) - 1);
  const currentPars = resolveTournamentPars(selectedTournament, existingResult, roundKey);
  const parTotal = sum(currentPars);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingResult() {
      setExistingResult(null);
      if (!selectedUserId || !selectedTournamentId) return;
      setExistingLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', selectedUserId, 'results', String(selectedTournamentId)));
        if (!cancelled) {
          const data = snap.exists() ? snap.data() : null;
          setExistingResult(data);
          const card = data?.scorecards?.[String(roundKey)] || data?.scorecards?.[roundKey];
          if (Array.isArray(card?.strokes) && card.strokes.some((stroke) => Number(stroke) > 0)) {
            setStrokes(Array.from({ length: 18 }, (_, index) => String(card.strokes[index] || '')));
          }
        }
      } catch (error) {
        if (!cancelled) notify(`No se pudo leer resultado existente: ${error.message}`, 'error');
      } finally {
        if (!cancelled) setExistingLoading(false);
      }
    }

    loadExistingResult();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, selectedTournamentId, roundKey]);

  const handleExtract = () => {
    const values = parseNumbersFromText(pasteText);
    if (values.length !== 18) {
      notify(`He encontrado ${values.length} números válidos. Necesito exactamente 18.`, 'warning');
      return;
    }
    setStrokes(values.map(String));
    notify('18 hoyos extraídos correctamente.', 'success');
  };

  const handleStrokeChange = (index, value) => {
    const clean = String(value || '').replace(/\D+/g, '').slice(0, 2);
    setStrokes((previous) => {
      const next = [...previous];
      next[index] = clean;
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUser || !selectedTournament) {
      notify('Selecciona jugadora y torneo.', 'warning');
      return;
    }
    if (filledCount !== 18) {
      notify('Debes completar los 18 hoyos antes de guardar.', 'warning');
      return;
    }

    const cardExists = existingResult?.scorecards?.[String(roundKey)] || existingResult?.scorecards?.[roundKey];
    const hasExistingRound = Array.isArray(cardExists?.strokes) && cardExists.strokes.some((stroke) => Number(stroke) > 0);
    if (hasExistingRound) {
      const shouldOverwrite = await confirm({
        title: 'Sobrescribir ronda',
        message: `Ya hay datos en R${roundIndex} para ${selectedUser.full_name || selectedUser.username}.`,
        confirmText: 'Sobrescribir',
        cancelText: 'Cancelar',
        danger: true,
      });
      if (!shouldOverwrite) return;
    }

    setSaving(true);
    try {
      const payload = buildResultPayload(existingResult, selectedTournament, roundKey, parsedStrokes, currentPars);
      await setDoc(doc(db, 'users', selectedUser.id, 'results', String(selectedTournament.id)), payload, { merge: true });
      await updateParticipantScore({
        username: selectedUser.username,
        uid: selectedUser.uid || selectedUser.id,
        docId: selectedUser.id,
        full_name: selectedUser.full_name || selectedUser.username,
        photo_url: selectedUser.photo_url || null,
      }, String(selectedTournament.id), payload);

      setExistingResult(payload);
      notify(`R${roundIndex} guardada: ${total} golpes (${total - parTotal >= 0 ? '+' : ''}${total - parTotal}).`, 'success');
    } catch (error) {
      notify(`Error guardando resultado: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem' }}>
          Carga rápida de resultados
        </h2>
        <p style={{ color: '#64748b', margin: 0 }}>
          Pega 18 golpes, valida el total y guarda la ronda para una jugadora sin usar scripts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <section className="card" style={{ padding: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 800, color: '#334155', marginBottom: '0.45rem' }}>Buscar jugadora</label>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Nombre, usuario o licencia"
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box' }}
            />
          </div>
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          >
            <option value="">Seleccionar jugadora</option>
            {filteredUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name || user.username} @{user.username}
              </option>
            ))}
          </select>
        </section>

        <section className="card" style={{ padding: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 800, color: '#334155', marginBottom: '0.45rem' }}>Buscar torneo</label>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
            <input
              value={tournamentSearch}
              onChange={(event) => setTournamentSearch(event.target.value)}
              placeholder="Nombre, campo o fecha"
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box' }}
            />
          </div>
          <select
            value={selectedTournamentId}
            onChange={(event) => setSelectedTournamentId(event.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          >
            <option value="">Seleccionar torneo</option>
            {filteredTournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name} · {tournament.dates}
              </option>
            ))}
          </select>
        </section>

        <section className="card" style={{ padding: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 800, color: '#334155', marginBottom: '0.45rem' }}>Ronda</label>
          <select
            value={roundIndex}
            onChange={(event) => setRoundIndex(Number(event.target.value))}
            style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          >
            {[1, 2, 3, 4].map((round) => <option key={round} value={round}>Ronda {round}</option>)}
          </select>
          <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
            {existingLoading ? 'Leyendo resultado existente...' : selectedTournament ? `${selectedTournament.course || selectedTournament.location || 'Campo sin definir'}` : 'Selecciona torneo'}
          </div>
        </section>
      </div>

      <section className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontWeight: 800, color: '#334155', marginBottom: '0.45rem' }}>
          Pegar resultados
        </label>
        <textarea
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          placeholder="Ej: 5 4 3 7 4 5 4 5 4 4 5 3 5 4 4 5 3 4"
          rows={4}
          style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box', resize: 'vertical' }}
        />
        <button type="button" onClick={handleExtract} className="btn btn-secondary" style={{ marginTop: '0.75rem' }}>
          <ClipboardPaste size={16} />
          Extraer 18 hoyos
        </button>
      </section>

      <section className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>Tarjeta R{roundIndex}</h3>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', color: '#334155', fontWeight: 900 }}>
            <span>IDA {outTotal || '-'}</span>
            <span>VTA {inTotal || '-'}</span>
            <span><Calculator size={15} style={{ verticalAlign: '-2px' }} /> Total {total || '-'}</span>
            <span>Par {parTotal}</span>
            <span style={{ color: filledCount === 18 ? '#16a34a' : '#dc2626' }}>{filledCount}/18</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, minmax(42px, 1fr))', gap: '8px' }}>
          {Array.from({ length: 18 }, (_, index) => (
            <label key={index} style={{ display: 'grid', gap: '4px', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>
              H{index + 1}
              <input
                value={strokes[index]}
                onChange={(event) => handleStrokeChange(index, event.target.value)}
                inputMode="numeric"
                style={{ width: '100%', minWidth: 0, padding: '8px 4px', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 900, boxSizing: 'border-box' }}
              />
              <span style={{ color: '#94a3b8', textAlign: 'center' }}>P{currentPars[index] || '-'}</span>
            </label>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setPasteText('');
            setStrokes(Array(18).fill(''));
          }}
        >
          Limpiar
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar ronda'}
        </button>
      </div>

      <FeedbackLayer />
    </div>
  );
}

export default QuickResultsAdminPanel;
