import {
  centroid,
  describeVibe,
  formatCompactNumber,
  genreById,
  pluralize,
  type Artist,
  type Track,
} from '@weegood/core';
import { useCallback, useEffect, type CSSProperties } from 'react';
import { Link, useParams } from 'wouter';
import { useApp, usePlayer, useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { AsyncState } from '../../components/AsyncState';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { FollowButton } from '../../components/FollowButton';
import { NotFound } from '../../components/NotFound';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';
import { VibeAura } from '../../components/VibeAura';
import { useQuery } from '../../hooks/useQuery';
import { hueFor } from '../../lib/hue';
import { isDefined } from '../../lib/isDefined';

interface ArtistBundle {
  artist: Artist;
  tracks: Track[];
  related: Artist[];
  playlists: Array<{ id: string; name: string; trackCount: number }>;
}

export function ArtistPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? '');
  const { music } = useServices();
  const cached = useApp((state) => state.artists[id]);
  const rememberArtists = useApp((state) => state.rememberArtists);
  const rememberTracks = useApp((state) => state.rememberTracks);
  const playQueue = usePlayer((state) => state.playQueue);

  const fetcher = useCallback(async (): Promise<ArtistBundle | null> => {
    const [fetched, tracks, related, playlists] = await Promise.all([
      music.artist(id).catch(() => null),
      music.artistTracks(id, 50).catch(() => [] as Track[]),
      music.relatedArtists(id, 6).catch(() => [] as Artist[]),
      music.artistPlaylists(id, 10).catch(() => []),
    ]);
    const base = fetched ?? music.cachedArtist(id);
    if (!base) return null;
    const genreIds = [...new Set(tracks.flatMap((track) => track.genreIds))];
    const artist: Artist = {
      ...base,
      genreIds: genreIds.length > 0 ? genreIds : base.genreIds,
      vibe: tracks.length > 0 ? centroid(tracks.map((track) => ({ vibe: track.vibe }))) : base.vibe,
    };
    return {
      artist,
      tracks,
      related,
      playlists: playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        trackCount: playlist.trackIds.length,
      })),
    };
  }, [music, id]);

  const query = useQuery<ArtistBundle | null>(id ? `artist:${id}` : null, fetcher, {
    ttlMs: 15 * 60_000,
  });
  const bundle = query.data ?? null;
  const artist = bundle?.artist ?? cached;

  useEffect(() => {
    if (bundle) {
      rememberArtists([bundle.artist]);
      rememberTracks(bundle.tracks);
    }
  }, [bundle, rememberArtists, rememberTracks]);

  if (!id) return <NotFound what="artist" />;
  if (!query.loading && !artist) return <NotFound what="artist" />;
  if (!artist) {
    return (
      <div className="page">
        <p className="muted small">Loading artist...</p>
      </div>
    );
  }

  const genres = artist.genreIds.map((genreId) => genreById(genreId)).filter(isDefined);
  const hue = genres[0]?.hue ?? hueFor(artist.id);
  const tracks = bundle?.tracks ?? [];
  const externalUrl =
    artist.provider === 'audius' && artist.handle ? `https://audius.co/${artist.handle}` : null;

  return (
    <div className="page">
      <section className="hero">
        <VibeAura vibe={artist.vibe} />
        <Avatar name={artist.name} hue={hue} src={artist.avatarUrl} size={168} />
        <div className="hero__body">
          <span className="hero__kicker">
            Artist{artist.handle ? ` · @${artist.handle}` : ''}
            {artist.verified ? ' · verified' : ''}
          </span>
          <h1 className="hero__title">{artist.name}</h1>
          {artist.bio && <p className="muted">{artist.bio}</p>}
          <p className="small faint">
            {formatCompactNumber(artist.followerCount)} followers ·{' '}
            {pluralize(artist.trackCount, 'track')}
            {tracks.length > 0 ? ` · ${describeVibe(artist.vibe, 3).join(' · ')}` : ''}
          </p>
          {genres.length > 0 && (
            <div className="chip-row">
              {genres.map((genre) => (
                <Chip key={genre.id} href={`/genre/${genre.id}`} hue={genre.hue}>
                  {genre.name}
                </Chip>
              ))}
            </div>
          )}
          <div className="hero__actions">
            <Button
              variant="primary"
              icon="play"
              onClick={() => {
                rememberTracks(tracks);
                void playQueue(
                  tracks.map((track) => track.id),
                  0,
                  artist.name,
                );
              }}
              disabled={tracks.length === 0}
            >
              Play
            </Button>
            <FollowButton kind="artist" targetId={artist.id} artist={artist} />
            {externalUrl && (
              <a
                className="btn btn--ghost"
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on Audius
              </a>
            )}
          </div>
        </div>
      </section>

      <Section title="Tracks" subtitle="Most played first.">
        <AsyncState
          loading={query.loading}
          error={query.error}
          empty={tracks.length === 0}
          emptyMessage="No streamable tracks yet."
          onRetry={query.refresh}
        >
          <TrackList tracks={tracks} contextLabel={artist.name} />
        </AsyncState>
      </Section>

      {bundle && bundle.playlists.length > 0 && (
        <Section title="Playlists">
          <div className="grid">
            {bundle.playlists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/playlist/${encodeURIComponent(playlist.id)}`}
                className="tile"
                style={{ '--hue': hueFor(playlist.id) } as CSSProperties}
              >
                <span className="truncate">{playlist.name}</span>
                <span className="tile__sub">{pluralize(playlist.trackCount, 'track')}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {bundle && bundle.related.length > 0 && (
        <Section title="Fans also follow" subtitle="Related artists on Audius.">
          <div className="grid grid--wide">
            {bundle.related.map((other) => (
              <ArtistCard key={other.id} artist={other} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
