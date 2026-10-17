import type { Track } from '@weegood/core';
import { useApp, usePlayer } from '../app/storesContext';
import { TrackRow } from './TrackRow';

interface TrackListProps {
  tracks: readonly Track[];
  /** Shown in the player bar as "Playing from ...". */
  contextLabel?: string | undefined;
  reasons?: ReadonlyMap<string, string> | undefined;
  inPlaylistId?: string | undefined;
  onMove?: ((from: number, to: number) => void) | undefined;
  numbered?: boolean;
}

/** A vertical list that plays its tracks as one queue starting at the clicked row. */
export function TrackList({
  tracks,
  contextLabel,
  reasons,
  inPlaylistId,
  onMove,
  numbered = true,
}: TrackListProps) {
  const playQueue = usePlayer((state) => state.playQueue);
  const rememberTracks = useApp((state) => state.rememberTracks);
  const ids = tracks.map((track) => track.id);
  const total = tracks.length;
  const play = (i: number) => {
    rememberTracks(tracks);
    void playQueue(ids, i, contextLabel ?? null);
  };
  return (
    <div className="track-list">
      {tracks.map((track, i) => (
        <TrackRow
          key={`${track.id}-${i}`}
          track={track}
          index={numbered ? i : undefined}
          reason={reasons?.get(track.id)}
          onPlay={() => play(i)}
          inPlaylistId={inPlaylistId}
          onMoveUp={onMove && i > 0 ? () => onMove(i, i - 1) : undefined}
          onMoveDown={onMove && i < total - 1 ? () => onMove(i, i + 1) : undefined}
          menuDirection={total > 3 && i >= total - 2 ? 'up' : 'down'}
        />
      ))}
    </div>
  );
}
