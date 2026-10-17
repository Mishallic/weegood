import type { Recommendation } from '@weegood/core';
import { useApp, usePlayer } from '../app/storesContext';
import { TrackCard } from './TrackCard';

interface TrackCardsProps {
  items: readonly Recommendation[];
  contextLabel: string;
}

/** A horizontal row of cards that plays as one queue. */
export function TrackCards({ items, contextLabel }: TrackCardsProps) {
  const playQueue = usePlayer((state) => state.playQueue);
  const rememberTracks = useApp((state) => state.rememberTracks);
  const ids = items.map((item) => item.track.id);
  return (
    <div className="scroller">
      {items.map((item, i) => (
        <TrackCard
          key={item.track.id}
          recommendation={item}
          onPlay={() => {
            rememberTracks(items.map((entry) => entry.track));
            void playQueue(ids, i, contextLabel);
          }}
        />
      ))}
    </div>
  );
}
