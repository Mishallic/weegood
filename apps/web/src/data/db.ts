import type { Follow, ListenEvent, Playlist, TasteProfile, Track } from '@weegood/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * IndexedDB schema (ADR 0004). Bump `DB_VERSION` and add a migration step in `upgrade` when the
 * shape changes; never edit a shipped version's stores in place.
 */
export interface WeegoodDB extends DBSchema {
  profile: { key: string; value: TasteProfile };
  playlists: { key: string; value: Playlist; indexes: { byUpdatedAt: number } };
  follows: { key: string; value: Follow };
  localTracks: { key: string; value: Track };
  audioBlobs: { key: string; value: Blob };
  listens: { key: number; value: ListenEvent; indexes: { byStartedAt: number } };
}

export const DB_NAME = 'weegood';
export const DB_VERSION = 1;

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
    },
  });
}
