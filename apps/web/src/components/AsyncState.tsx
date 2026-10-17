import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

interface AsyncStateProps {
  loading: boolean;
  error: Error | null;
  /** True when there is nothing to show even though loading finished without error. */
  empty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  onRetry?: (() => void) | undefined;
  children: ReactNode;
}

/** Wraps provider-backed content with the three states every network view needs. */
export function AsyncState({
  loading,
  error,
  empty = false,
  emptyMessage = 'Nothing here yet.',
  loadingMessage = 'Loading from Audius...',
  onRetry,
  children,
}: AsyncStateProps) {
  if (error && empty) {
    return (
      <div className="callout" role="alert">
        <Icon name="info" />
        <span className="stack" style={{ gap: 8 }}>
          <span>{error.message}</span>
          {onRetry && (
            <span>
              <Button size="sm" icon="refresh" onClick={onRetry}>
                Try again
              </Button>
            </span>
          )}
        </span>
      </div>
    );
  }
  if (loading && empty) return <p className="muted small">{loadingMessage}</p>;
  if (empty) return <p className="muted small">{emptyMessage}</p>;
  return <>{children}</>;
}
