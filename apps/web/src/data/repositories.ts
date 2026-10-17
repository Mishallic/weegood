import { followKey, type Repositories } from '@weegood/core';
import type { WeegoodDatabase } from './db';

const PROFILE_KEY = 'me';
/** Keep listening history bounded. The profile has already learned from older events. */
const LISTEN_CAP = 2000;
const LISTEN_TRIM = 200;

/**
 * IndexedDB implementation of the core repository contracts. Takes a database promise so the
 * app can start rendering before the database is open.
 */
export function createIndexedDbRepositories(
  dbPromise: Promise<WeegoodDatabase>,
): Repositories<Blob> {
  return {
    profile: {
      async get() {
        const db = await dbPromise;
        return (await db.get('profile', PROFILE_KEY)) ?? null;
      },
      async save(profile) {
        const db = await dbPromise;
        await db.put('profile', profile, PROFILE_KEY);
      },
      async clear() {
        const db = await dbPromise;
        await db.delete('profile', PROFILE_KEY);
      },
    },

    playlists: {
      async list() {
        const db = await dbPromise;
        return db.getAllFromIndex('playlists', 'byUpdatedAt');
      },
      async save(playlist) {
        const db = await dbPromise;
        await db.put('playlists', playlist);
      },
      async remove(id) {
        const db = await dbPromise;
        await db.delete('playlists', id);
      },
    },

    follows: {
      async list() {
        const db = await dbPromise;
        return db.getAll('follows');
      },
      async save(follow) {
        const db = await dbPromise;
        await db.put('follows', follow, followKey(follow));
      },
      async remove(kind, targetId) {
        const db = await dbPromise;
        await db.delete('follows', followKey({ kind, targetId }));
      },
    },

    localTracks: {
      async list() {
        const db = await dbPromise;
        return db.getAll('localTracks');
      },
      async save(track) {
        const db = await dbPromise;
        await db.put('localTracks', track);
      },
      async remove(id) {
        const db = await dbPromise;
        await db.delete('localTracks', id);
      },
    },

    audioBlobs: {
      async put(trackId, blob) {
        const db = await dbPromise;
        await db.put('audioBlobs', blob, trackId);
      },
      async get(trackId) {
        const db = await dbPromise;
        return db.get('audioBlobs', trackId);
      },
      async remove(trackId) {
        const db = await dbPromise;
        await db.delete('audioBlobs', trackId);
      },
    },

    listens: {
      async recent(limit) {
        const db = await dbPromise;
        const out = [];
        let cursor = await db
          .transaction('listens')
          .store.index('byStartedAt')
          .openCursor(null, 'prev');
        while (cursor && out.length < limit) {
          out.push(cursor.value);
          cursor = await cursor.continue();
        }
        return out;
      },
      async add(event) {
        const db = await dbPromise;
        const tx = db.transaction('listens', 'readwrite');
        await tx.store.add(event);
        const count = await tx.store.count();
        if (count > LISTEN_CAP) {
          let cursor = await tx.store.index('byStartedAt').openCursor();
          let removed = 0;
          while (cursor && removed < LISTEN_TRIM) {
            await cursor.delete();
            removed++;
            cursor = await cursor.continue();
          }
        }
        await tx.done;
      },
      async clear() {
        const db = await dbPromise;
        await db.clear('listens');
      },
    },

    async clearAll() {
      const db = await dbPromise;
      const tx = db.transaction(
        ['profile', 'playlists', 'follows', 'localTracks', 'audioBlobs', 'listens'],
        'readwrite',
      );
      await Promise.all([
        tx.objectStore('profile').clear(),
        tx.objectStore('playlists').clear(),
        tx.objectStore('follows').clear(),
        tx.objectStore('localTracks').clear(),
        tx.objectStore('audioBlobs').clear(),
        tx.objectStore('listens').clear(),
        tx.done,
      ]);
    },
  };
}
