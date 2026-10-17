import {
  FEATURED_GENRES,
  followedIds,
  topGenreIds,
  type Id,
  type PeopleSignal,
  type Track,
} from '@weegood/core';
import { useCallback, useMemo } from 'react';
import { useApp, useStores } from '../app/storesContext';
import { useQuery } from './useQuery';

export interface HomeCandidates {
  tracks: Track[];
  peopleSignals: PeopleSignal[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

interface Loaded {
  tracks: Track[];
  peopleSignals: PeopleSignal[];
}

const GENRE_LIMIT = 40;
const MAX_GENRES = 5;
const MAX_FOLLOWED_ARTISTS = 6;
const MAX_PEOPLE = 4;

/**
 * The candidate pool for the home feed: trending in the listener's top genres, rising tracks,
 * what followed artists released, and what followed people reposted or playlisted. Cached for
 * ten minutes; the engine does the ranking.
 */
export function useHomeCandidates(): HomeCandidates {
  const { services, useApp: appStore } = useStores();
  const genreWeights = useApp((state) => state.profile?.genreWeights);
  const follows = useApp((state) => state.follows);

  const genreIds = useMemo(() => {
    const picked = new Set<Id>(genreWeights ? topGenreIds({ genreWeights }, 4) : []);
    for (const id of followedIds(follows, 'genre')) if (picked.size < MAX_GENRES) picked.add(id);
    if (picked.size === 0) for (const genre of FEATURED_GENRES.slice(0, 4)) picked.add(genre.id);
    return [...picked].sort();
  }, [genreWeights, follows]);

  const followedArtistIds = useMemo(
    () => [...followedIds(follows, 'artist')].sort().slice(0, MAX_FOLLOWED_ARTISTS),
    [follows],
  );

  const key = `home:${genreIds.join(',')}|${followedArtistIds.join(',')}`;

  const fetcher = useCallback(async (): Promise<Loaded> => {
    const { music } = services;
    const safe = <T>(promise: Promise<T[]>): Promise<T[]> => promise.catch(() => []);

    const [perGenre, underground, perArtist, people] = await Promise.all([
      Promise.all(
        genreIds.map((genreId) =>
          safe(music.trending({ genreId, window: 'week', limit: GENRE_LIMIT })),
        ),
      ),
      safe(music.underground(30)),
      Promise.all(followedArtistIds.map((id) => safe(music.artistTracks(id, 10)))),
      Promise.all(
        followedArtistIds.slice(0, MAX_PEOPLE).map(async (id) => {
          const user = appStore.getState().artists[id];
          if (!user) return { signals: [] as PeopleSignal[], tracks: [] as Track[] };
          const [reposts, playlists] = await Promise.all([
            safe(music.artistReposts(id, 20)),
            safe(music.artistPlaylists(id, 3)),
          ]);
          const signals: PeopleSignal[] = [];
          const tracks: Track[] = [...reposts];
          if (reposts.length > 0) {
            signals.push({
              user,
              kind: 'repost',
              playlistName: null,
              trackIds: reposts.map((t) => t.id),
            });
          }
          for (const playlist of playlists.slice(0, 2)) {
            const full = await music.playlist(playlist.id).catch(() => null);
            if (!full || full.tracks.length === 0) continue;
            tracks.push(...full.tracks);
            signals.push({
              user,
              kind: 'playlist',
              playlistName: playlist.name,
              trackIds: full.tracks.map((t) => t.id),
            });
          }
          return { signals, tracks };
        }),
      ),
    ]);

    const seen = new Map<Id, Track>();
    for (const list of [...perGenre, underground, ...perArtist, ...people.map((p) => p.tracks)]) {
      for (const track of list) if (!seen.has(track.id)) seen.set(track.id, track);
    }
    const tracks = [...seen.values()];
    appStore.getState().rememberTracks(tracks);
    if (tracks.length === 0) throw new Error('Could not reach the music service.');
    return { tracks, peopleSignals: people.flatMap((p) => p.signals) };
  }, [services, appStore, genreIds, followedArtistIds]);

  const query = useQuery<Loaded>(key, fetcher, { ttlMs: 10 * 60_000 });

  return {
    tracks: query.data?.tracks ?? [],
    peopleSignals: query.data?.peopleSignals ?? [],
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
  };
}
