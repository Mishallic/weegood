import { describe, expect, it } from 'vitest';
import { createLocalTrack } from '../library/localTrack';
import { createPlaylist } from '../playlists/playlist';
import { createEmptyProfile } from '../recommendation/tasteProfile';
import { createInMemoryRepositories } from './inMemory';

const NOW = 1_800_000_000_000;

describe('createInMemoryRepositories', () => {
  it('round-trips every kind of record', async () => {
    const repos = createInMemoryRepositories<string>();

    expect(await repos.profile.get()).toBeNull();
    await repos.profile.save(createEmptyProfile(NOW));
    expect((await repos.profile.get())?.createdAt).toBe(NOW);

    const playlist = createPlaylist({ id: 'p1', ownerId: 'me', name: 'Mix' }, NOW);
    await repos.playlists.save(playlist);
    await repos.playlists.save({ ...playlist, name: 'Mix 2' });
    expect((await repos.playlists.list()).map((p) => p.name)).toEqual(['Mix 2']);
    await repos.playlists.remove('p1');
    expect(await repos.playlists.list()).toEqual([]);

    await repos.follows.save({ kind: 'artist', targetId: 'a', createdAt: NOW });
    await repos.follows.save({ kind: 'artist', targetId: 'a', createdAt: NOW + 1 });
    expect(await repos.follows.list()).toHaveLength(1);
    await repos.follows.remove('artist', 'a');
    expect(await repos.follows.list()).toHaveLength(0);

    const track = createLocalTrack({
      id: 't1',
      fileName: 'a.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 1,
      durationMs: 1000,
      importedAt: NOW,
    });
    await repos.localTracks.save(track);
    await repos.audioBlobs.put('t1', 'bytes');
    expect(await repos.localTracks.list()).toHaveLength(1);
    expect(await repos.audioBlobs.get('t1')).toBe('bytes');
    await repos.audioBlobs.remove('t1');
    expect(await repos.audioBlobs.get('t1')).toBeUndefined();

    const event = {
      trackId: 't1',
      startedAt: NOW,
      msPlayed: 1,
      durationMs: 1,
      completed: true,
      skipped: false,
    };
    await repos.listens.add(event);
    await repos.listens.add({ ...event, startedAt: NOW + 10 });
    const recent = await repos.listens.recent(1);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.startedAt).toBe(NOW + 10);

    await repos.clearAll();
    expect(await repos.profile.get()).toBeNull();
    expect(await repos.localTracks.list()).toEqual([]);
    expect(await repos.listens.recent(10)).toEqual([]);
  });
});
