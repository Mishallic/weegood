import type {
  Follow,
  FollowKind,
  Id,
  ListenEvent,
  Playlist,
  TasteProfile,
  Track,
} from '../domain/types';

/**
 * Storage contracts (ADR 0004). Apps implement these for their platform (IndexedDB on web,
 * SQLite on mobile, HTTP for sync later). Core ships an in-memory implementation for tests.
 * `TBlob` is the platform's binary type; core does not know about `Blob`.
 */

export interface ProfileRepository {
  get(): Promise<TasteProfile | null>;
  save(profile: TasteProfile): Promise<void>;
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

export interface LocalTrackRepository {
  list(): Promise<Track[]>;
  save(track: Track): Promise<void>;
  remove(id: Id): Promise<void>;
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
  audioBlobs: AudioBlobStore<TBlob>;
  listens: ListenRepository;
  /** Wipe everything. Used by "reset" in settings and by tests. */
  clearAll(): Promise<void>;
}
