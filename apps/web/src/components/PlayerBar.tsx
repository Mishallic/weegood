import { formatDuration } from '@weegood/core';
import type { CSSProperties } from 'react';
import { Link } from 'wouter';
import { useApp, usePlayer, useStores } from '../app/storesContext';
import { trackHue } from '../lib/hue';
import { Button } from './Button';
import { Cover } from './Cover';

export function PlayerBar() {
  const { resolveTrack } = useStores();
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
  const upcomingCount = usePlayer((state) => Math.max(0, state.queue.length - state.index - 1));
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
  const loading = status === 'loading';
  const progress = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

  return (
    <footer className="player-bar">
      <div className="player">
        <div className="player__now">
          {track ? (
            <>
              <Cover
                title={track.title}
                hue={trackHue(track)}
                src={track.artworkUrl}
                vibe={track.vibe}
                size={52}
              />
              <div className="player__now-text">
                <span className="player__title truncate">{track.title}</span>
                <span className="muted small truncate">
                  {track.artistId ? (
                    <Link href={`/artist/${encodeURIComponent(track.artistId)}`}>
                      {track.artistName}
                    </Link>
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
              label={loading ? 'Loading' : playing ? 'Pause' : 'Play'}
              onClick={() => void togglePlay()}
              disabled={!track || loading}
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
          {error && <span className="small player__error">{error}</span>}
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
          <span className="badge-anchor">
            <Button
              variant="ghost"
              size="sm"
              icon="queue"
              iconOnly
              label={upcomingCount > 0 ? `Queue, ${upcomingCount} up next` : 'Queue'}
              active={queueOpen}
              aria-pressed={queueOpen}
              onClick={toggleQueue}
            />
            {upcomingCount > 0 && (
              <span className="count-badge">{upcomingCount > 99 ? '99+' : upcomingCount}</span>
            )}
          </span>
        </div>
      </div>
    </footer>
  );
}
