import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Download } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * TournamentsAdminPanel - Panel de gestión de torneos oficiales
 */
function TournamentsAdminPanel() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingTournament, setIsCreatingTournament] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    dates: '',
    location: '',
    organization: 'RFEG',
    category: 'Juvenil',
    type: 'strokeplay',
    details: '',
    official: true
  });

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const tournamentsSnapshot = await getDocs(collection(db, 'tournaments'));
      const tournamentsData = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTournaments(tournamentsData.sort((a, b) => {
        const dateA = new Date(a.dates?.split(' - ')[0]?.split('/').reverse().join('-'));
        const dateB = new Date(b.dates?.split(' - ')[0]?.split('/').reverse().join('-'));
        return dateB - dateA;
      }));
    } catch (error) {
      console.error('Error loading tournaments:', error);
      alert('Error al cargar torneos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();

    if (!formData.id || !formData.name || !formData.dates) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    setLoading(true);

    try {
      await setDoc(doc(db, 'tournaments', String(formData.id)), formData);
      alert(`✅ Torneo "${formData.name}" creado correctamente`);
      setIsCreatingTournament(false);
      resetForm();
      loadTournaments();
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert('Error al crear torneo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTournament = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      await setDoc(doc(db, 'tournaments', String(editingTournament.id)), formData);
      alert(`✅ Torneo "${formData.name}" actualizado correctamente`);
      setEditingTournament(null);
      resetForm();
      loadTournaments();
    } catch (error) {
      console.error('Error updating tournament:', error);
      alert('Error al actualizar torneo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTournament = async (tournament) => {
    const confirm = window.confirm(
      `⚠️ ¿Estás seguro de eliminar el torneo "${tournament.name}"?\n\nEsta acción NO se puede deshacer.`
    );

    if (!confirm) return;

    setLoading(true);

    try {
      await deleteDoc(doc(db, 'tournaments', String(tournament.id)));
      alert(`✅ Torneo "${tournament.name}" eliminado correctamente`);
      loadTournaments();
    } catch (error) {
      console.error('Error deleting tournament:', error);
      alert('Error al eliminar torneo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditTournament = (tournament) => {
    setEditingTournament(tournament);
    setFormData({ ...tournament });
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      dates: '',
      location: '',
      organization: 'RFEG',
      category: 'Juvenil',
      type: 'strokeplay',
      details: '',
      official: true
    });
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nombre', 'Fechas', 'Ubicación', 'Organización', 'Categoría', 'Tipo', 'Detalles'];
    const rows = tournaments.map(t => [
      t.id,
      t.name,
      t.dates,
      t.location,
      t.organization,
      t.category,
      t.type,
      t.details || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `torneos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading && tournaments.length === 0) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando torneos...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a' }}>
          Torneos Oficiales ({tournaments.length})
        </h2>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={exportToCSV}
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={18} />
            Exportar CSV
          </button>

          <button
            onClick={() => setIsCreatingTournament(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} />
            Crear Torneo
          </button>
        </div>
      </div>

      {/* Lista de torneos */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>ID</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Nombre</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Fechas</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Ubicación</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Org</th>
              <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((tournament) => (
              <tr key={tournament.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#64748b' }}>{tournament.id}</td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: '500', color: '#0f172a' }}>{tournament.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{tournament.category} • {tournament.type}</div>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#64748b' }}>{tournament.dates}</td>
                <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#64748b' }}>{tournament.location}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: '#f1f5f9',
                    color: '#475569'
                  }}>
                    {tournament.organization}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => startEditTournament(tournament)}
                      title="Editar torneo"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Edit size={16} color="#64748b" />
                    </button>
                    <button
                      onClick={() => handleDeleteTournament(tournament)}
                      title="Eliminar torneo"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #fee2e2',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Crear Torneo */}
      {isCreatingTournament && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 1000,
          paddingTop: '3rem',
          overflowY: 'auto'
        }}>
          <div className="card fade-in" style={{ width: '90%', maxWidth: '600px', padding: '2rem', margin: '1rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Crear Nuevo Torneo</h2>

            <form onSubmit={handleCreateTournament}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                    ID *
                  </label>
                  <input
                    type="number"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    placeholder="Ej: 201"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                    Organización
                  </label>
                  <select
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="RFEG">RFEG</option>
                    <option value="FCG">FCG</option>
                    <option value="club">Club</option>
                    <option value="juvenil">Juvenil</option>
                    <option value="adultos">Adultos</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Nombre del Torneo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Campeonato de España Juvenil"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Fechas * (Formato: DD/MM/YYYY o DD/MM/YYYY - DD/MM/YYYY)
                </label>
                <input
                  type="text"
                  value={formData.dates}
                  onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                  placeholder="Ej: 15/04/2026 - 16/04/2026"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Ubicación
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ej: Real Club de Golf El Prat"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                    Categoría
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ej: Juvenil"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                    Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="strokeplay">Stroke Play</option>
                    <option value="match">Match Play</option>
                    <option value="merit">Orden de Mérito</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Detalles (Opcional)
                </label>
                <textarea
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Descripción del torneo..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', minHeight: '80px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  {loading ? 'Creando...' : 'Crear Torneo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingTournament(false);
                    resetForm();
                  }}
                  className="btn"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Torneo */}
      {editingTournament && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 1000,
          paddingTop: '3rem',
          overflowY: 'auto'
        }}>
          <div className="card fade-in" style={{ width: '90%', maxWidth: '600px', padding: '2rem', margin: '1rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Editar Torneo: {editingTournament.name}</h2>

            <form onSubmit={handleEditTournament}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Nombre del Torneo
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Fechas
                </label>
                <input
                  type="text"
                  value={formData.dates}
                  onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Ubicación
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                    Organización
                  </label>
                  <select
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="RFEG">RFEG</option>
                    <option value="FCG">FCG</option>
                    <option value="club">Club</option>
                    <option value="juvenil">Juvenil</option>
                    <option value="adultos">Adultos</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                    Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="strokeplay">Stroke Play</option>
                    <option value="match">Match Play</option>
                    <option value="merit">Orden de Mérito</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTournament(null);
                    resetForm();
                  }}
                  className="btn"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentsAdminPanel;
