import {
  buildHomeFeed,
  createEmptyProfile,
  describeVibe,
  genreById,
  NEUTRAL_VIBE,
  recommendArtists,
  topGenreIds,
  type Artist,
  type Genre,
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
import { VibeAura } from '../../components/VibeAura';
import { useHomeCandidates } from '../../hooks/useHomeCandidates';
import { useRecommendationInput } from '../../hooks/useRecommendationInput';
import { greetingForHour } from '../../lib/format';
import { isDefined } from '../../lib/isDefined';

export function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <HomeFeed key={refreshKey} onRefresh={() => setRefreshKey((k) => k + 1)} />;
}

/** "Good afternoon." with the first word roman and the rest italic, and a vermilion full stop. */
function PosterGreeting({ greeting }: { greeting: string }) {
  const trimmed = greeting.replace(/[.?]$/, '');
  const punctuation = greeting.endsWith('?') ? '?' : '.';
  const [first, ...rest] = trimmed.split(' ');
  return (
    <h1>
      {first}
      {rest.length > 0 && (
        <>
          {' '}
          <em>{rest.join(' ')}</em>
        </>
      )}
      <span className="dot">{punctuation}</span>
    </h1>
  );
}

/** One honest sentence about where the taste model stands. */
function vibeSentence(
  words: string[],
  topGenre: Genre | undefined,
  listenCount: number,
): { lead: string; highlight: string; tail: string } {
  if (words.length === 1 && words[0] === 'balanced' && listenCount < 5) {
    return {
      lead: 'Your vibe is still ',
      highlight: 'forming',
      tail: '. Play a few things and watch it sharpen.',
    };
  }
  const joined =
    words.length > 1
      ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
      : (words[0] ?? 'balanced');
  return {
    lead: 'Right now you read ',
    highlight: joined,
    tail:
      topGenre && !words.includes(topGenre.name.toLowerCase())
        ? `, leaning ${topGenre.name}.`
        : '.',
  };
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

  const currentVibe = liveProfile?.vibe ?? NEUTRAL_VIBE;
  const vibeWords = describeVibe(currentVibe, 3);
  const topGenres = topGenreIds(liveProfile ?? createEmptyProfile(0), 3)
    .map((id) => genreById(id))
    .filter(isDefined);
  const sentence = vibeSentence(vibeWords, topGenres[0], liveProfile?.listenCount ?? 0);
  const disliked = new Set(dislikedIds);

  return (
    <div className="page">
      <header className="page-header page-header--poster">
        <VibeAura vibe={currentVibe} />
        <div className="page-header__text">
          <span className="eyebrow">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
          <PosterGreeting greeting={greetingForHour(new Date().getHours())} />
          <p className="poster-lead">
            {sentence.lead}
            <span className="swash">{sentence.highlight}</span>
            {sentence.tail}
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
