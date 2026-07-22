import { ChevronLeft, Trash2, X } from 'lucide-react';

export default function TournamentDetailActions({
  tournament,
  isEditing,
  onBack,
  onToggleEdit,
  onDelete,
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <button
        type="button"
        onClick={onBack}
        className="btn"
        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
      >
        <ChevronLeft size={16} /> Volver
      </button>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={onToggleEdit}
          className="btn"
          aria-label={isEditing ? 'Cancelar edición' : 'Editar torneo'}
          title={isEditing ? 'Cancelar edición' : 'Editar torneo'}
          style={{
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border)',
            fontSize: '0.9rem',
            padding: '0.5rem 1rem',
          }}
        >
          {isEditing ? <X size={16} /> : <span style={{ fontSize: '1.2rem' }}>✏️</span>}
        </button>
        {tournament.custom && (
          <button
            type="button"
            onClick={onDelete}
            className="btn"
            aria-label="Borrar torneo"
            title="Borrar torneo"
            style={{
              color: 'var(--color-conflict)',
              border: '1px solid var(--color-conflict)',
              fontSize: '0.9rem',
              padding: '0.5rem',
            }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
