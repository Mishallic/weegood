import type { Artist, Id, Playlist, ProviderId, Track } from '@weegood/core';

export type TrendingWindow = 'week' | 'month' | 'allTime';

export interface TrendingOptions {
  genreId?: Id | null;
  window?: TrendingWindow;
  limit?: number;
}

/**
 * A source of real music (ADR 0010). Audius is the first implementation; others plug in behind
 * the same interface. All ids returned are app ids (`<provider>:<externalId>`).
 */
export interface MusicProvider {
  readonly id: ProviderId;
  trending(options?: TrendingOptions): Promise<Track[]>;
  underground(limit?: number): Promise<Track[]>;
  searchTracks(query: string, limit?: number): Promise<Track[]>;
  tracksByIds(ids: readonly Id[]): Promise<Track[]>;
  artist(id: Id): Promise<Artist | null>;
  artistByHandle(handle: string): Promise<Artist | null>;
  artistTracks(id: Id, limit?: number): Promise<Track[]>;
  relatedArtists(id: Id, limit?: number): Promise<Artist[]>;
  artistReposts(id: Id, limit?: number): Promise<Track[]>;
  artistFavorites(id: Id, limit?: number): Promise<Track[]>;
  artistPlaylists(id: Id, limit?: number): Promise<Playlist[]>;
  searchArtists(query: string, limit?: number): Promise<Artist[]>;
  trendingPlaylists(limit?: number): Promise<Playlist[]>;
  searchPlaylists(query: string, limit?: number): Promise<Playlist[]>;
  playlist(id: Id): Promise<{ playlist: Playlist; tracks: Track[] } | null>;
  /**
   * An artist seen inside any earlier response (track owners, playlist owners), with genres
   * inferred from their tracks. Synchronous and free; null if never seen.
   */
  cachedArtist(id: Id): Artist | null;
  /** A URL the audio element can play. Resolved at play time; may redirect. */
  streamUrl(track: Track): string | null;
}

export class ProviderError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

export function makeId(provider: ProviderId, externalId: string): Id {
  return `${provider}:${externalId}`;
}

export function splitId(id: Id): { provider: string; externalId: string } | null {
  const colon = id.indexOf(':');
  if (colon <= 0) return null;
  return { provider: id.slice(0, colon), externalId: id.slice(colon + 1) };
}
