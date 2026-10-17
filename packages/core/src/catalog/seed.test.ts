import { describe, expect, it } from 'vitest';
import { isVibeVector } from '../domain/vibe';
import { createCatalogIndex } from './catalogIndex';
import { buildDemoCatalog, DEMO_CATALOG } from './seed';

const index = createCatalogIndex(DEMO_CATALOG);

describe('demo catalog', () => {
  it('has the expected shape', () => {
    expect(DEMO_CATALOG.genres.length).toBe(12);
    expect(DEMO_CATALOG.artists.length).toBe(24);
    expect(DEMO_CATALOG.tracks.length).toBe(96);
    expect(DEMO_CATALOG.users.length).toBe(6);
    expect(DEMO_CATALOG.playlists.length).toBeGreaterThanOrEqual(6);
  });

  it('is deterministic', () => {
    expect(buildDemoCatalog()).toEqual(DEMO_CATALOG);
  });

  it('uses unique ids and handles everywhere', () => {
    const ids = [
      ...DEMO_CATALOG.genres,
      ...DEMO_CATALOG.artists,
      ...DEMO_CATALOG.tracks,
      ...DEMO_CATALOG.users,
      ...DEMO_CATALOG.playlists,
    ].map((entity) => entity.id);
    expect(new Set(ids).size).toBe(ids.length);
    const handles = DEMO_CATALOG.users.map((user) => user.handle);
    expect(new Set(handles).size).toBe(handles.length);
  });

  it('keeps every reference valid', () => {
    for (const artist of DEMO_CATALOG.artists) {
      expect(artist.genreIds.length).toBeGreaterThan(0);
      for (const genreId of artist.genreIds) expect(index.genresById.has(genreId)).toBe(true);
    }
    for (const track of DEMO_CATALOG.tracks) {
      expect(track.artistId && index.artistsById.has(track.artistId)).toBe(true);
      expect(track.artistName).toBe(index.artistsById.get(track.artistId ?? '')?.name);
      for (const genreId of track.genreIds) expect(index.genresById.has(genreId)).toBe(true);
      expect(track.durationMs).toBeGreaterThan(60_000);
      expect(track.source.kind).toBe('catalog');
    }
    for (const playlist of DEMO_CATALOG.playlists) {
      expect(index.usersById.has(playlist.ownerId)).toBe(true);
      expect(playlist.isPublic).toBe(true);
      expect(playlist.trackIds.length).toBeGreaterThanOrEqual(8);
      for (const trackId of playlist.trackIds) expect(index.tracksById.has(trackId)).toBe(true);
    }
  });

  it('has valid vibes on every entity', () => {
    const entities = [
      ...DEMO_CATALOG.genres,
      ...DEMO_CATALOG.artists,
      ...DEMO_CATALOG.tracks,
      ...DEMO_CATALOG.users,
    ];
    for (const entity of entities) expect(isVibeVector(entity.vibe)).toBe(true);
  });

  it('gives multi-genre artists tracks in both genres', () => {
    const komori = index.tracksByArtistId.get('komori-tapes') ?? [];
    expect(komori.some((track) => track.genreIds.includes('jazz'))).toBe(true);
    expect(komori.every((track) => track.genreIds.includes('lofi'))).toBe(true);
  });

  it('indexes lookups consistently', () => {
    expect(index.usersByHandle.get('nadia.k')?.id).toBe('u-nadia');
    expect(index.playlistsByOwnerId.get('u-nadia')?.length).toBe(2);
    const lofi = index.tracksByGenreId.get('lofi') ?? [];
    expect(lofi.length).toBeGreaterThanOrEqual(8);
  });
});
