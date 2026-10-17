import {
  followKey,
  type Follow,
  type FollowKind,
  type Id,
  type ListenEvent,
  type Playlist,
  type TasteProfile,
  type Track,
} from '../domain/types';
import type { Repositories } from './types';

/** In-memory repositories. Used by tests and as the reference behaviour for real adapters. */
export function createInMemoryRepositories<TBlob = unknown>(): Repositories<TBlob> {
  let profile: TasteProfile | null = null;
  const playlists = new Map<Id, Playlist>();
  const follows = new Map<string, Follow>();
  const localTracks = new Map<Id, Track>();
  const blobs = new Map<Id, TBlob>();
  let listens: ListenEvent[] = [];

  return {
    profile: {
      async get() {
        return profile;
      },
      async save(next) {
        profile = next;
      },
      async clear() {
        profile = null;
      },
    },
    playlists: {
      async list() {
        return [...playlists.values()];
      },
      async save(playlist) {
        playlists.set(playlist.id, playlist);
      },
      async remove(id) {
        playlists.delete(id);
      },
    },
    follows: {
      async list() {
        return [...follows.values()];
      },
      async save(follow) {
        follows.set(followKey(follow), follow);
      },
      async remove(kind: FollowKind, targetId: Id) {
        follows.delete(followKey({ kind, targetId }));
      },
    },
    localTracks: {
      async list() {
        return [...localTracks.values()];
      },
      async save(track) {
        localTracks.set(track.id, track);
      },
      async remove(id) {
        localTracks.delete(id);
      },
    },
    audioBlobs: {
      async put(trackId, blob) {
        blobs.set(trackId, blob);
      },
      async get(trackId) {
        return blobs.get(trackId);
      },
      async remove(trackId) {
        blobs.delete(trackId);
      },
    },
    listens: {
      async recent(limit) {
        return [...listens].sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
      },
      async add(event) {
        listens.push(event);
      },
      async clear() {
        listens = [];
      },
    },
    async clearAll() {
      profile = null;
      playlists.clear();
      follows.clear();
      localTracks.clear();
      blobs.clear();
      listens = [];
    },
  };
}
