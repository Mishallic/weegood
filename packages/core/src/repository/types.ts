import type {
  Artist,
  Follow,
  FollowKind,
  Id,
  ListenEvent,
  MeasuredVibe,
  Playlist,
  Track,
} from '../domain/types';
import type { TasteProfileV2 } from '../recommendation/tasteProfile';

/**
 * Storage contracts (ADR 0004). Apps implement these for their platform (IndexedDB on web,
 * SQLite on mobile, HTTP for sync later). Core ships an in-memory implementation for tests.
 * `TBlob` is the platform's binary type; core does not know about `Blob`.
 */

export interface ProfileRepository {
  /** Raw persisted value; callers run it through `normalizeProfile`. */
  get(): Promise<unknown | null>;
  save(profile: TasteProfileV2): Promise<void>;
  clear(): Promise<void>;
}

export interface PlaylistRepository {
  list(): Promise<Playlist[]>;
  save(playlist: Playlist): Promise<void>;
  remove(id: Id): Promise<void>;
}

export interface FollowRepository {
  list(): Promise<Follow[]>;
  save(follow: Follow): Promise<void>;
  remove(kind: FollowKind, targetId: Id): Promise<void>;
}

/** Tracks imported from the device. */
export interface LocalTrackRepository {
  list(): Promise<Track[]>;
  save(track: Track): Promise<void>;
  remove(id: Id): Promise<void>;
}

/** Streamed tracks the app has seen, kept so playlists and history resolve offline and across sessions. */
export interface TrackCacheRepository {
  list(): Promise<Track[]>;
  saveMany(tracks: readonly Track[]): Promise<void>;
  remove(id: Id): Promise<void>;
  clear(): Promise<void>;
}

/** Artists the listener follows or has looked at. */
export interface ArtistCacheRepository {
  list(): Promise<Artist[]>;
  saveMany(artists: readonly Artist[]): Promise<void>;
  clear(): Promise<void>;
}

/** Audio features measured on-device (ADR 0011). */
export interface MeasuredVibeRepository {
  list(): Promise<MeasuredVibe[]>;
  save(measured: MeasuredVibe): Promise<void>;
  clear(): Promise<void>;
}

export interface AudioBlobStore<TBlob> {
  put(trackId: Id, blob: TBlob): Promise<void>;
  get(trackId: Id): Promise<TBlob | undefined>;
  remove(trackId: Id): Promise<void>;
}

export interface ListenRepository {
  /** Most recent first. */
  recent(limit: number): Promise<ListenEvent[]>;
  add(event: ListenEvent): Promise<void>;
  clear(): Promise<void>;
}

export interface Repositories<TBlob> {
  profile: ProfileRepository;
  playlists: PlaylistRepository;
  follows: FollowRepository;
  localTracks: LocalTrackRepository;
  tracks: TrackCacheRepository;
  artists: ArtistCacheRepository;
  measuredVibes: MeasuredVibeRepository;
  audioBlobs: AudioBlobStore<TBlob>;
  listens: ListenRepository;
  /** Wipe everything. Used by "reset" in settings and by tests. */
  clearAll(): Promise<void>;
}
