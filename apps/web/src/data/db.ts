import type { Artist, Follow, ListenEvent, MeasuredVibe, Playlist, Track } from '@weegood/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * IndexedDB schema (ADR 0004). Bump `DB_VERSION` and add a step in `upgrade` when the shape
 * changes; never edit a shipped version's stores in place.
 *
 * v1: profile, playlists, follows, localTracks, audioBlobs, listens.
 * v2: tracks (streamed track cache), artists (cache), measuredVibes (on-device analysis).
 */
export interface WeegoodDB extends DBSchema {
  profile: { key: string; value: unknown };
  playlists: { key: string; value: Playlist; indexes: { byUpdatedAt: number } };
  follows: { key: string; value: Follow };
  localTracks: { key: string; value: Track };
  tracks: { key: string; value: Track };
  artists: { key: string; value: Artist };
  measuredVibes: { key: string; value: MeasuredVibe };
  audioBlobs: { key: string; value: Blob };
  listens: { key: number; value: ListenEvent; indexes: { byStartedAt: number } };
}

export const DB_NAME = 'weegood';
export const DB_VERSION = 2;

export type WeegoodDatabase = IDBPDatabase<WeegoodDB>;

export function openWeegoodDB(name: string = DB_NAME): Promise<WeegoodDatabase> {
  return openDB<WeegoodDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('profile');
        const playlists = db.createObjectStore('playlists', { keyPath: 'id' });
        playlists.createIndex('byUpdatedAt', 'updatedAt');
        db.createObjectStore('follows');
        db.createObjectStore('localTracks', { keyPath: 'id' });
        db.createObjectStore('audioBlobs');
        const listens = db.createObjectStore('listens', { autoIncrement: true });
        listens.createIndex('byStartedAt', 'startedAt');
      }
      if (oldVersion < 2) {
        db.createObjectStore('tracks', { keyPath: 'id' });
        db.createObjectStore('artists', { keyPath: 'id' });
        db.createObjectStore('measuredVibes', { keyPath: 'trackId' });
      }
    },
  });
}
