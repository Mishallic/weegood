import { followedIds, type Artist } from '@weegood/core';
import { useCallback, useMemo, useState } from 'react';
import { useApp, useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { AsyncState } from '../../components/AsyncState';
import { Icon } from '../../components/Icon';
import { Section } from '../../components/Section';
import { useQuery } from '../../hooks/useQuery';
import { isDefined } from '../../lib/isDefined';

export function PeoplePage() {
  const { music } = useServices();
  const follows = useApp((state) => state.follows);
  const knownArtists = useApp((state) => state.artists);
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const followed = useMemo(
    () => [...followedIds(follows, 'artist')].map((id) => knownArtists[id]).filter(isDefined),
    [follows, knownArtists],
  );

  const searchFetcher = useCallback(() => music.searchArtists(trimmed, 12), [music, trimmed]);
  const search = useQuery<Artist[]>(
    trimmed.length >= 2 ? `people-search:${trimmed.toLowerCase()}` : null,
    searchFetcher,
  );

  const curatorsFetcher = useCallback(async () => {
    const playlists = await music.trendingPlaylists(12);
    const seen = new Map<string, Artist>();
    for (const playlist of playlists) {
      const owner = music.cachedArtist(playlist.ownerId);
      if (owner && !seen.has(owner.id)) seen.set(owner.id, owner);
    }
    return [...seen.values()];
  }, [music]);
  const curators = useQuery<Artist[]>('people-curators', curatorsFetcher, { ttlMs: 30 * 60_000 });

  const seedIds = useMemo(() => followed.slice(0, 3).map((artist) => artist.id), [followed]);
  const relatedFetcher = useCallback(async () => {
    const lists = await Promise.all(
      seedIds.map((id) => music.relatedArtists(id, 6).catch(() => [] as Artist[])),
    );
    const followedSet = new Set(followed.map((artist) => artist.id));
    const seen = new Map<string, Artist>();
    for (const list of lists) {
      for (const artist of list)
        if (!followedSet.has(artist.id) && !seen.has(artist.id)) seen.set(artist.id, artist);
    }
    return [...seen.values()].slice(0, 9);
  }, [music, seedIds, followed]);
  const related = useQuery<Artist[]>(
    seedIds.length > 0 ? `people-related:${seedIds.join(',')}` : null,
    relatedFetcher,
    {
      ttlMs: 30 * 60_000,
    },
  );

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>People</h1>
          <p className="muted">
            Artists and curators on Audius. Follow them and their tracks, reposts and playlists feed
            your home.
          </p>
        </div>
      </header>

      <label className="search" style={{ maxWidth: 'none' }}>
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Search people on Audius"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search people"
          autoComplete="off"
        />
      </label>

      {trimmed.length >= 2 && (
        <Section title={`Results for "${trimmed}"`}>
          <AsyncState
            loading={search.loading}
            error={search.error}
            empty={!search.data?.length}
            emptyMessage="No one by that name."
            onRetry={search.refresh}
          >
            <div className="grid grid--wide">
              {(search.data ?? []).map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          </AsyncState>
        </Section>
      )}

      {followed.length > 0 && (
        <Section title="People you follow">
          <div className="grid grid--wide">
            {followed.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </Section>
      )}

      {seedIds.length > 0 && (
        <Section title="You might also like" subtitle="Related to people you already follow.">
          <AsyncState
            loading={related.loading}
            error={related.error}
            empty={!related.data?.length}
            emptyMessage="Nothing yet."
            onRetry={related.refresh}
          >
            <div className="grid grid--wide">
              {(related.data ?? []).map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          </AsyncState>
        </Section>
      )}

      <Section
        title="Curators behind trending playlists"
        subtitle="People whose playlists are moving right now."
      >
        <AsyncState
          loading={curators.loading}
          error={curators.error}
          empty={!curators.data?.length}
          onRetry={curators.refresh}
        >
          <div className="grid grid--wide">
            {(curators.data ?? []).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </AsyncState>
      </Section>
    </div>
  );
}
