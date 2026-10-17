import { GENRES, pluralize, type Artist, type Playlist, type Track } from '@weegood/core';
import { useCallback, useMemo, type CSSProperties } from 'react';
import { Link, useSearch } from 'wouter';
import { useApp, useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { AsyncState } from '../../components/AsyncState';
import { EmptyState } from '../../components/EmptyState';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';
import { useQuery } from '../../hooks/useQuery';
import { hueFor } from '../../lib/hue';

interface Results {
  tracks: Track[];
  artists: Artist[];
  playlists: Playlist[];
}

export function SearchPage() {
  const search = useSearch();
  const query = (new URLSearchParams(search).get('q') ?? '').trim();
  const lower = query.toLowerCase();
  const { music } = useServices();
  const localTracks = useApp((state) => state.localTracks);
  const playlists = useApp((state) => state.playlists);
  const rememberTracks = useApp((state) => state.rememberTracks);

  const fetcher = useCallback(async (): Promise<Results> => {
    const [tracks, artists, remotePlaylists] = await Promise.all([
      music.searchTracks(query, 25),
      music.searchArtists(query, 8).catch(() => [] as Artist[]),
      music.searchPlaylists(query, 8).catch(() => [] as Playlist[]),
    ]);
    rememberTracks(tracks);
    return { tracks, artists, playlists: remotePlaylists };
  }, [music, query, rememberTracks]);
  const remote = useQuery<Results>(lower.length >= 2 ? `search:${lower}` : null, fetcher);

  const local = useMemo(() => {
    if (lower.length === 0)
      return { tracks: [] as Track[], playlists: [] as Playlist[], genres: [] as typeof GENRES };
    const match = (text: string) => text.toLowerCase().includes(lower);
    return {
      tracks: localTracks.filter((track) => match(track.title) || match(track.artistName)),
      playlists: playlists.filter((playlist) => match(playlist.name)),
      genres: GENRES.filter((genre) => match(genre.name)),
    };
  }, [lower, localTracks, playlists]);

  if (lower.length === 0) {
    return (
      <div className="page">
        <EmptyState
          icon="search"
          title="Search Weegood"
          description="Tracks, artists and playlists on Audius, plus your own files and playlists. Press / anywhere to jump here."
        />
      </div>
    );
  }

  const tracks = [...local.tracks, ...(remote.data?.tracks ?? [])];
  const artists = remote.data?.artists ?? [];
  const allPlaylists = [...local.playlists, ...(remote.data?.playlists ?? [])];
  const total = tracks.length + artists.length + allPlaylists.length + local.genres.length;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>Results for &ldquo;{query}&rdquo;</h1>
          <p className="muted">
            {remote.loading && total === 0
              ? 'Searching Audius...'
              : pluralize(total, 'match', 'matches')}
          </p>
        </div>
      </header>

      {local.genres.length > 0 && (
        <Section title="Genres">
          <div className="grid">
            {local.genres.map((genre) => (
              <Link
                key={genre.id}
                href={`/genre/${genre.id}`}
                className="tile"
                style={{ '--hue': genre.hue } as CSSProperties}
              >
                <span>{genre.name}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <AsyncState
        loading={remote.loading}
        error={remote.error}
        empty={total === 0}
        emptyMessage={`Nothing for "${query}". Try a shorter word, or browse by genre.`}
        onRetry={remote.refresh}
      >
        {artists.length > 0 && (
          <Section title="Artists">
            <div className="grid grid--wide">
              {artists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          </Section>
        )}

        {tracks.length > 0 && (
          <Section title="Tracks">
            <TrackList tracks={tracks} contextLabel={`Search: ${query}`} />
          </Section>
        )}

        {allPlaylists.length > 0 && (
          <Section title="Playlists">
            <div className="grid">
              {allPlaylists.map((playlist) => (
                <Link
                  key={playlist.id}
                  href={`/playlist/${encodeURIComponent(playlist.id)}`}
                  className="tile"
                  style={{ '--hue': hueFor(playlist.id) } as CSSProperties}
                >
                  <span className="truncate">{playlist.name}</span>
                  <span className="tile__sub">
                    {playlist.ownerName
                      ? `by ${playlist.ownerName}`
                      : pluralize(playlist.trackIds.length, 'track')}
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        )}
      </AsyncState>
    </div>
  );
}
