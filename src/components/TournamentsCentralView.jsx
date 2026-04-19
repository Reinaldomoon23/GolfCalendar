import React, { useState, useMemo } from 'react';
import { Search, Trophy, MapPin, Globe, Flag, Plus, CheckCircle } from 'lucide-react';

export default function TournamentsCentralView({ user, tournaments, onAddTournament }) {
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('Todos');
  const [filterCircuit, setFilterCircuit] = useState('Todos');
  const [filterCategory, setFilterCategory] = useState('Todos');

  // Filter logic
  const filtered = useMemo(() => {
    return tournaments.filter(t => {
      // Show only official centralized ones (the ones with a code or specific type)
      const isOfficial = t.type === 'official' || (t.id && String(t.id).length > 5);
      if (!isOfficial) return false;

      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                          (t.id && String(t.id).toLowerCase().includes(search.toLowerCase()));
      const matchesCountry = filterCountry === 'Todos' || t.country === filterCountry;
      const matchesCircuit = filterCircuit === 'Todos' || t.circuit === filterCircuit;
      const matchesCategory = filterCategory === 'Todos' || t.category === filterCategory;

      return matchesSearch && matchesCountry && matchesCircuit && matchesCategory;
    });
  }, [tournaments, search, filterCountry, filterCircuit, filterCategory]);

  // Extract unique options for filters
  const countries = ['Todos', ...new Set(tournaments.map(t => t.country).filter(Boolean))];
  const circuits = ['Todos', ...new Set(tournaments.map(t => t.circuit).filter(Boolean))];
  const categories = ['Todos', ...new Set(tournaments.map(t => t.category).filter(Boolean))];

  const handleJoin = (t) => {
    if (onAddTournament) {
      onAddTournament(t);
      alert(`Te has apuntado a: ${t.name}`);
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

      {/* Tournament List */}
      <section className="tournament-list">
        {filtered.length === 0 ? (
          <div className="empty-state card">
            <p>No se han encontrado torneos con esos filtros.</p>
          </div>
        ) : (
          filtered.map(t => {
            const isJoined = false; // logic for joined check would go here

            return (
              <div key={t.id} className="tournament-card card">
                <div className="t-card-main">
                  <div className="t-hashtag">{t.id}</div>
                  <h3>{t.name}</h3>
                  <div className="t-meta">
                    <span>{t.dates}</span>
                    <span>•</span>
                    <span>{t.course}</span>
                  </div>
                  <div className="t-tags">
                    {t.country && <span className="tag country">{t.country}</span>}
                    {t.circuit && <span className="tag circuit">{t.circuit}</span>}
                    {t.category && <span className="tag category">{t.category}</span>}
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
          })
        )}
      </section>

      <style jsx>{`
        .tournaments-view {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
          margin-bottom: 80px;
        }
        .header-content h1 { margin: 0; font-size: 2rem; color: #f8fafc; }
        .header-content p { margin: 5px 0 0; color: #94a3b8; }
        .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .header-icon { color: #fcd34d; opacity: 0.8; }
        
        .filters-section { padding: 16px; margin-bottom: 20px; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); }
        .search-bar { display: flex; align-items: center; gap: 10px; background: #0f172a; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; }
        .search-bar input { background: transparent; border: none; color: white; width: 100%; outline: none; }
        
        .filter-group { display: flex; gap: 10px; flex-wrap: wrap; }
        .filter-item { flex: 1; min-width: 120px; }
        .filter-item label { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; color: #94a3b8; margin-bottom: 5px; }
        .filter-item select { width: 100%; padding: 8px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 6px; }
        
        .tournament-card { display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 12px; transition: transform 0.2s; }
        .tournament-card:hover { transform: translateY(-2px); border-color: #3b82f6; }
        .t-hashtag { font-family: monospace; font-size: 0.75rem; color: #3b82f6; background: rgba(59, 130, 246, 0.1); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 4px; }
        .t-card-main h3 { margin: 0 0 5px; font-size: 1.1rem; }
        .t-meta { font-size: 0.85rem; color: #94a3b8; display: flex; gap: 8px; margin-bottom: 10px; }
        .t-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; background: #334155; color: #cbd5e1; }
        .tag.country { border: 1px solid #059669; color: #34d399; }
        .tag.circuit { border: 1px solid #7c3aed; color: #a78bfa; }
        
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
