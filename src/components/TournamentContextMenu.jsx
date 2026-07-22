import ReactDOM from 'react-dom';
import { Copy, Edit, FileText, Trash2 } from 'lucide-react';

const QUICK_COLORS = ['#FECACA', '#FED7AA', '#BBF7D0', '#BAE6FD', '#C7D2FE', '#E2E8F0'];

const menuButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '10px',
  background: 'none',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  textAlign: 'left',
  color: '#333',
};

export default function TournamentContextMenu({
  menu,
  onEdit,
  onDuplicate,
  onReport,
  onCopyColor,
  onPasteColor,
  onQuickColor,
  onDelete,
}) {
  if (!menu) return null;

  const menuWidth = 170;
  const menuHeight = 270;
  let x = menu.x;
  let y = menu.y;

  if (x + menuWidth > window.innerWidth - 10) {
    x = window.innerWidth - menuWidth - 10;
  }

  if (y + menuHeight > window.innerHeight - 10) {
    y = window.innerHeight - menuHeight - 10;
  }

  return ReactDOM.createPortal(
    <div
      data-context-menu="true"
      role="menu"
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        top: Math.max(10, y + 5),
        left: Math.max(10, x),
        zIndex: 9999,
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        padding: '8px',
        minWidth: `${menuWidth}px`,
        animation: 'fadeIn 0.1s ease-out',
      }}
    >
      <button type="button" role="menuitem" onClick={() => onEdit(menu.tournament)} style={menuButtonStyle}>
        <Edit size={16} /> Editar
      </button>
      <button type="button" role="menuitem" onClick={() => onDuplicate(menu.tournament)} style={menuButtonStyle}>
        <Copy size={16} /> Duplicar
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onReport(menu.tournament)}
        style={{ ...menuButtonStyle, background: '#fffaf0', border: '1px solid #f1dfaa', borderRadius: '6px', color: '#8a640f', fontWeight: 800 }}
      >
        <FileText size={16} /> Abrir informe
      </button>

      <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

      <button type="button" role="menuitem" onClick={() => onCopyColor(menu.tournament)} style={menuButtonStyle}>
        <span style={{ width: 16, height: 16, borderRadius: 4, background: 'linear-gradient(45deg, red, blue)' }} /> Copiar Color
      </button>
      <button type="button" role="menuitem" onClick={() => onPasteColor(menu.tournament)} style={menuButtonStyle}>
        <span style={{ width: 16, height: 16, borderRadius: 4, border: '1px dashed #333' }} /> Pegar Color
      </button>

      <div style={{ display: 'flex', gap: '4px', padding: '8px', flexWrap: 'wrap' }}>
        {QUICK_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Aplicar color ${color}`}
            onClick={() => onQuickColor(menu.tournament, color)}
            style={{ width: 20, height: 20, borderRadius: '50%', background: color, cursor: 'pointer', border: '1px solid #ccc', padding: 0 }}
          />
        ))}
      </div>

      <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />
      <button type="button" role="menuitem" onClick={() => onDelete(menu.tournament)} style={{ ...menuButtonStyle, color: '#ef4444' }}>
        <Trash2 size={16} /> Borrar
      </button>
    </div>,
    document.body
  );
}
