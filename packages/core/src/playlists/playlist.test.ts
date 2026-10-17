import { describe, expect, it } from 'vitest';
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
  it('normalises the name and de-duplicates tracks', () => {
    const playlist = createPlaylist(
      { id: 'p1', ownerId: 'me', name: '  Late   Night  ', trackIds: ['a', 'b', 'a'] },
      NOW,
    );
    expect(playlist.name).toBe('Late Night');
    expect(playlist.trackIds).toEqual(['a', 'b']);
    expect(playlist.isPublic).toBe(false);
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
    const durations: Record<string, number> = { a: 1000, b: 2000 };
    const total = playlistDurationMs(base, (id) =>
      id in durations
        ? {
            id,
            title: id,
            artistId: null,
            artistName: '',
            genreIds: [],
            durationMs: durations[id] ?? 0,
            year: null,
            vibe: {
              energy: 0.5,
              valence: 0.5,
              danceability: 0.5,
              acousticness: 0.5,
              instrumentalness: 0.5,
              tempo: 0.5,
            },
            source: { kind: 'catalog' },
          }
        : undefined,
    );
    expect(total).toBe(3000);
  });
});
