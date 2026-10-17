import { useRef, useState } from 'react';

export function useFeedbackLayer() {
  const [notification, setNotification] = useState(null);
  const notificationTimer = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const confirmResolver = useRef(null);

  const notify = (message, type = 'info') => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    setNotification({ message, type });
    notificationTimer.current = setTimeout(() => setNotification(null), 3600);
  };

  const confirm = ({ title = 'Confirmar accion', message, confirmText = 'Aceptar', cancelText = 'Cancelar', danger = false }) => (
    new Promise((resolve) => {
      confirmResolver.current = resolve;
      setConfirmDialog({ title, message, confirmText, cancelText, danger });
    })
  );

  const resolveConfirm = (value) => {
    if (confirmResolver.current) confirmResolver.current(value);
    confirmResolver.current = null;
    setConfirmDialog(null);
  };

  const FeedbackLayer = () => (
    <>
      {notification && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '22px',
            transform: 'translateX(-50%)',
            zIndex: 10020,
            maxWidth: 'min(520px, calc(100vw - 32px))',
            padding: '12px 16px',
            borderRadius: '999px',
            color: notification.type === 'error' ? '#7f1d1d' : notification.type === 'warning' ? '#78350f' : '#064e3b',
            background: notification.type === 'error' ? '#fee2e2' : notification.type === 'warning' ? '#fef3c7' : '#dcfce7',
            border: notification.type === 'error' ? '1px solid #fecaca' : notification.type === 'warning' ? '1px solid #fde68a' : '1px solid #bbf7d0',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
            fontWeight: '800',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}
        >
          {notification.message}
        </div>
      )}
      {confirmDialog && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10010,
            background: 'rgba(15, 23, 42, 0.48)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => resolveConfirm(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(440px, 100%)',
              background: 'white',
              borderRadius: '18px',
              padding: '22px',
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.32)',
              border: '1px solid #e2e8f0'
            }}
          >
            <h3 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: '1.15rem' }}>{confirmDialog.title}</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', lineHeight: 1.5, fontWeight: '600' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                style={{ padding: '10px 16px', borderRadius: '999px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: '900', cursor: 'pointer' }}
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                style={{ padding: '10px 16px', borderRadius: '999px', border: 'none', background: confirmDialog.danger ? '#dc2626' : 'var(--color-primary)', color: 'white', fontWeight: '900', cursor: 'pointer' }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return { notify, confirm, FeedbackLayer };
}
