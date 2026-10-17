import type { Artist, Catalog, Id, Playlist, Track } from '@weegood/core';
import type { MusicProvider, TrendingOptions } from './types';

/**
 * An in-memory provider over a fixture catalog. Used by tests and by the app smoke test so no
 * network is needed. Behaves like a real provider: trending by genre, search, artists, playlists.
 */
export function createFakeProvider(catalog: Catalog): MusicProvider {
  const tracksById = new Map(catalog.tracks.map((track) => [track.id, track]));
  const artistsById = new Map(catalog.artists.map((artist) => [artist.id, artist]));
  const byPopularity = (a: Track, b: Track) => b.popularity - a.popularity;
  const match = (text: string, query: string) => text.toLowerCase().includes(query.toLowerCase());

  return {
    id: 'demo',
    async trending({ genreId = null, limit = 50 }: TrendingOptions = {}) {
      return catalog.tracks
        .filter((track) => !genreId || track.genreIds.includes(genreId))
        .sort(byPopularity)
        .slice(0, limit);
    },
    async underground(limit = 30) {
      return [...catalog.tracks].sort((a, b) => a.popularity - b.popularity).slice(0, limit);
    },
    async searchTracks(query, limit = 25) {
      return catalog.tracks
        .filter((t) => match(t.title, query) || match(t.artistName, query))
        .slice(0, limit);
    },
    async tracksByIds(ids: readonly Id[]) {
      return ids.map((id) => tracksById.get(id)).filter((t): t is Track => t !== undefined);
    },
    async artist(id) {
      return artistsById.get(id) ?? null;
    },
    async artistByHandle(handle) {
      return catalog.artists.find((artist) => artist.handle === handle) ?? null;
    },
    async artistTracks(id, limit = 50) {
      return catalog.tracks
        .filter((track) => track.artistId === id)
        .sort(byPopularity)
        .slice(0, limit);
    },
    async relatedArtists(id, limit = 8) {
      const artist = artistsById.get(id);
      if (!artist) return [];
      return catalog.artists
        .filter(
          (other) => other.id !== id && other.genreIds.some((g) => artist.genreIds.includes(g)),
        )
        .slice(0, limit);
    },
    async artistReposts(id, limit = 30) {
      const playlists = catalog.playlists.filter((playlist) => playlist.ownerId === id);
      const ids = playlists.flatMap((playlist) => playlist.trackIds).slice(0, limit);
      return ids
        .map((trackId) => tracksById.get(trackId))
        .filter((t): t is Track => t !== undefined);
    },
    async artistFavorites() {
      return [];
    },
    async artistPlaylists(id, limit = 20): Promise<Playlist[]> {
      return catalog.playlists.filter((playlist) => playlist.ownerId === id).slice(0, limit);
    },
    async searchArtists(query, limit = 12): Promise<Artist[]> {
      return catalog.artists.filter((artist) => match(artist.name, query)).slice(0, limit);
    },
    async trendingPlaylists(limit = 12) {
      return catalog.playlists.slice(0, limit);
    },
    async searchPlaylists(query, limit = 12) {
      return catalog.playlists.filter((playlist) => match(playlist.name, query)).slice(0, limit);
    },
    async playlist(id) {
      const playlist = catalog.playlists.find((p) => p.id === id);
      if (!playlist) return null;
      const tracks = playlist.trackIds
        .map((trackId) => tracksById.get(trackId))
        .filter((t): t is Track => t !== undefined);
      return { playlist, tracks };
    },
    cachedArtist(id) {
      return artistsById.get(id) ?? null;
    },
    streamUrl() {
      return null;
    },
  };
}
