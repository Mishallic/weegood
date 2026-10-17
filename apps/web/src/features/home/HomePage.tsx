import {
  buildHomeFeed,
  createEmptyProfile,
  describeVibe,
  genreById,
  NEUTRAL_VIBE,
  recommendArtists,
  topGenreIds,
  type Artist,
} from '@weegood/core';
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useApp, useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { AsyncState } from '../../components/AsyncState';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { Section } from '../../components/Section';
import { TrackCards } from '../../components/TrackCards';
import { useHomeCandidates } from '../../hooks/useHomeCandidates';
import { useRecommendationInput } from '../../hooks/useRecommendationInput';
import { greetingForHour } from '../../lib/format';
import { isDefined } from '../../lib/isDefined';

export function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <HomeFeed key={refreshKey} onRefresh={() => setRefreshKey((k) => k + 1)} />;
}

/**
 * The feed is computed from a snapshot of the profile and history taken when the page mounts, so
 * rows do not reshuffle while you listen. Follows stay live, because following is a deliberate act
 * whose effect you want to see. Refresh re-snapshots and refetches.
 */
function HomeFeed({ onRefresh }: { onRefresh: () => void }) {
  const { music } = useServices();
  const liveProfile = useApp((state) => state.profile);
  const liveListens = useApp((state) => state.recentListens);
  const localTrackCount = useApp((state) => state.localTracks.length);
  const dislikedIds = useApp((state) => state.profile?.dislikedTrackIds ?? []);
  const knownArtists = useApp((state) => state.artists);

  const candidates = useHomeCandidates();
  const [profile] = useState(liveProfile);
  const [recentListens] = useState(liveListens);
  const input = useRecommendationInput({
    tracks: candidates.tracks,
    peopleSignals: candidates.peopleSignals,
    profile,
    recentListens,
  });

  const feed = useMemo(
    () => (candidates.tracks.length > 0 ? buildHomeFeed(input, { perSection: 12 }) : []),
    [input, candidates.tracks.length],
  );

  const artistPool = useMemo(() => {
    const seen = new Map<string, Artist>();
    for (const track of candidates.tracks) {
      if (!track.artistId || seen.has(track.artistId)) continue;
      const artist = music.cachedArtist(track.artistId) ?? knownArtists[track.artistId];
      if (artist) seen.set(artist.id, artist);
    }
    return [...seen.values()];
  }, [candidates.tracks, music, knownArtists]);

  const artists = useMemo(() => recommendArtists(input, artistPool, 6), [input, artistPool]);

  const vibeWords = describeVibe(liveProfile?.vibe ?? NEUTRAL_VIBE, 3);
  const topGenres = topGenreIds(liveProfile ?? createEmptyProfile(0), 3)
    .map((id) => genreById(id))
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
        <Button
          variant="ghost"
          icon="refresh"
          onClick={() => {
            candidates.refresh();
            onRefresh();
          }}
        >
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

      <AsyncState
        loading={candidates.loading}
        error={candidates.error}
        empty={feed.length === 0}
        loadingMessage="Pulling what is playing right now on Audius..."
        emptyMessage="Nothing to show yet. Follow a few genres or artists and come back."
        onRetry={candidates.refresh}
      >
        {feed.map((section) => {
          const items = section.items.filter((item) => !disliked.has(item.track.id));
          if (items.length === 0) return null;
          return (
            <Section key={section.id} title={section.title} subtitle={section.subtitle}>
              <TrackCards items={items} contextLabel={section.title} />
            </Section>
          );
        })}

        {artists.length > 0 && (
          <Section
            title="Artists to follow"
            subtitle="Following shapes your feed and brings in what they repost."
          >
            <div className="grid grid--wide">
              {artists.map(({ artist, reasons }) => (
                <ArtistCard key={artist.id} artist={artist} reason={reasons[0]} />
              ))}
            </div>
          </Section>
        )}
      </AsyncState>
    </div>
  );
}
