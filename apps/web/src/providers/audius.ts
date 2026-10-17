import {
  audiusNameForGenre,
  genreIdForAudiusName,
  NEUTRAL_VIBE,
  popularityFromEngagement,
  priorVibeForTrack,
  type Artist,
  type Id,
  type Playlist,
  type Track,
} from '@weegood/core';
import { makeId, ProviderError, splitId, type MusicProvider, type TrendingOptions } from './types';

/**
 * Audius: an open, free music network with a public API, full-length streams and permissive CORS
 * (ADR 0010). No key is required; `app_name` identifies us. Tracks carry mood, genre, tags, play
 * counts and, on most uploads, server-analysed BPM and key, which feed the vibe prior.
 */

export const AUDIUS_HOST = 'https://api.audius.co';
const APP_NAME = 'weegood';
const MAX_LIMIT = 100;

export interface AudiusOptions {
  host?: string;
  fetch?: typeof fetch;
}

/* Raw API shapes, only the fields we read. */
interface RawArtwork {
  '150x150'?: string;
  '480x480'?: string;
  '1000x1000'?: string;
}

interface RawUser {
  id: string;
  name: string;
  handle: string;
  bio?: string | null;
  follower_count?: number;
  track_count?: number;
  is_verified?: boolean;
  is_deactivated?: boolean;
  profile_picture?: RawArtwork | null;
}

interface RawTrack {
  id: string;
  title: string;
  user: RawUser;
  genre?: string | null;
  mood?: string | null;
  tags?: string | null;
  duration?: number;
  release_date?: string | null;
  artwork?: RawArtwork | null;
  play_count?: number;
  favorite_count?: number;
  repost_count?: number;
  bpm?: number | null;
  musical_key?: string | null;
  permalink?: string | null;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  is_unlisted?: boolean;
  is_delete?: boolean;
}

interface RawPlaylist {
  id: string;
  playlist_name: string;
  description?: string | null;
  user: RawUser;
  artwork?: RawArtwork | null;
  is_private?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  playlist_contents?: { track_ids?: Array<{ track_id?: string }> } | null;
  tracks?: RawTrack[];
}

interface RawRepost {
  item_type?: string;
  item?: RawTrack;
}

interface RawFavorite {
  favorite_item_id?: string;
  favorite_type?: string;
}

export function createAudiusProvider(options: AudiusOptions = {}): MusicProvider {
  const host = (options.host ?? AUDIUS_HOST).replace(/\/$/, '');
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));

  /** Users seen in any payload, and the genres of the tracks they were seen with. */
  const users = new Map<string, RawUser>();
  const genresByUser = new Map<string, Set<Id>>();

  const rememberUser = (user: RawUser | undefined, genreId: Id | null): void => {
    if (!user || !user.id) return;
    users.set(user.id, user);
    if (genreId) {
      const set = genresByUser.get(user.id) ?? new Set<Id>();
      set.add(genreId);
      genresByUser.set(user.id, set);
    }
  };

  const toTracks = (raw: readonly RawTrack[]): Track[] => {
    const out: Track[] = [];
    for (const item of raw) {
      if (!item || !item.id || !item.user) continue;
      rememberUser(item.user, genreIdForAudiusName(item.genre));
      if (
        item.is_streamable === false ||
        item.is_stream_gated ||
        item.is_unlisted ||
        item.is_delete
      )
        continue;
      if (item.user.is_deactivated) continue;
      out.push(mapTrack(item));
    }
    return out;
  };

  const toArtists = (raw: readonly RawUser[]): Artist[] => {
    const out: Artist[] = [];
    for (const user of raw) {
      if (!user || !user.id || user.is_deactivated) continue;
      rememberUser(user, null);
      out.push(mapArtist(user, [...(genresByUser.get(user.id) ?? [])]));
    }
    return out;
  };

  const toPlaylists = (raw: readonly RawPlaylist[]): Playlist[] => {
    const out: Playlist[] = [];
    for (const item of raw) {
      if (!item || !item.id || !item.user) continue;
      rememberUser(item.user, null);
      out.push(mapPlaylist(item));
    }
    return out;
  };

  async function get<T>(
    path: string,
    params: Record<string, string | number | string[] | undefined> = {},
  ): Promise<T> {
    const url = new URL(`${host}/v1${path}`);
    url.searchParams.set('app_name', APP_NAME);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, item);
      else url.searchParams.set(key, String(value));
    }
    let response: Response;
    try {
      response = await doFetch(url.toString(), { headers: { Accept: 'application/json' } });
    } catch (error) {
      throw new ProviderError(error instanceof Error ? error.message : 'Network error');
    }
    if (!response.ok)
      throw new ProviderError(`Audius responded ${response.status}`, response.status);
    const body = (await response.json()) as { data?: T };
    if (body.data === undefined) throw new ProviderError('Audius returned no data');
    return body.data;
  }

  const external = (id: Id): string => {
    const parts = splitId(id);
    if (!parts || parts.provider !== 'audius') throw new ProviderError(`Not an Audius id: ${id}`);
    return parts.externalId;
  };

  const provider: MusicProvider = {
    id: 'audius',

    async trending({ genreId = null, window = 'week', limit = 50 }: TrendingOptions = {}) {
      const genre = genreId ? audiusNameForGenre(genreId) : null;
      if (genreId && !genre) return [];
      return toTracks(
        await get<RawTrack[]>('/tracks/trending', {
          genre: genre ?? undefined,
          time: window,
          limit: Math.min(limit, MAX_LIMIT),
        }),
      );
    },

    async underground(limit = 30) {
      return toTracks(
        await get<RawTrack[]>('/tracks/trending/underground', {
          limit: Math.min(limit, MAX_LIMIT),
        }),
      );
    },

    async searchTracks(query, limit = 25) {
      if (!query.trim()) return [];
      return toTracks(await get<RawTrack[]>('/tracks/search', { query: query.trim(), limit }));
    },

    async tracksByIds(ids) {
      const externals = ids
        .map((id) => splitId(id))
        .filter((parts) => parts?.provider === 'audius')
        .map((parts) => parts?.externalId ?? '');
      if (externals.length === 0) return [];
      const out: Track[] = [];
      for (let i = 0; i < externals.length; i += 50) {
        out.push(...toTracks(await get<RawTrack[]>('/tracks', { id: externals.slice(i, i + 50) })));
      }
      return out;
    },

    async artist(id) {
      const raw = await get<RawUser | RawUser[]>(`/users/${encodeURIComponent(external(id))}`);
      const user = Array.isArray(raw) ? raw[0] : raw;
      return user ? (toArtists([user])[0] ?? null) : null;
    },

    async artistByHandle(handle) {
      const raw = await get<RawUser | RawUser[]>(`/users/handle/${encodeURIComponent(handle)}`);
      const user = Array.isArray(raw) ? raw[0] : raw;
      return user ? (toArtists([user])[0] ?? null) : null;
    },

    async artistTracks(id, limit = 50) {
      const raw = await get<RawTrack[]>(`/users/${encodeURIComponent(external(id))}/tracks`, {
        limit: Math.min(limit, MAX_LIMIT),
      });
      return toTracks(raw).sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
    },

    async relatedArtists(id, limit = 8) {
      return toArtists(
        await get<RawUser[]>(`/users/${encodeURIComponent(external(id))}/related`, { limit }),
      );
    },

    async artistReposts(id, limit = 30) {
      const raw = await get<RawRepost[]>(`/users/${encodeURIComponent(external(id))}/reposts`, {
        limit,
      });
      return toTracks(
        raw.filter((r) => r.item_type === 'track' && r.item).map((r) => r.item as RawTrack),
      );
    },

    async artistFavorites(id, limit = 30) {
      const raw = await get<RawFavorite[]>(`/users/${encodeURIComponent(external(id))}/favorites`, {
        limit,
      });
      const trackIds = raw
        .filter(
          (f) => (f.favorite_type ?? '').toLowerCase().includes('track') && f.favorite_item_id,
        )
        .map((f) => makeId('audius', f.favorite_item_id as string));
      return provider.tracksByIds(trackIds);
    },

    async artistPlaylists(id, limit = 20) {
      return toPlaylists(
        await get<RawPlaylist[]>(`/users/${encodeURIComponent(external(id))}/playlists`, { limit }),
      );
    },

    async searchArtists(query, limit = 12) {
      if (!query.trim()) return [];
      return toArtists(await get<RawUser[]>('/users/search', { query: query.trim(), limit }));
    },

    async trendingPlaylists(limit = 12) {
      return toPlaylists(await get<RawPlaylist[]>('/playlists/trending', { limit }));
    },

    async searchPlaylists(query, limit = 12) {
      if (!query.trim()) return [];
      return toPlaylists(
        await get<RawPlaylist[]>('/playlists/search', { query: query.trim(), limit }),
      );
    },

    async playlist(id) {
      const externalId = external(id);
      const raw = await get<RawPlaylist[] | RawPlaylist>(
        `/playlists/${encodeURIComponent(externalId)}`,
      );
      const first = Array.isArray(raw) ? raw[0] : raw;
      if (!first) return null;
      const tracks = first.tracks
        ? toTracks(first.tracks)
        : toTracks(await get<RawTrack[]>(`/playlists/${encodeURIComponent(externalId)}/tracks`));
      const [playlist] = toPlaylists([first]);
      if (!playlist) return null;
      return { playlist: { ...playlist, trackIds: tracks.map((track) => track.id) }, tracks };
    },

    cachedArtist(id) {
      const parts = splitId(id);
      if (!parts || parts.provider !== 'audius') return null;
      const user = users.get(parts.externalId);
      return user ? mapArtist(user, [...(genresByUser.get(user.id) ?? [])]) : null;
    },

    streamUrl(track) {
      if (track.source.kind !== 'stream' || track.source.provider !== 'audius') return null;
      return `${host}/v1/tracks/${encodeURIComponent(track.source.externalId)}/stream?app_name=${APP_NAME}`;
    },
  };

  return provider;
}

/* ------------------------------------------------------------------------------------------- */

export function mapTrack(raw: RawTrack): Track {
  const genreId = genreIdForAudiusName(raw.genre);
  const genreIds = genreId ? [genreId] : [];
  const tags = splitTags(raw.tags);
  const bpm = typeof raw.bpm === 'number' && Number.isFinite(raw.bpm) ? raw.bpm : null;
  const musicalKey = raw.musical_key ?? null;
  const mood = raw.mood ?? null;
  return {
    id: makeId('audius', raw.id),
    title: raw.title,
    artistId: makeId('audius', raw.user.id),
    artistName: raw.user.name,
    genreIds,
    mood,
    tags,
    durationMs: Math.max(0, Math.round((raw.duration ?? 0) * 1000)),
    year: yearOf(raw.release_date),
    artworkUrl: pickArtwork(raw.artwork),
    popularity: popularityFromEngagement(
      raw.play_count,
      raw.favorite_count ?? 0,
      raw.repost_count ?? 0,
    ),
    playCount: typeof raw.play_count === 'number' ? raw.play_count : null,
    bpm,
    musicalKey,
    vibe: priorVibeForTrack({ genreIds, mood, tags, bpm, musicalKey }),
    vibeSource: 'prior',
    source: {
      kind: 'stream',
      provider: 'audius',
      externalId: raw.id,
      permalink: raw.permalink ?? null,
    },
  };
}

export function mapArtist(user: RawUser, genreIds: readonly Id[]): Artist {
  return {
    id: makeId('audius', user.id),
    name: user.name,
    handle: user.handle ?? null,
    genreIds: [...genreIds],
    bio: (user.bio ?? '').trim(),
    vibe: NEUTRAL_VIBE,
    followerCount: user.follower_count ?? 0,
    trackCount: user.track_count ?? 0,
    avatarUrl: pickArtwork(user.profile_picture),
    verified: Boolean(user.is_verified),
    provider: 'audius',
    externalId: user.id,
  };
}

function mapPlaylist(raw: RawPlaylist): Playlist {
  const created = raw.created_at ? Date.parse(raw.created_at) : Number.NaN;
  const updated = raw.updated_at ? Date.parse(raw.updated_at) : Number.NaN;
  const createdAt = Number.isFinite(created) ? created : 0;
  const trackIds = (raw.playlist_contents?.track_ids ?? [])
    .map((entry) => entry.track_id)
    .filter((id): id is string => typeof id === 'string')
    .map((id) => makeId('audius', id));
  return {
    id: makeId('audius', raw.id),
    ownerId: makeId('audius', raw.user.id),
    ownerName: raw.user.name,
    name: raw.playlist_name,
    description: (raw.description ?? '').trim(),
    trackIds: [...new Set(trackIds)],
    artworkUrl: pickArtwork(raw.artwork),
    isPublic: !raw.is_private,
    provider: 'audius',
    externalId: raw.id,
    createdAt,
    updatedAt: Number.isFinite(updated) ? updated : createdAt,
  };
}

function pickArtwork(artwork: RawArtwork | null | undefined): string | null {
  return artwork?.['480x480'] ?? artwork?.['1000x1000'] ?? artwork?.['150x150'] ?? null;
}

function splitTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return [
    ...new Set(
      tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function yearOf(date: string | null | undefined): number | null {
  if (!date) return null;
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) ? new Date(parsed).getUTCFullYear() : null;
}
