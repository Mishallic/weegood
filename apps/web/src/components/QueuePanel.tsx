import { formatDuration } from '@weegood/core';
import { usePlayer, useStores } from '../app/storesContext';
import { cx } from '../lib/cx';
import { Button } from './Button';

export function QueuePanel() {
  const { resolveTrack } = useStores();
  const queue = usePlayer((state) => state.queue);
  const index = usePlayer((state) => state.index);
  const jumpTo = usePlayer((state) => state.jumpTo);
  const removeFromQueue = usePlayer((state) => state.removeFromQueue);
  const toggleQueue = usePlayer((state) => state.toggleQueue);
  const stop = usePlayer((state) => state.stop);

  return (
    <aside className="queue-panel" aria-label="Queue">
      <div className="row">
        <h3>Queue</h3>
        <span className="muted small">{queue.length} tracks</span>
        <span className="spacer" />
        {queue.length > 0 && (
          <Button variant="ghost" size="sm" onClick={stop}>
            Clear
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon="close"
          iconOnly
          label="Close queue"
          onClick={toggleQueue}
        />
      </div>
      <div className="queue-panel__list">
        {queue.length === 0 && (
          <p className="muted small">
            Nothing queued. Play something, or use "Add to queue" on any track.
          </p>
        )}
        {queue.map((id, position) => {
          const track = resolveTrack(id);
          if (!track) return null;
          const isCurrent = position === index;
          return (
            <div
              key={`${id}-${position}`}
              className={cx('track-row', isCurrent && 'track-row--active')}
              style={{ gridTemplateColumns: '28px minmax(0, 1fr) auto auto' }}
            >
              <span className="track-row__index">{position + 1}</span>
              <div
                className="track-row__main"
                role="button"
                tabIndex={0}
                onClick={() => void jumpTo(position)}
                onKeyDown={(event) => event.key === 'Enter' && void jumpTo(position)}
              >
                <span className={cx('track-row__title', 'truncate', position < index && 'faint')}>
                  {track.title}
                </span>
                <span className="track-row__meta truncate">{track.artistName}</span>
              </div>
              <span className="track-row__duration">{formatDuration(track.durationMs)}</span>
              <div className="track-row__actions">
                {!isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="close"
                    iconOnly
                    label="Remove from queue"
                    onClick={() => removeFromQueue(position)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
