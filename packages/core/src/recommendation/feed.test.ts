import { describe, expect, it } from 'vitest';
import { createCatalogIndex } from '../catalog/catalogIndex';
import { DEMO_CATALOG } from '../catalog/seed';
import type { Follow } from '../domain/types';
import type { RecommendationInput } from './engine';
import { buildHomeFeed } from './feed';
import { createEmptyProfile } from './tasteProfile';

const index = createCatalogIndex(DEMO_CATALOG);
const NOW = 1_800_000_000_000;

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    profile: createEmptyProfile(NOW),
    tracks: DEMO_CATALOG.tracks,
    artistsById: index.artistsById,
    genresById: index.genresById,
    follows: [],
    recentListens: [],
    now: NOW,
    ...overrides,
  };
}

describe('buildHomeFeed', () => {
  it('shows only "for you" and "fresh" for a listener who follows nobody', () => {
    const sections = buildHomeFeed(input());
    expect(sections.map((s) => s.id)).toEqual(['for-you', 'fresh']);
    const ids = sections.flatMap((s) => s.items.map((r) => r.track.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('adds a follow section limited to followed artists and genres', () => {
    const follows: Follow[] = [{ kind: 'artist', targetId: 'the-saltmarsh', createdAt: NOW }];
    const sections = buildHomeFeed(input({ follows }));
    const section = sections.find((s) => s.id === 'because-you-follow');
    expect(section).toBeDefined();
    expect(section?.items.length).toBeGreaterThan(0);
    for (const item of section?.items ?? []) expect(item.track.artistId).toBe('the-saltmarsh');
  });

  it("adds a people section drawn from followed users' public playlists", () => {
    const user = index.usersById.get('u-nadia');
    const playlist = index.playlistsById.get('pl-nadia-study');
    if (!user || !playlist) throw new Error('missing demo data');
    const sections = buildHomeFeed(input({ peoplePlaylists: [{ user, playlist }] }));
    const section = sections.find((s) => s.id === 'from-people');
    expect(section).toBeDefined();
    expect(section?.subtitle).toContain('Nadia K.');
    for (const item of section?.items ?? []) expect(playlist.trackIds).toContain(item.track.id);
  });

  it('respects the per-section size', () => {
    const sections = buildHomeFeed(input(), { perSection: 4 });
    for (const section of sections) expect(section.items.length).toBeLessThanOrEqual(4);
  });
});
