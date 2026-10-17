import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';

interface BaseDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

function BaseDialog({ open, onClose, title, children }: BaseDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose} aria-label={title}>
      <div className="dialog__body">
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

interface PromptDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

/** Ask for one line of text. Re-mounted per open via `key` so the input resets. */
export function PromptDialog({
  open,
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    onConfirm(value);
    onClose();
  };
  return (
    <BaseDialog open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="prompt-input">{label}</label>
          <input
            id="prompt-input"
            className="input"
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            maxLength={80}
          />
        </div>
        <div className="dialog__actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </BaseDialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <BaseDialog open={open} onClose={onClose} title={title}>
      <p className="muted">{message}</p>
      <div className="dialog__actions">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </BaseDialog>
  );
}
