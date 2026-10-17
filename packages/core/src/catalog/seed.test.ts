import { describe, expect, it } from 'vitest';
import { isVibeVector } from '../domain/vibe';
import { createCatalogIndex } from './catalogIndex';
import { genreById } from './genres';
import { buildDemoCatalog, DEMO_CATALOG } from './seed';

const index = createCatalogIndex(DEMO_CATALOG);

describe('test fixture catalog', () => {
  it('has the expected shape', () => {
    expect(DEMO_CATALOG.artists.length).toBe(24);
    expect(DEMO_CATALOG.tracks.length).toBe(96);
    expect(DEMO_CATALOG.playlists.length).toBe(6);
  });

  it('is deterministic', () => {
    expect(buildDemoCatalog()).toEqual(DEMO_CATALOG);
  });

  it('uses unique ids everywhere', () => {
    const ids = [...DEMO_CATALOG.artists, ...DEMO_CATALOG.tracks, ...DEMO_CATALOG.playlists].map(
      (e) => e.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every reference valid', () => {
    for (const artist of DEMO_CATALOG.artists) {
      expect(artist.genreIds.length).toBeGreaterThan(0);
      for (const genreId of artist.genreIds) expect(genreById(genreId)).toBeDefined();
      expect(artist.provider).toBe('demo');
    }
    for (const track of DEMO_CATALOG.tracks) {
      expect(track.artistId && index.artistsById.has(track.artistId)).toBe(true);
      expect(track.artistName).toBe(index.artistsById.get(track.artistId ?? '')?.name);
      for (const genreId of track.genreIds) expect(genreById(genreId)).toBeDefined();
      expect(track.durationMs).toBeGreaterThan(60_000);
      expect(track.mood).not.toBeNull();
      expect(track.popularity).toBeGreaterThanOrEqual(0);
      expect(track.popularity).toBeLessThanOrEqual(1);
      expect(track.source).toMatchObject({ kind: 'stream', provider: 'demo' });
    }
    for (const playlist of DEMO_CATALOG.playlists) {
      expect(index.artistsById.has(playlist.ownerId)).toBe(true);
      expect(playlist.isPublic).toBe(true);
      expect(playlist.trackIds.length).toBeGreaterThanOrEqual(8);
      for (const trackId of playlist.trackIds) expect(index.tracksById.has(trackId)).toBe(true);
    }
  });

  it('has valid vibes on every entity', () => {
    for (const entity of [...DEMO_CATALOG.artists, ...DEMO_CATALOG.tracks]) {
      expect(isVibeVector(entity.vibe)).toBe(true);
    }
  });

  it('gives multi-genre artists tracks in both genres', () => {
    const komori = index.tracksByArtistId.get('komori-tapes') ?? [];
    expect(komori.some((track) => track.genreIds.includes('jazz'))).toBe(true);
    expect(komori.every((track) => track.genreIds.includes('lo-fi'))).toBe(true);
  });

  it('indexes lookups consistently', () => {
    expect(index.playlistsByOwnerId.get('komori-tapes')?.length).toBe(1);
    expect((index.tracksByGenreId.get('lo-fi') ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
