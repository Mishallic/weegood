import { createCatalogIndex, createEmptyProfile, DEMO_CATALOG, emptyFeatures } from '@weegood/core';
import { describe, expect, it } from 'vitest';
import { createTestServices } from '../app/services';
import { createAppStore } from './appStore';

const index = createCatalogIndex(DEMO_CATALOG);
const NOW = 1_800_000_000_000;

function track(id: string) {
  const found = index.tracksById.get(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function artist(id: string) {
  const found = index.artistsById.get(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function setup() {
  const services = createTestServices({ now: () => NOW });
  const store = createAppStore(services);
  return { services, store };
}

const ONBOARDING = {
  genreIds: ['lo-fi'],
  moodIds: ['chill'],
  artistIds: [] as string[],
  context: 'focus' as const,
};

describe('appStore', () => {
  it('hydrates to an empty state for a new visitor', async () => {
    const { store } = setup();
    expect(store.getState().hydrated).toBe(false);
    await store.getState().hydrate();
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().profile).toBeNull();
    expect(store.getState().playlists).toEqual([]);
  });

  it('upgrades a version 1 profile on hydrate', async () => {
    const { store, services } = setup();
    const v1 = { ...createEmptyProfile(NOW), version: 1 } as unknown as Record<string, unknown>;
    delete v1['moodWeights'];
    delete v1['ranker'];
    await services.repos.profile.save(v1 as never);
    await store.getState().hydrate();
    expect(store.getState().profile?.version).toBe(2);
    expect(store.getState().profile?.ranker.updates).toBe(0);
  });

  it('persists the onboarding profile with chosen artists and keeps likes when re-run', async () => {
    const { store, services } = setup();
    await store.getState().hydrate();
    const chosen = artist('paper-lanterns');
    await store.getState().completeOnboarding({ ...ONBOARDING, artistIds: [chosen.id] }, [chosen]);
    const stored = (await services.repos.profile.get()) as {
      genreWeights: Record<string, number>;
      artistAffinity: Record<string, number>;
    };
    expect(stored.genreWeights['lo-fi']).toBe(1);
    expect(stored.artistAffinity[chosen.id]).toBe(1);
    expect(store.getState().artists[chosen.id]).toBeDefined();

    await store.getState().toggleLike(track('paper-lanterns-1'));
    await store
      .getState()
      .completeOnboarding(
        { genreIds: ['metal'], moodIds: ['dark'], artistIds: [], context: 'workout' },
        [],
      );
    const profile = store.getState().profile;
    expect(profile?.genreWeights['metal']).toBe(1);
    expect(profile?.likedTrackIds).toEqual(['paper-lanterns-1']);
  });

  it('caches streamed tracks and fetches missing ones from the provider', async () => {
    const { store, services } = setup();
    await store.getState().hydrate();
    expect(store.getState().getTrack('lux-marlowe-1')).toBeUndefined();
    const resolved = await store
      .getState()
      .ensureTracks(['lux-marlowe-1', 'nope', 'lux-marlowe-2']);
    expect(resolved.map((t) => t.id)).toEqual(['lux-marlowe-1', 'lux-marlowe-2']);
    expect((await services.repos.tracks.list()).map((t) => t.id).sort()).toEqual([
      'lux-marlowe-1',
      'lux-marlowe-2',
    ]);

    store.getState().rememberTracks([track('ironwake-1')]);
    expect(store.getState().getTrack('ironwake-1')).toBeDefined();
    expect((await services.repos.tracks.list()).length).toBe(2);
  });

  it('applies measured vibes to cached tracks and persists them', async () => {
    const { store, services } = setup();
    await store.getState().hydrate();
    const target = track('delphine-rey-1');
    store.getState().rememberTracks([target], true);
    const measured = {
      trackId: target.id,
      vibe: { ...target.vibe, energy: 0.99 },
      features: {
        rmsDb: -8,
        spectralCentroidHz: 2500,
        bassRatio: 0.3,
        spectralFlatness: 0.3,
        tempoBpm: 126,
        beatStrength: 0.8,
        majorness: 0.7,
        durationSeconds: 45,
      },
      measuredAt: NOW,
    };
    await store.getState().recordMeasuredVibe(measured);
    expect(store.getState().getTrack(target.id)?.vibe.energy).toBe(0.99);
    expect(store.getState().getTrack(target.id)?.vibeSource).toBe('measured');
    expect(await services.repos.measuredVibes.list()).toHaveLength(1);

    const fresh = createAppStore(services);
    await fresh.getState().hydrate();
    expect(fresh.getState().getTrack(target.id)?.vibeSource).toBe('measured');
  });

  it('manages playlists and persists every change', async () => {
    const { store, services } = setup();
    await store.getState().hydrate();
    const playlist = await store.getState().createPlaylist('  Night   Drive ');
    expect(playlist?.name).toBe('Night Drive');
    if (!playlist) throw new Error('playlist not created');

    expect(await store.getState().addToPlaylist(playlist.id, ['a', 'b', 'a'])).toBe(2);
    expect(await store.getState().addToPlaylist(playlist.id, ['b'])).toBe(0);
    await store.getState().moveInPlaylist(playlist.id, 0, 1);
    await store.getState().renamePlaylist(playlist.id, 'Night Drive II');

    const stored = (await services.repos.playlists.list()).find((p) => p.id === playlist.id);
    expect(stored?.trackIds).toEqual(['b', 'a']);
    expect(stored?.name).toBe('Night Drive II');

    await store.getState().removeFromPlaylist(playlist.id, 'b');
    expect(store.getState().playlists[0]?.trackIds).toEqual(['a']);

    await store.getState().deletePlaylist(playlist.id);
    expect(await services.repos.playlists.list()).toEqual([]);
  });

  it('rejects an empty playlist name with a toast instead of throwing', async () => {
    const { store } = setup();
    await store.getState().hydrate();
    expect(await store.getState().createPlaylist('   ')).toBeNull();
    expect(store.getState().toasts[0]?.kind).toBe('error');
  });

  it('toggles follows, caches the artist and nudges the profile', async () => {
    const { store, services } = setup();
    await store.getState().hydrate();
    await store
      .getState()
      .completeOnboarding(
        { genreIds: ['pop'], moodIds: ['feel-good'], artistIds: [], context: 'everything' },
        [],
      );
    const ironwake = artist('ironwake');
    expect(await store.getState().toggleFollow('artist', ironwake.id, ironwake)).toBe(true);
    expect(await services.repos.follows.list()).toHaveLength(1);
    expect((await services.repos.artists.list()).map((a) => a.id)).toEqual([ironwake.id]);
    expect(store.getState().profile?.artistAffinity[ironwake.id]).toBeGreaterThan(0);
    expect(await store.getState().toggleFollow('artist', ironwake.id)).toBe(false);
    expect(await services.repos.follows.list()).toHaveLength(0);
  });

  it('records listens into history, the profile and the ranker', async () => {
    const { store, services } = setup();
    await store.getState().hydrate();
    await store
      .getState()
      .completeOnboarding(
        { genreIds: ['jazz'], moodIds: ['chill'], artistIds: [], context: 'relax' },
        [],
      );
    const played = track('kessler-grid-2');
    await store.getState().recordListen(
      played,
      {
        trackId: played.id,
        startedAt: NOW,
        msPlayed: played.durationMs,
        durationMs: played.durationMs,
        completed: true,
        skipped: false,
      },
      { ...emptyFeatures(), popularity: 1 },
    );
    expect(store.getState().recentListens[0]?.trackId).toBe(played.id);
    expect(store.getState().profile?.listenCount).toBe(1);
    expect(store.getState().profile?.genreWeights['techno']).toBeGreaterThan(0);
    expect(store.getState().profile?.ranker.updates).toBe(1);
    expect(await services.repos.listens.recent(5)).toHaveLength(1);
    expect(store.getState().getTrack(played.id)).toBeDefined();
  });

  it('imports supported files with their audio and rejects the rest', async () => {
    const { store, services } = setup();
    await store.getState().hydrate();
    const good = new File(['abc'], 'Paper Lanterns - Demo Take.mp3', { type: 'audio/mpeg' });
    const bad = new File(['abc'], 'notes.txt', { type: 'text/plain' });
    const result = await store.getState().importLocalFiles([good, bad]);

    expect(result.imported).toHaveLength(1);
    expect(result.rejected).toEqual([
      { name: 'notes.txt', reason: 'Not a supported audio format.' },
    ]);
    const imported = result.imported[0];
    expect(imported?.title).toBe('Demo Take');
    expect(imported?.artistName).toBe('Paper Lanterns');
    expect(imported?.durationMs).toBe(180_000);
    expect(store.getState().localTracks).toHaveLength(1);
    expect(await services.repos.audioBlobs.get(imported?.id ?? '')).toBeDefined();
  });

  it('removing a local track also pulls it out of playlists', async () => {
    const { store, services } = setup();
    await store.getState().hydrate();
    const [imported] = (
      await store.getState().importLocalFiles([new File(['x'], 'take.wav', { type: 'audio/wav' })])
    ).imported;
    if (!imported) throw new Error('import failed');
    const playlist = await store.getState().createPlaylist('Mix', [imported.id, 'lux-marlowe-1']);
    if (!playlist) throw new Error('playlist failed');

    await store.getState().removeLocalTrack(imported.id);
    expect(store.getState().localTracks).toEqual([]);
    expect(store.getState().playlists[0]?.trackIds).toEqual(['lux-marlowe-1']);
    expect((await services.repos.playlists.list())[0]?.trackIds).toEqual(['lux-marlowe-1']);
    expect(await services.repos.audioBlobs.get(imported.id)).toBeUndefined();
  });

  it('round-trips an export through import on a fresh store, including referenced tracks', async () => {
    const source = setup();
    await source.store.getState().hydrate();
    await source.store
      .getState()
      .completeOnboarding(
        { genreIds: ['house'], moodIds: ['hype'], artistIds: [], context: 'party' },
        [],
      );
    source.store.getState().rememberTracks([track('delphine-rey-1')]);
    await source.store.getState().createPlaylist('Export me', ['delphine-rey-1']);
    await source.store.getState().toggleFollow('genre', 'house');
    const bundle = await source.store.getState().exportData();
    expect(bundle.tracks.map((t) => t.id)).toEqual(['delphine-rey-1']);

    const target = setup();
    await target.store.getState().hydrate();
    await target.store.getState().importData(JSON.parse(JSON.stringify(bundle)));
    expect(target.store.getState().playlists.map((p) => p.name)).toEqual(['Export me']);
    expect(target.store.getState().follows).toHaveLength(1);
    expect(target.store.getState().profile?.genreWeights['house']).toBe(1);
    expect(target.store.getState().getTrack('delphine-rey-1')).toBeDefined();
  });

  it('refuses to import something that is not a Weegood export', async () => {
    const { store } = setup();
    await store.getState().hydrate();
    await expect(store.getState().importData({ hello: 'world' })).rejects.toThrow(
      /not a Weegood export/,
    );
  });
});
