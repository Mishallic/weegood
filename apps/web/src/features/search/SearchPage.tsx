import { pluralize } from '@weegood/core';
import { useMemo, type CSSProperties } from 'react';
import { Link, useSearch } from 'wouter';
import { useApp, useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { FollowButton } from '../../components/FollowButton';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';
import { hueFor } from '../../lib/hue';

export function SearchPage() {
  const search = useSearch();
  const query = (new URLSearchParams(search).get('q') ?? '').trim().toLowerCase();
  const { catalog } = useServices();
  const localTracks = useApp((state) => state.localTracks);
  const playlists = useApp((state) => state.playlists);

  const results = useMemo(() => {
    if (query.length === 0) return null;
    const match = (text: string) => text.toLowerCase().includes(query);
    return {
      tracks: [...localTracks, ...catalog.tracks]
        .filter((track) => match(track.title) || match(track.artistName))
        .slice(0, 25),
      artists: catalog.artists.filter((artist) => match(artist.name)).slice(0, 12),
      genres: catalog.genres.filter((genre) => match(genre.name)),
      people: catalog.users.filter((user) => match(user.displayName) || match(user.handle)),
      playlists: [...playlists, ...catalog.playlists].filter((playlist) => match(playlist.name)),
    };
  }, [query, localTracks, playlists, catalog]);

  if (!results) {
    return (
      <div className="page">
        <EmptyState
          icon="search"
          title="Search Weegood"
          description="Tracks, artists, genres, people and playlists. Press / anywhere to jump to the search box."
        />
      </div>
    );
  }

  const total =
    results.tracks.length +
    results.artists.length +
    results.genres.length +
    results.people.length +
    results.playlists.length;

  if (total === 0) {
    return (
      <div className="page">
        <EmptyState
          icon="search"
          title={`Nothing for "${query}"`}
          description="Try a shorter word, or browse by genre."
        />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>Results for &ldquo;{query}&rdquo;</h1>
          <p className="muted">{pluralize(total, 'match', 'matches')}</p>
        </div>
      </header>

      {results.genres.length > 0 && (
        <Section title="Genres">
          <div className="grid">
            {results.genres.map((genre) => (
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

      {results.artists.length > 0 && (
        <Section title="Artists">
          <div className="grid grid--wide">
            {results.artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </Section>
      )}

      {results.tracks.length > 0 && (
        <Section title="Tracks">
          <TrackList tracks={results.tracks} contextLabel={`Search: ${query}`} />
        </Section>
      )}

      {results.playlists.length > 0 && (
        <Section title="Playlists">
          <div className="grid">
            {results.playlists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/playlist/${playlist.id}`}
                className="tile"
                style={{ '--hue': hueFor(playlist.id) } as CSSProperties}
              >
                <span className="truncate">{playlist.name}</span>
                <span className="tile__sub">{pluralize(playlist.trackIds.length, 'track')}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {results.people.length > 0 && (
        <Section title="People">
          <div className="grid grid--wide">
            {results.people.map((user) => (
              <div key={user.id} className="entity-card">
                <Link
                  href={`/u/${user.handle}`}
                  style={{ display: 'flex' }}
                  aria-label={user.displayName}
                >
                  <Avatar name={user.displayName} hue={user.avatarHue} size={48} />
                </Link>
                <div className="entity-card__text">
                  <Link href={`/u/${user.handle}`} style={{ fontWeight: 600 }}>
                    {user.displayName}
                  </Link>
                  <span className="muted small">@{user.handle}</span>
                </div>
                <FollowButton kind="user" targetId={user.id} size="sm" />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
