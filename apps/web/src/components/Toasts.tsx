import { useApp } from '../app/storesContext';
import { cx } from '../lib/cx';

export function Toasts() {
  const toasts = useApp((state) => state.toasts);
  const dismiss = useApp((state) => state.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={cx('toast', toast.kind === 'error' && 'toast--error')}
          onClick={() => dismiss(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
