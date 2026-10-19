import { describeVibe, genreById, rankAll, type Artist, type Track } from '@weegood/core';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'wouter';
import { useApp, usePlayer, useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { AsyncState } from '../../components/AsyncState';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Cover } from '../../components/Cover';
import { FollowButton } from '../../components/FollowButton';
import { NotFound } from '../../components/NotFound';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';
import { VibeAura } from '../../components/VibeAura';
import { useQuery } from '../../hooks/useQuery';
import { useRecommendationInput } from '../../hooks/useRecommendationInput';
import type { TrendingWindow } from '../../providers/types';

const WINDOWS: Array<{ id: TrendingWindow; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'allTime', label: 'All time' },
];

export function GenrePage() {
  const { id = '' } = useParams<{ id: string }>();
  const { music } = useServices();
  const rememberTracks = useApp((state) => state.rememberTracks);
  const playQueue = usePlayer((state) => state.playQueue);
  const genre = genreById(id);
  const [window, setWindow] = useState<TrendingWindow>('week');
  const [personal, setPersonal] = useState(true);

  const fetcher = useCallback(async () => {
    const tracks = await music.trending({ genreId: id, window, limit: 100 });
    rememberTracks(tracks);
    return tracks;
  }, [music, id, window, rememberTracks]);
  const query = useQuery<Track[]>(genre ? `genre:${id}:${window}` : null, fetcher);
  const tracks = useMemo(() => query.data ?? [], [query.data]);

  const input = useRecommendationInput({ tracks });
  const ordered = useMemo(
    () =>
      personal
        ? rankAll(input)
        : tracks.map((track) => ({ track, score: track.popularity, reasons: [] as string[] })),
    [personal, input, tracks],
  );
  const reasons = useMemo(
    () => new Map(ordered.map((item) => [item.track.id, item.reasons[0] ?? ''])),
    [ordered],
  );

  const artists = useMemo(() => {
    const seen = new Map<string, Artist>();
    for (const track of tracks) {
      if (!track.artistId || seen.has(track.artistId)) continue;
      const artist = music.cachedArtist(track.artistId);
      if (artist) seen.set(artist.id, artist);
    }
    return [...seen.values()].sort((a, b) => b.followerCount - a.followerCount).slice(0, 6);
  }, [tracks, music]);

  if (!genre) return <NotFound what="genre" />;

  const orderedTracks = ordered.map((item) => item.track);

  return (
    <div className="page">
      <section className="hero">
        <VibeAura vibe={genre.vibe} />
        <Cover title={genre.name} hue={genre.hue} vibe={genre.vibe} size={168} />
        <div className="hero__body">
          <span className="hero__kicker">Genre</span>
          <h1 className="hero__title">{genre.name}</h1>
          <p className="muted">{genre.description}</p>
          <p className="small faint">{describeVibe(genre.vibe, 3).join(' · ')}</p>
          <div className="hero__actions">
            <Button
              variant="primary"
              icon="play"
              onClick={() => {
                rememberTracks(orderedTracks);
                void playQueue(
                  orderedTracks.map((track) => track.id),
                  0,
                  genre.name,
                );
              }}
              disabled={orderedTracks.length === 0}
            >
              Play
            </Button>
            <FollowButton kind="genre" targetId={genre.id} />
          </div>
        </div>
      </section>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="chip-row">
          {WINDOWS.map((option) => (
            <Chip
              key={option.id}
              pressed={window === option.id}
              onClick={() => setWindow(option.id)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        <span className="spacer" />
        <div className="chip-row">
          <Chip pressed={personal} onClick={() => setPersonal(true)}>
            For you
          </Chip>
          <Chip pressed={!personal} onClick={() => setPersonal(false)}>
            Most played
          </Chip>
        </div>
      </div>

      {artists.length > 0 && (
        <Section title="Artists in this genre">
          <div className="grid grid--wide">
            {artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Tracks"
        subtitle={
          personal ? 'Ordered by how well each one fits you.' : 'Ordered by plays on Audius.'
        }
      >
        <AsyncState
          loading={query.loading}
          error={query.error}
          empty={tracks.length === 0}
          onRetry={query.refresh}
        >
          <TrackList
            tracks={orderedTracks}
            contextLabel={genre.name}
            reasons={personal ? reasons : undefined}
          />
        </AsyncState>
      </Section>
    </div>
  );
}
