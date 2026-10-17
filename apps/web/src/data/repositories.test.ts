import { createEmptyProfile, createLocalTrack, createPlaylist, DEMO_CATALOG } from '@weegood/core';
import { describe, expect, it } from 'vitest';
import { openWeegoodDB } from './db';
import { createIndexedDbRepositories } from './repositories';

const NOW = 1_800_000_000_000;
let dbCounter = 0;

function freshRepos() {
  dbCounter += 1;
  return createIndexedDbRepositories(openWeegoodDB(`weegood-test-${dbCounter}`));
}

describe('IndexedDB repositories', () => {
  it('round-trips the profile', async () => {
    const repos = freshRepos();
    expect(await repos.profile.get()).toBeNull();
    await repos.profile.save(createEmptyProfile(NOW));
    expect((await repos.profile.get()) as { createdAt: number }).toMatchObject({ createdAt: NOW });
    await repos.profile.clear();
    expect(await repos.profile.get()).toBeNull();
  });

  it('stores playlists ordered by last update', async () => {
    const repos = freshRepos();
    await repos.playlists.save(createPlaylist({ id: 'b', ownerId: 'me', name: 'B' }, NOW + 10));
    await repos.playlists.save(createPlaylist({ id: 'a', ownerId: 'me', name: 'A' }, NOW));
    expect((await repos.playlists.list()).map((p) => p.id)).toEqual(['a', 'b']);
    await repos.playlists.remove('a');
    expect((await repos.playlists.list()).map((p) => p.id)).toEqual(['b']);
  });

  it('keys follows by kind and target', async () => {
    const repos = freshRepos();
    await repos.follows.save({ kind: 'artist', targetId: 'x', createdAt: NOW });
    await repos.follows.save({ kind: 'genre', targetId: 'x', createdAt: NOW });
    await repos.follows.save({ kind: 'artist', targetId: 'x', createdAt: NOW + 1 });
    expect(await repos.follows.list()).toHaveLength(2);
    await repos.follows.remove('artist', 'x');
    expect((await repos.follows.list()).map((f) => f.kind)).toEqual(['genre']);
  });

  it('stores local tracks and their audio', async () => {
    const repos = freshRepos();
    const track = createLocalTrack({
      id: 'local_1',
      fileName: 'take.wav',
      mimeType: 'audio/wav',
      sizeBytes: 3,
      durationMs: 1000,
      importedAt: NOW,
    });
    await repos.localTracks.save(track);
    await repos.audioBlobs.put(track.id, new Blob(['abc'], { type: 'audio/wav' }));
    expect((await repos.localTracks.list()).map((t) => t.id)).toEqual(['local_1']);
    // fake-indexeddb structured-clones with Node, which does not know jsdom's Blob, so only
    // presence is asserted here. Real browsers store and return the Blob intact.
    expect(await repos.audioBlobs.get('local_1')).toBeDefined();
    await repos.audioBlobs.remove('local_1');
    expect(await repos.audioBlobs.get('local_1')).toBeUndefined();
  });

  it('caches streamed tracks, artists and measured vibes', async () => {
    const repos = freshRepos();
    const tracks = DEMO_CATALOG.tracks.slice(0, 4);
    await repos.tracks.saveMany(tracks);
    await repos.tracks.saveMany(tracks.slice(0, 1));
    expect(await repos.tracks.list()).toHaveLength(4);
    await repos.tracks.remove(tracks[0]?.id ?? '');
    expect(await repos.tracks.list()).toHaveLength(3);

    await repos.artists.saveMany(DEMO_CATALOG.artists.slice(0, 2));
    expect((await repos.artists.list()).map((a) => a.id).sort()).toEqual(
      DEMO_CATALOG.artists
        .slice(0, 2)
        .map((a) => a.id)
        .sort(),
    );

    const first = tracks[1];
    if (!first) throw new Error('fixture too small');
    await repos.measuredVibes.save({
      trackId: first.id,
      vibe: first.vibe,
      features: {
        rmsDb: -12,
        spectralCentroidHz: 1800,
        bassRatio: 0.25,
        spectralFlatness: 0.2,
        tempoBpm: 124,
        beatStrength: 0.6,
        majorness: 0.4,
        durationSeconds: 45,
      },
      measuredAt: NOW,
    });
    expect((await repos.measuredVibes.list())[0]?.features.tempoBpm).toBe(124);
  });

  it('returns recent listens newest first and clears everything', async () => {
    const repos = freshRepos();
    for (let i = 0; i < 5; i++) {
      await repos.listens.add({
        trackId: `t${i}`,
        startedAt: NOW + i,
        msPlayed: 1,
        durationMs: 1,
        completed: false,
        skipped: false,
      });
    }
    const recent = await repos.listens.recent(3);
    expect(recent.map((e) => e.trackId)).toEqual(['t4', 't3', 't2']);

    await repos.profile.save(createEmptyProfile(NOW));
    await repos.tracks.saveMany(DEMO_CATALOG.tracks.slice(0, 2));
    await repos.clearAll();
    expect(await repos.profile.get()).toBeNull();
    expect(await repos.tracks.list()).toEqual([]);
    expect(await repos.listens.recent(10)).toEqual([]);
  });
});
