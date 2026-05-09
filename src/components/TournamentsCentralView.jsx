import React, { useState, useMemo } from 'react';
import { Search, Trophy, MapPin, Globe, Flag, Plus, CheckCircle } from 'lucide-react';
import { isPast, parseDateHelper } from '../utils/dateHelpers';

function isBlockedTournament(tournament) {
  const normalizedName = String(tournament?.name || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const normalizedDates = String(tournament?.dates || '').trim();

  return (
    normalizedName === 'campionat de catalunya infantil, alevi i benjami' &&
    normalizedDates === '06/06/2026 - 07/06/2026'
  );
}

export default function TournamentsCentralView({ user, allTournaments = [], activeCalendarTournaments = [], subscribedTournaments = [], subscribedIds = [], onJoinTournament, onLeaveTournament }) {
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('Todos');
  const [filterCircuit, setFilterCircuit] = useState('Todos');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [filterType, setFilterType] = useState('Todos');

  // Emergency Rescue for ID 12 (Sub16) - If it's missing from the database, we INJECT it
  const finalTournaments = useMemo(() => {
    const seen = new Set();
    const unique = [];
    for (const t of allTournaments) {
      if (!t || !t.name) continue;
      if (isBlockedTournament(t)) continue;
      const normalizeStr = (s) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").trim() : "";
      const key = `${normalizeStr(t.name)}_${normalizeStr(t.dates)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }
    return unique;
  }, [allTournaments]);

  // Filter and Sort logic
  const filtered = useMemo(() => {
    return finalTournaments.filter(t => {
      // 1. Ocultar siempre los torneos pasados en la central
      if (isPast(t.dates)) return false;

      // FUERZA BRUTA: El ID 12 (Sub16), ID 13 (OM) y ID 15 (Infantil Catalunya) TIENEN QUE VERSE SIEMPRE
      const immortalIds = [12, 13, 15, '12', '13', '15'];
      if (immortalIds.includes(t.id)) return true;

      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                          (t.id && String(t.id).toLowerCase().includes(search.toLowerCase()));
      
      // Si es un torneo importante (Nacional/Regional), saltarse los filtros de circuito/país
      const isImportant = t.type === 'national_championship' || t.type === 'regional_championship';
      if (isImportant && (matchesSearch || search === '')) return true;

      const matchesCountry = filterCountry === 'Todos' || t.country === filterCountry;
      const matchesCircuit = filterCircuit === 'Todos' || t.circuit === filterCircuit;
      const matchesCategory = filterCategory === 'Todos' || t.category === filterCategory;

      let matchesType = true;
      if (filterType !== 'Todos') {
        const org = (t.organizer || '').toUpperCase();
        const groups = t.groups || [];
        if (filterType === 'RFEG') matchesType = org === 'RFEG';
        else if (filterType === 'FCG') matchesType = org === 'FCG';
        else if (filterType === 'Legacy') matchesType = groups.includes('legacy');
        else if (filterType === 'Mérito') matchesType = t.type === 'merit';
        else if (filterType === 'WAGR') matchesType = groups.includes('wagr');
        else if (filterType === 'Baby Cup') matchesType = groups.includes('baby_cup');
        else matchesType = t.type === filterType.toLowerCase();
      }

      return matchesSearch && matchesCountry && matchesCircuit && matchesCategory && matchesType;
    }).sort((a, b) => {
      // Sort by start date
      const { start: startA } = parseDateHelper(a.dates);
      const { start: startB } = parseDateHelper(b.dates);
      if (!startA) return 1;
      if (!startB) return -1;
      return startA.getTime() - startB.getTime();
    });
  }, [finalTournaments, search, filterCountry, filterCircuit, filterCategory, filterType]);

  // Extract unique options for filters
  const countries = ['Todos', ...new Set(finalTournaments.map(t => t.country).filter(Boolean))];
  const circuits = ['Todos', ...new Set(finalTournaments.map(t => t.circuit).filter(Boolean))];
  const categories = ['Todos', ...new Set(finalTournaments.map(t => t.category).filter(Boolean))];
  const types = ['Todos', 'RFEG', 'FCG', 'WAGR', 'Baby Cup', 'Legacy', 'Mérito'];

  const handleJoin = (t) => {
    if (onJoinTournament) {
      onJoinTournament(t);
    }
  };

  const handleLeave = (t) => {
    if (onLeaveTournament) {
      onLeaveTournament(t.id);
    }
  };

  return (
    <div className="view-container tournaments-view">
      <header className="view-header">
        <div className="header-content">
          <h1>Central de Torneos</h1>
          <p>Explora y únete a los torneos oficiales del equipo.</p>
        </div>
        <Trophy size={48} className="header-icon" />
      </header>

      {/* Filters Section */}
      <section className="filters-section card">
        <div className="search-bar">
          <Search size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o código (Hashtag)..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="filter-group">
          <div className="filter-item">
            <label><Globe size={14} /> País</label>
            <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label><Trophy size={14} /> Tipo</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label><Flag size={14} /> Circuito</label>
            <select value={filterCircuit} onChange={(e) => setFilterCircuit(e.target.value)}>
              {circuits.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label><MapPin size={14} /> Cat.</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Tournament List Grouped by Month */}
      <section className="tournament-list">
        {filtered.length === 0 ? (
          <div className="empty-state card">
            <p>No se han encontrado torneos con esos filtros.</p>
          </div>
        ) : (
          Object.entries(
            filtered.reduce((groups, t) => {
              const { start } = parseDateHelper(t.dates);
              let capitalizedMonth = 'Sin fecha';
              if (start) {
                // Ensure we get the month name in Spanish and capitalize it correctly
                const monthName = start.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
              }
              if (!groups[capitalizedMonth]) groups[capitalizedMonth] = [];
              groups[capitalizedMonth].push(t);
              return groups;
            }, {})
          ).sort((a, b) => {
            // Sort months chronologically
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const [monthA, yearA] = a[0].split(' ');
            const [monthB, yearB] = b[0].split(' ');
            if (yearA !== yearB) return yearA - yearB;
            return months.indexOf(monthA) - months.indexOf(monthB);
          }).map(([month, monthTournaments]) => (
            <div key={month} className="month-group">
              <h2 className="month-header">{month}</h2>
              {monthTournaments.map(t => {
                const isJoined = (subscribedIds || []).some(id => String(id) === String(t.id));
                const isOfficial = !t.isShared && !t.custom;
                
                return (
                  <div key={t.id} className={`tournament-card card ${isOfficial ? 'official' : ''}`}>
                    <div className="t-card-main">
                      <h3>
                        {t.name}
                        {isOfficial && <span className="badge-official">OFICIAL</span>}
                      </h3>
                      <div className="t-meta">
                        <span>{t.dates}</span>
                        <span>•</span>
                        <span>{t.course}</span>
                      </div>
                      {/* Participant Count & Admin View */}
                      <div className="t-participants-info">
                        <CheckCircle size={14} className="participants-icon" />
                        <span className="participants-count">
                          {(t.participantsCount || 0) + (isJoined && !(t.participantsNames || []).includes(user?.full_name) ? 1 : 0)} jugadoras inscritas
                        </span>
                        {user?.role === 'admin' && (
                          <button 
                            className="btn-text-only" 
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Jugadoras inscritas en ${t.name}:\n${t.participantsNames?.join(', ') || 'Nadie todavía'}`);
                            }}
                          >
                            (Ver quién)
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="t-card-actions">
                      {isJoined ? (
                        <button className="btn btn-success" disabled>
                          <CheckCircle size={18} /> Inscrita
                        </button>
                      ) : (
                        <button className="btn btn-primary" onClick={() => handleJoin(t)}>
                          <Plus size={18} /> Apuntarse
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </section>

      <style jsx>{`
        .month-header {
          color: #3b82f6;
          font-size: 1.2rem;
          font-weight: 800;
          margin: 30px 0 15px 5px;
          text-transform: capitalize;
          border-left: 4px solid #3b82f6;
          padding-left: 12px;
          letter-spacing: 0.05em;
        }
        .month-group {
          margin-bottom: 80px;
        }
        .tournaments-view {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
          margin-bottom: 80px;
        }
        .header-content h1 { margin: 0; font-size: 2rem; color: var(--color-primary); }
        .header-content p { margin: 5px 0 0; color: var(--color-text-muted); }
        .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .header-icon { color: var(--color-primary); opacity: 0.8; }
        
        .filters-section { padding: 16px; margin-bottom: 20px; background: var(--color-surface); border: 1px solid var(--color-surface-soft); border-radius: 12px; }
        .search-bar { display: flex; align-items: center; gap: 10px; background: var(--color-bg); padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid rgba(0,0,0,0.1); }
        .search-bar input { background: transparent; border: none; color: var(--color-text-main); width: 100%; outline: none; }
        .search-bar input::placeholder { color: var(--color-text-muted); }
        
        .filter-group { display: flex; gap: 10px; flex-wrap: wrap; }
        .filter-item { flex: 1; min-width: 120px; }
        .filter-item label { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 5px; font-weight: 600; }
        .filter-item select { width: 100%; padding: 8px; background: var(--color-surface); border: 1px solid rgba(0,0,0,0.1); color: var(--color-text-main); border-radius: 6px; }
        
        .tournament-card { display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 12px; transition: transform 0.2s; border: 1px solid rgba(0,0,0,0.05); }
        .tournament-card:hover { transform: translateY(-2px); border-color: var(--color-primary); }
        .t-hashtag { font-family: monospace; font-size: 0.75rem; color: var(--color-primary); background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 4px; }
        .t-card-main h3 { margin: 0 0 5px; font-size: 1.1rem; color: var(--color-text-main); }
        .t-meta { font-size: 0.85rem; color: var(--color-text-muted); display: flex; gap: 8px; margin-bottom: 10px; }
        .t-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; background: var(--color-surface-soft); color: var(--color-text-muted); }
        .tag.country { border: 1px solid #059669; color: #34d399; }
        .tag.circuit { border: 1px solid #7c3aed; color: #a78bfa; }
        
        .tournament-card.official { border-left: 4px solid #ef4444; }
        .tournament-card.official h3 { color: #ef4444; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        .badge-official { font-size: 0.65rem; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.5); padding: 2px 6px; border-radius: 4px; letter-spacing: 0.05em; font-weight: 700; }
        
        .t-card-actions { margin-left: 20px; }
        .btn-success { background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 8px; display: flex; align-items: center; gap: 5px; }
        .btn-primary { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 5px; }
        
        @media (max-width: 600px) {
          .tournament-card { flex-direction: column; align-items: flex-start; gap: 15px; }
          .t-card-actions { width: 100%; margin-left: 0; }
          .t-card-actions button { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
