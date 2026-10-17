import {
  buildHomeFeed,
  createEmptyProfile,
  describeVibe,
  NEUTRAL_VIBE,
  recommendArtists,
  topGenreIds,
} from '@weegood/core';
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useApp, usePlayer, useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { Section } from '../../components/Section';
import { TrackCard } from '../../components/TrackCard';
import { useRecommendationInput } from '../../hooks/useRecommendationInput';
import { greetingForHour } from '../../lib/format';
import { isDefined } from '../../lib/isDefined';

export function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <HomeFeed key={refreshKey} onRefresh={() => setRefreshKey((k) => k + 1)} />;
}

/**
 * The feed is computed from a snapshot of the profile and history taken when the page mounts, so
 * rows do not reshuffle while you listen. Follows are live, because following is a deliberate act
 * whose effect you want to see. Refresh re-snapshots.
 */
function HomeFeed({ onRefresh }: { onRefresh: () => void }) {
  const { catalog, index } = useServices();
  const liveProfile = useApp((state) => state.profile);
  const liveListens = useApp((state) => state.recentListens);
  const localTrackCount = useApp((state) => state.localTracks.length);
  const dislikedIds = useApp((state) => state.profile?.dislikedTrackIds ?? []);
  const playQueue = usePlayer((state) => state.playQueue);

  const [profile] = useState(liveProfile);
  const [recentListens] = useState(liveListens);
  const input = useRecommendationInput({ profile, recentListens });

  const feed = useMemo(() => buildHomeFeed(input, { perSection: 12 }), [input]);
  const artists = useMemo(() => recommendArtists(input, catalog.artists, 6), [input, catalog]);

  const vibeWords = describeVibe(liveProfile?.vibe ?? NEUTRAL_VIBE, 3);
  const topGenres = topGenreIds(liveProfile ?? createEmptyProfile(0), 3)
    .map((id) => index.genresById.get(id))
    .filter(isDefined);
  const disliked = new Set(dislikedIds);

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{greetingForHour(new Date().getHours())}</h1>
          <p className="muted">
            Your vibe right now: <strong>{vibeWords.join(', ')}</strong>
          </p>
          {topGenres.length > 0 && (
            <div className="chip-row">
              {topGenres.map((genre) => (
                <Chip key={genre.id} href={`/genre/${genre.id}`} hue={genre.hue}>
                  {genre.name}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <Button variant="ghost" icon="refresh" onClick={onRefresh}>
          Refresh
        </Button>
      </header>

      {localTrackCount === 0 && (
        <div className="callout">
          <Icon name="upload" />
          <span>
            Got MP3s, WAVs or FLACs? <Link href="/library">Import them</Link> and they play right
            alongside everything here, in the same playlists.
          </span>
        </div>
      )}

      {feed.map((section) => {
        const items = section.items.filter((item) => !disliked.has(item.track.id));
        if (items.length === 0) return null;
        const ids = items.map((item) => item.track.id);
        return (
          <Section key={section.id} title={section.title} subtitle={section.subtitle}>
            <div className="scroller">
              {items.map((item, i) => (
                <TrackCard
                  key={item.track.id}
                  recommendation={item}
                  onPlay={() => void playQueue(ids, i, section.title)}
                />
              ))}
            </div>
          </Section>
        );
      })}

      {artists.length > 0 && (
        <Section title="Artists to follow" subtitle="Following shapes your feed.">
          <div className="grid grid--wide">
            {artists.map(({ artist, reasons }) => (
              <ArtistCard key={artist.id} artist={artist} reason={reasons[0]} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
