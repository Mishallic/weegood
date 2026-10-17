import { describe, expect, it } from 'vitest';
import { DEMO_CATALOG } from '../catalog/seed';
import {
  addTracksToPlaylist,
  createPlaylist,
  describePlaylist,
  moveTrackInPlaylist,
  playlistDurationMs,
  removeTrackFromPlaylist,
  renamePlaylist,
  validatePlaylistName,
} from './playlist';

const NOW = 1_800_000_000_000;

describe('createPlaylist', () => {
  it("normalises the name, de-duplicates tracks and marks it as the user's own", () => {
    const playlist = createPlaylist(
      { id: 'p1', ownerId: 'me', name: '  Late   Night  ', trackIds: ['a', 'b', 'a'] },
      NOW,
    );
    expect(playlist.name).toBe('Late Night');
    expect(playlist.trackIds).toEqual(['a', 'b']);
    expect(playlist.isPublic).toBe(false);
    expect(playlist.provider).toBeNull();
    expect(playlist.externalId).toBeNull();
    expect(playlist.createdAt).toBe(NOW);
  });

  it('rejects an empty name', () => {
    expect(validatePlaylistName('   ')).not.toBeNull();
    expect(() => createPlaylist({ id: 'p', ownerId: 'me', name: ' ' }, NOW)).toThrow();
  });
});

describe('editing', () => {
  const base = createPlaylist(
    { id: 'p1', ownerId: 'me', name: 'Mix', trackIds: ['a', 'b', 'c'] },
    NOW,
  );

  it('adds only new tracks and bumps updatedAt', () => {
    const next = addTracksToPlaylist(base, ['c', 'd', 'd'], NOW + 5);
    expect(next.trackIds).toEqual(['a', 'b', 'c', 'd']);
    expect(next.updatedAt).toBe(NOW + 5);
    expect(addTracksToPlaylist(base, ['a'], NOW + 9)).toBe(base);
  });

  it('removes a track', () => {
    expect(removeTrackFromPlaylist(base, 'b', NOW).trackIds).toEqual(['a', 'c']);
    expect(removeTrackFromPlaylist(base, 'zzz', NOW)).toBe(base);
  });

  it('moves a track and ignores bad indices', () => {
    expect(moveTrackInPlaylist(base, 0, 2, NOW).trackIds).toEqual(['b', 'c', 'a']);
    expect(moveTrackInPlaylist(base, 2, 0, NOW).trackIds).toEqual(['c', 'a', 'b']);
    expect(moveTrackInPlaylist(base, 0, 7, NOW)).toBe(base);
    expect(moveTrackInPlaylist(base, 1, 1, NOW)).toBe(base);
  });

  it('renames and describes, skipping no-op changes', () => {
    expect(renamePlaylist(base, 'Mix', NOW + 1)).toBe(base);
    expect(renamePlaylist(base, ' Night Mix ', NOW + 1).name).toBe('Night Mix');
    expect(() => renamePlaylist(base, '', NOW)).toThrow();
    expect(describePlaylist(base, 'For driving', NOW).description).toBe('For driving');
  });

  it('sums durations of known tracks', () => {
    const [first, second] = DEMO_CATALOG.tracks;
    if (!first || !second) throw new Error('fixture too small');
    const playlist = createPlaylist(
      { id: 'p2', ownerId: 'me', name: 'Two', trackIds: [first.id, second.id, 'missing'] },
      NOW,
    );
    const total = playlistDurationMs(playlist, (id) =>
      DEMO_CATALOG.tracks.find((t) => t.id === id),
    );
    expect(total).toBe(first.durationMs + second.durationMs);
  });
});
