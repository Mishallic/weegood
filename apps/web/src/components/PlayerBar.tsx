import { formatDuration } from '@weegood/core';
import type { CSSProperties } from 'react';
import { Link } from 'wouter';
import { useApp, usePlayer, useServices, useStores } from '../app/storesContext';
import { trackHue } from '../lib/hue';
import { Button } from './Button';
import { Cover } from './Cover';
import { QueuePanel } from './QueuePanel';

export function PlayerBar() {
  const { resolveTrack } = useStores();
  const { index } = useServices();
  const currentTrackId = usePlayer((state) => state.currentTrackId);
  const status = usePlayer((state) => state.status);
  const positionMs = usePlayer((state) => state.positionMs);
  const durationMs = usePlayer((state) => state.durationMs);
  const volume = usePlayer((state) => state.volume);
  const shuffle = usePlayer((state) => state.shuffle);
  const repeat = usePlayer((state) => state.repeat);
  const contextLabel = usePlayer((state) => state.contextLabel);
  const error = usePlayer((state) => state.error);
  const queueOpen = usePlayer((state) => state.queueOpen);
  const togglePlay = usePlayer((state) => state.togglePlay);
  const next = usePlayer((state) => state.next);
  const previous = usePlayer((state) => state.previous);
  const seek = usePlayer((state) => state.seek);
  const setVolume = usePlayer((state) => state.setVolume);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);
  const cycleRepeat = usePlayer((state) => state.cycleRepeat);
  const toggleQueue = usePlayer((state) => state.toggleQueue);
  const liked = useApp(
    (state) =>
      (currentTrackId ? state.profile?.likedTrackIds.includes(currentTrackId) : false) ?? false,
  );
  const toggleLike = useApp((state) => state.toggleLike);

  const track = currentTrackId ? resolveTrack(currentTrackId) : undefined;
  const playing = status === 'playing';
  const progress = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

  return (
    <footer className="player-bar">
      <div className="player">
        <div className="player__now">
          {track ? (
            <>
              <Cover title={track.title} hue={trackHue(track, index.genresById)} size={48} />
              <div className="player__now-text">
                <span className="truncate" style={{ fontWeight: 600 }}>
                  {track.title}
                </span>
                <span className="muted small truncate">
                  {track.artistId ? (
                    <Link href={`/artist/${track.artistId}`}>{track.artistName}</Link>
                  ) : (
                    track.artistName
                  )}
                  {contextLabel && <span className="faint"> · {contextLabel}</span>}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={liked ? 'heartFilled' : 'heart'}
                iconOnly
                label={liked ? 'Unlike' : 'Like'}
                active={liked}
                onClick={() => void toggleLike(track)}
              />
            </>
          ) : (
            <span className="muted small">Pick something to play.</span>
          )}
        </div>

        <div className="player__center">
          <div className="player__controls">
            <Button
              variant="ghost"
              size="sm"
              icon="shuffle"
              iconOnly
              label={shuffle ? 'Shuffle on' : 'Shuffle off'}
              active={shuffle}
              aria-pressed={shuffle}
              onClick={toggleShuffle}
            />
            <Button
              variant="ghost"
              icon="previous"
              iconOnly
              label="Previous"
              onClick={() => void previous()}
              disabled={!track}
            />
            <Button
              className="player__main-btn"
              variant="primary"
              size="lg"
              icon={playing ? 'pause' : 'play'}
              iconOnly
              label={playing ? 'Pause' : 'Play'}
              onClick={() => void togglePlay()}
              disabled={!track}
            />
            <Button
              variant="ghost"
              icon="next"
              iconOnly
              label="Next"
              onClick={() => void next()}
              disabled={!track}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={repeat === 'one' ? 'repeatOne' : 'repeat'}
              iconOnly
              label={`Repeat ${repeat}`}
              active={repeat !== 'off'}
              onClick={cycleRepeat}
            />
          </div>
          <div className="player__seek">
            <span>{formatDuration(positionMs)}</span>
            <input
              type="range"
              className="slider"
              min={0}
              max={Math.max(durationMs, 1)}
              step={1000}
              value={Math.min(positionMs, durationMs)}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label="Seek"
              disabled={!track}
              style={{ '--fill': `${progress}%` } as CSSProperties}
            />
            <span>{formatDuration(durationMs)}</span>
          </div>
          {error && (
            <span className="small" style={{ color: 'var(--danger)' }}>
              {error}
            </span>
          )}
        </div>

        <div className="player__right">
          <Button
            className="player__volume-btn"
            variant="ghost"
            size="sm"
            icon={volume === 0 ? 'mute' : 'volume'}
            iconOnly
            label={volume === 0 ? 'Unmute' : 'Mute'}
            onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
          />
          <input
            type="range"
            className="slider slider--volume"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
            style={{ '--fill': `${volume * 100}%` } as CSSProperties}
          />
          <Button
            variant="ghost"
            size="sm"
            icon="queue"
            iconOnly
            label="Queue"
            active={queueOpen}
            aria-pressed={queueOpen}
            onClick={toggleQueue}
          />
        </div>
      </div>
      {queueOpen && <QueuePanel />}
    </footer>
  );
}
