import { formatDuration, type Track } from '@weegood/core';
import { Link } from 'wouter';
import { useApp, usePlayer } from '../app/storesContext';
import { cx } from '../lib/cx';
import { trackHue } from '../lib/hue';
import { Button } from './Button';
import { Cover } from './Cover';
import { TrackMenu } from './TrackMenu';

interface TrackRowProps {
  track: Track;
  index?: number | undefined;
  reason?: string | undefined;
  onPlay: () => void;
  inPlaylistId?: string | undefined;
  onMoveUp?: (() => void) | undefined;
  onMoveDown?: (() => void) | undefined;
  menuDirection?: 'down' | 'up';
}

export function TrackRow({
  track,
  index,
  reason,
  onPlay,
  inPlaylistId,
  onMoveUp,
  onMoveDown,
  menuDirection = 'down',
}: TrackRowProps) {
  const isCurrent = usePlayer((state) => state.currentTrackId === track.id);
  const status = usePlayer((state) => state.status);
  const togglePlay = usePlayer((state) => state.togglePlay);
  const enqueue = usePlayer((state) => state.enqueue);
  const liked = useApp((state) => state.profile?.likedTrackIds.includes(track.id) ?? false);
  const toggleLike = useApp((state) => state.toggleLike);
  const rememberTracks = useApp((state) => state.rememberTracks);
  const notify = useApp((state) => state.notify);
  const playing = isCurrent && status === 'playing';
  const paused = isCurrent && !playing;

  const activate = () => {
    if (isCurrent) void togglePlay();
    else onPlay();
  };

  const addToQueue = () => {
    rememberTracks([track]);
    enqueue([track.id]);
    notify('Added to queue');
  };

  return (
    <div className={cx('track-row', isCurrent && 'track-row--active')}>
      <span className="track-row__index">{index !== undefined ? index + 1 : ''}</span>
      <button
        type="button"
        onClick={activate}
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        style={{ display: 'flex' }}
      >
        <Cover
          title={track.title}
          hue={trackHue(track)}
          src={track.artworkUrl}
          size={44}
          playing={playing}
          paused={paused}
        />
      </button>
      <div
        className="track-row__main"
        onClick={activate}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter') activate();
        }}
      >
        <span className="track-row__title truncate">{track.title}</span>
        <span className="track-row__meta">
          {track.artistId ? (
            <Link
              href={`/artist/${encodeURIComponent(track.artistId)}`}
              className="truncate"
              onClick={(event) => event.stopPropagation()}
            >
              {track.artistName}
            </Link>
          ) : (
            <span className="truncate">{track.artistName}</span>
          )}
          {track.source.kind === 'local' && <span className="badge badge--local">local</span>}
          {track.vibeSource === 'measured' && (
            <span className="badge" title="Vibe measured from the audio on this device">
              analysed
            </span>
          )}
          {reason && <span className="track-row__reason truncate">{reason}</span>}
        </span>
      </div>
      <span className="track-row__duration">{formatDuration(track.durationMs)}</span>
      <div className="track-row__actions">
        {onMoveUp && (
          <Button variant="ghost" size="sm" icon="up" iconOnly label="Move up" onClick={onMoveUp} />
        )}
        {onMoveDown && (
          <Button
            variant="ghost"
            size="sm"
            icon="down"
            iconOnly
            label="Move down"
            onClick={onMoveDown}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          icon="queue"
          iconOnly
          label={`Add ${track.title} to queue`}
          onClick={addToQueue}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={liked ? 'heartFilled' : 'heart'}
          iconOnly
          label={liked ? 'Unlike' : 'Like'}
          active={liked}
          aria-pressed={liked}
          onClick={() => void toggleLike(track)}
        />
        <TrackMenu track={track} inPlaylistId={inPlaylistId} direction={menuDirection} />
      </div>
    </div>
  );
}
