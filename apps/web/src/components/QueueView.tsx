import { formatDuration, pluralize, type Track } from '@weegood/core';
import { useState, type DragEvent } from 'react';
import { useLocation } from 'wouter';
import { useApp, usePlayer, useStores } from '../app/storesContext';
import { cx } from '../lib/cx';
import { trackHue } from '../lib/hue';
import { Button } from './Button';
import { Cover } from './Cover';
import { PromptDialog } from './Dialog';
import { EmptyState } from './EmptyState';

interface QueueViewProps {
  onClose?: (() => void) | undefined;
}

interface Entry {
  position: number;
  track: Track;
}

/**
 * The play queue: what is playing, what comes next, what already played. Rows reorder by drag on
 * pointer devices and by the arrow buttons everywhere; the current track keeps playing wherever it
 * lands.
 */
export function QueueView({ onClose }: QueueViewProps) {
  const { resolveTrack } = useStores();
  const [, navigate] = useLocation();
  const queue = usePlayer((state) => state.queue);
  const index = usePlayer((state) => state.index);
  const status = usePlayer((state) => state.status);
  const contextLabel = usePlayer((state) => state.contextLabel);
  const jumpTo = usePlayer((state) => state.jumpTo);
  const togglePlay = usePlayer((state) => state.togglePlay);
  const removeFromQueue = usePlayer((state) => state.removeFromQueue);
  const moveInQueue = usePlayer((state) => state.moveInQueue);
  const clearUpcoming = usePlayer((state) => state.clearUpcoming);
  const createPlaylist = useApp((state) => state.createPlaylist);
  const rememberTracks = useApp((state) => state.rememberTracks);
  const notify = useApp((state) => state.notify);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveKey, setSaveKey] = useState(0);

  const entries: Entry[] = [];
  queue.forEach((id, position) => {
    const track = resolveTrack(id);
    if (track) entries.push({ position, track });
  });
  const current = entries.find((entry) => entry.position === index);
  const upcoming = entries.filter((entry) => entry.position > index);
  const played = entries.filter((entry) => entry.position < index);
  const upcomingMs = upcoming.reduce((sum, entry) => sum + entry.track.durationMs, 0);

  const onDragStart = (position: number) => (event: DragEvent) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(position));
    setDragFrom(position);
  };
  const onDragOver = (position: number) => (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOver !== position) setDragOver(position);
  };
  const onDrop = (position: number) => (event: DragEvent) => {
    event.preventDefault();
    const from = dragFrom ?? Number(event.dataTransfer.getData('text/plain'));
    if (Number.isFinite(from) && from !== position) moveInQueue(from, position);
    setDragFrom(null);
    setDragOver(null);
  };
  const onDragEnd = () => {
    setDragFrom(null);
    setDragOver(null);
  };

  const saveAsPlaylist = (name: string) => {
    const ids = [current, ...upcoming]
      .filter((entry): entry is Entry => entry !== undefined)
      .map((entry) => entry.track.id);
    rememberTracks(
      [current, ...upcoming]
        .filter((entry): entry is Entry => entry !== undefined)
        .map((entry) => entry.track),
      true,
    );
    void createPlaylist(name, ids).then((playlist) => {
      if (!playlist) return;
      notify(`Saved ${playlist.name}`);
      onClose?.();
      navigate(`/playlist/${encodeURIComponent(playlist.id)}`);
    });
  };

  const row = (entry: Entry, kind: 'current' | 'upcoming' | 'played') => {
    const { position, track } = entry;
    const isCurrent = kind === 'current';
    const playing = isCurrent && status === 'playing';
    const draggable = kind !== 'current';
    return (
      <div
        key={`${track.id}-${position}`}
        className={cx(
          'track-row',
          'queue-row',
          isCurrent && 'track-row--active',
          kind === 'played' && 'queue-row--played',
          dragFrom === position && 'queue-row--dragging',
          dragOver === position && dragFrom !== null && dragFrom !== position && 'queue-row--over',
        )}
        draggable={draggable}
        onDragStart={draggable ? onDragStart(position) : undefined}
        onDragOver={onDragOver(position)}
        onDrop={onDrop(position)}
        onDragEnd={onDragEnd}
      >
        <span className="track-row__index">{kind === 'upcoming' ? position - index : ''}</span>
        <button
          type="button"
          aria-label={
            isCurrent
              ? playing
                ? `Pause ${track.title}`
                : `Play ${track.title}`
              : `Play ${track.title} now`
          }
          style={{ display: 'flex' }}
          onClick={() => {
            if (isCurrent) void togglePlay();
            else void jumpTo(position);
          }}
        >
          <Cover
            title={track.title}
            hue={trackHue(track)}
            src={track.artworkUrl}
            size={40}
            playing={playing}
            paused={isCurrent && !playing}
          />
        </button>
        <div
          className="track-row__main"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (isCurrent) void togglePlay();
            else void jumpTo(position);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void (isCurrent ? togglePlay() : jumpTo(position));
          }}
        >
          <span className="track-row__title truncate">{track.title}</span>
          <span className="track-row__meta truncate">{track.artistName}</span>
        </div>
        <span className="track-row__duration">{formatDuration(track.durationMs)}</span>
        <div className="track-row__actions">
          {kind === 'upcoming' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon="up"
                iconOnly
                label="Move up"
                disabled={position === index + 1}
                onClick={() => moveInQueue(position, position - 1)}
              />
              <Button
                variant="ghost"
                size="sm"
                icon="down"
                iconOnly
                label="Move down"
                disabled={position === queue.length - 1}
                onClick={() => moveInQueue(position, position + 1)}
              />
            </>
          )}
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
  };

  return (
    <>
      <div className="drawer__header">
        <div className="stack" style={{ gap: 0 }}>
          <h2>Queue</h2>
          <span className="muted small">
            {upcoming.length > 0
              ? `${pluralize(upcoming.length, 'track')} up next · ${formatDuration(upcomingMs)}`
              : current
                ? 'Nothing after this one'
                : 'Empty'}
            {contextLabel ? ` · from ${contextLabel}` : ''}
          </span>
        </div>
        <span className="spacer" />
        {current && (
          <Button
            variant="ghost"
            size="sm"
            icon="playlistAdd"
            iconOnly
            label="Save queue as playlist"
            onClick={() => {
              setSaveKey((k) => k + 1);
              setSaveOpen(true);
            }}
          />
        )}
        {(upcoming.length > 0 || played.length > 0) && (
          <Button variant="ghost" size="sm" onClick={clearUpcoming}>
            Clear
          </Button>
        )}
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            iconOnly
            label="Close queue"
            onClick={onClose}
          />
        )}
      </div>

      <div className="drawer__body">
        {entries.length === 0 ? (
          <EmptyState
            icon="queue"
            title="Your queue is empty"
            description="Play anything and the rest of its list lines up here. Use the queue button on any track to add it to the end, or Play next in its menu."
          />
        ) : (
          <>
            {current && (
              <>
                <div className="queue-label">Now playing</div>
                {row(current, 'current')}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <div className="queue-label">Up next</div>
                {upcoming.map((entry) => row(entry, 'upcoming'))}
              </>
            )}
            {played.length > 0 && (
              <>
                <div className="queue-label">Played earlier</div>
                {played.map((entry) => row(entry, 'played'))}
              </>
            )}
          </>
        )}
      </div>

      <PromptDialog
        key={saveKey}
        open={saveOpen}
        title="Save queue as playlist"
        label="Name"
        initialValue={contextLabel ? `${contextLabel} mix` : ''}
        placeholder="Tonight's queue"
        confirmLabel="Save"
        onClose={() => setSaveOpen(false)}
        onConfirm={saveAsPlaylist}
      />
    </>
  );
}
