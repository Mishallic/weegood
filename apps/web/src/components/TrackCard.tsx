import type { Recommendation } from '@weegood/core';
import { usePlayer, useServices } from '../app/storesContext';
import { trackHue } from '../lib/hue';
import { Button } from './Button';
import { Cover } from './Cover';

interface TrackCardProps {
  recommendation: Recommendation;
  onPlay: () => void;
}

/** A square card for feed rows: cover, title, artist and the reason it was picked. */
export function TrackCard({ recommendation, onPlay }: TrackCardProps) {
  const { index } = useServices();
  const { track, reasons } = recommendation;
  const isCurrent = usePlayer((state) => state.currentTrackId === track.id);
  const status = usePlayer((state) => state.status);
  const togglePlay = usePlayer((state) => state.togglePlay);
  const playing = isCurrent && status === 'playing';

  return (
    <div className="track-card">
      <Cover
        title={track.title}
        hue={trackHue(track, index.genresById)}
        size="100%"
        playing={playing}
        paused={isCurrent && !playing}
      />
      <Button
        className="track-card__play"
        variant="primary"
        icon={playing ? 'pause' : 'play'}
        iconOnly
        label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        onClick={() => {
          if (isCurrent) void togglePlay();
          else onPlay();
        }}
      />
      <div className="stack" style={{ gap: 2 }}>
        <span className="track-card__title truncate" title={track.title}>
          {track.title}
        </span>
        <span className="muted small truncate">{track.artistName}</span>
        {reasons[0] && <span className="track-card__reason">{reasons[0]}</span>}
      </div>
    </div>
  );
}
