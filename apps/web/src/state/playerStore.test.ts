import { createCatalogIndex, DEMO_CATALOG, type ListenEvent, type Track } from '@weegood/core';
import { describe, expect, it } from 'vitest';
import type { EngineSnapshot } from '../audio/engine';
import { createPlayerStore, type PlaybackEngineLike } from './playerStore';

const index = createCatalogIndex(DEMO_CATALOG);
const NOW = 1_800_000_000_000;

class FakeEngine implements PlaybackEngineLike {
  loaded: Track[] = [];
  prefetched: Track[] = [];
  plays = 0;
  pauses = 0;
  seeks: number[] = [];
  volume = 1;
  failOn = new Set<string>();
  private current: Track | null = null;
  private listeners = new Set<(snapshot: EngineSnapshot) => void>();

  async load(track: Track): Promise<void> {
    if (this.failOn.has(track.id)) throw new Error(`cannot load ${track.id}`);
    this.loaded.push(track);
    this.current = track;
  }
  async play(): Promise<void> {
    this.plays++;
    this.emit({ status: 'playing', positionMs: 0 });
  }
  pause(): void {
    this.pauses++;
    this.emit({ status: 'paused' });
  }
  seek(positionMs: number): void {
    this.seeks.push(positionMs);
    this.emit({ positionMs });
  }
  setVolume(volume: number): void {
    this.volume = volume;
  }
  prefetch(track: Track): void {
    this.prefetched.push(track);
  }
  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /** Simulate the engine reaching a position, or the end. */
  emit(partial: Partial<EngineSnapshot>): void {
    const snapshot: EngineSnapshot = {
      status: 'playing',
      positionMs: 0,
      durationMs: this.current?.durationMs ?? 0,
      error: null,
      ...partial,
    };
    for (const listener of this.listeners) listener(snapshot);
  }
}

function setup() {
  const engine = new FakeEngine();
  const listens: Array<{ track: Track; event: ListenEvent }> = [];
  const starts: Array<{ track: Track; next: Track | null }> = [];
  const store = createPlayerStore({
    engine,
    resolveTrack: (id) => index.tracksById.get(id),
    loadBlob: async () => null,
    onListen: (track, event) => listens.push({ track, event }),
    onTrackStart: (track, next) => starts.push({ track, next }),
    now: () => NOW,
    random: () => 0.5,
    errorSkipDelayMs: 0,
  });
  return { engine, store, listens, starts };
}

const IDS = ['lux-marlowe-1', 'lux-marlowe-2', 'lux-marlowe-3'];
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('playerStore', () => {
  it('plays a queue from the chosen index and announces the start with the next track', async () => {
    const { store, engine, starts } = setup();
    await store.getState().playQueue(IDS, 1, 'Test');
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
    expect(store.getState().index).toBe(1);
    expect(store.getState().contextLabel).toBe('Test');
    expect(store.getState().status).toBe('playing');
    expect(engine.loaded.map((t) => t.id)).toEqual(['lux-marlowe-2']);
    expect(engine.plays).toBe(1);
    expect(starts[0]?.track.id).toBe('lux-marlowe-2');
    expect(starts[0]?.next?.id).toBe('lux-marlowe-3');
  });

  it('drops ids it cannot resolve', async () => {
    const { store } = setup();
    await store.getState().playQueue(['nope', 'lux-marlowe-1'], 0);
    expect(store.getState().queue).toEqual(['lux-marlowe-1']);
  });

  it('records a completed listen when a track ends and advances', async () => {
    const { store, engine, listens } = setup();
    await store.getState().playQueue(IDS, 0);
    engine.emit({ positionMs: 120_000 });
    engine.emit({ status: 'ended', positionMs: 200_000 });
    await tick();
    expect(listens).toHaveLength(1);
    expect(listens[0]?.event.completed).toBe(true);
    expect(listens[0]?.event.skipped).toBe(false);
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
  });

  it('records a skip with the furthest position reached', async () => {
    const { store, engine, listens } = setup();
    await store.getState().playQueue(IDS, 0);
    engine.emit({ positionMs: 42_000 });
    engine.emit({ positionMs: 10_000 });
    await store.getState().next();
    expect(listens).toHaveLength(1);
    expect(listens[0]?.event.skipped).toBe(true);
    expect(listens[0]?.event.msPlayed).toBe(42_000);
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
  });

  it('stops at the end of the queue unless repeat all is on', async () => {
    const { store, engine } = setup();
    await store.getState().playQueue(IDS, 2);
    engine.emit({ status: 'ended', positionMs: 1 });
    await tick();
    expect(store.getState().status).toBe('ended');
    expect(store.getState().currentTrackId).toBe('lux-marlowe-3');

    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe('all');
    engine.emit({ status: 'ended', positionMs: 1 });
    await tick();
    expect(store.getState().currentTrackId).toBe('lux-marlowe-1');
  });

  it('repeat one replays the same track', async () => {
    const { store, engine } = setup();
    await store.getState().playQueue(IDS, 0);
    store.getState().cycleRepeat();
    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe('one');
    engine.emit({ status: 'ended', positionMs: 1 });
    await tick();
    expect(store.getState().currentTrackId).toBe('lux-marlowe-1');
    expect(engine.loaded).toHaveLength(2);
  });

  it('skips past a track that fails to load, but gives up after repeated failures', async () => {
    const { store, engine } = setup();
    engine.failOn.add('lux-marlowe-1');
    await store.getState().playQueue(IDS, 0);
    expect(store.getState().status).toBe('error');
    await tick();
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
    expect(store.getState().status).toBe('playing');

    const stuck = setup();
    for (const id of IDS) stuck.engine.failOn.add(id);
    await stuck.store.getState().playQueue(IDS, 0);
    await tick();
    await tick();
    expect(stuck.store.getState().status).toBe('error');
    expect(stuck.store.getState().currentTrackId).toBe('lux-marlowe-3');
  });

  it('previous restarts after three seconds, otherwise goes back', async () => {
    const { store, engine } = setup();
    await store.getState().playQueue(IDS, 1);
    engine.emit({ positionMs: 5000 });
    await store.getState().previous();
    expect(engine.seeks).toEqual([0]);
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
    engine.emit({ positionMs: 1000 });
    await store.getState().previous();
    expect(store.getState().currentTrackId).toBe('lux-marlowe-1');
  });

  it('shuffle keeps the current track first and un-shuffle restores order', async () => {
    const { store } = setup();
    await store.getState().playQueue(IDS, 1);
    store.getState().toggleShuffle();
    expect(store.getState().queue[0]).toBe('lux-marlowe-2');
    expect([...store.getState().queue].sort()).toEqual([...IDS].sort());
    expect(store.getState().index).toBe(0);
    store.getState().toggleShuffle();
    expect(store.getState().queue).toEqual(IDS);
    expect(store.getState().index).toBe(1);
  });

  it('enqueue starts playback when idle and appends otherwise', async () => {
    const { store } = setup();
    expect(store.getState().enqueue(['lux-marlowe-1'])).toBe(1);
    await tick();
    expect(store.getState().currentTrackId).toBe('lux-marlowe-1');
    store.getState().enqueue(['lux-marlowe-2']);
    store.getState().playNext('lux-marlowe-3');
    expect(store.getState().queue).toEqual(['lux-marlowe-1', 'lux-marlowe-3', 'lux-marlowe-2']);
    store.getState().removeFromQueue(1);
    expect(store.getState().queue).toEqual(['lux-marlowe-1', 'lux-marlowe-2']);
  });

  it('toggles play and pause and clamps seek and volume', async () => {
    const { store, engine } = setup();
    await store.getState().playQueue(IDS, 0);
    await store.getState().togglePlay();
    expect(engine.pauses).toBe(1);
    expect(store.getState().status).toBe('paused');
    await store.getState().togglePlay();
    expect(engine.plays).toBe(2);
    store.getState().seek(-5);
    expect(engine.seeks.at(-1)).toBe(0);
    store.getState().setVolume(1.7);
    expect(engine.volume).toBe(1);
  });

  it('stop clears everything and records the interrupted listen', async () => {
    const { store, engine, listens } = setup();
    await store.getState().playQueue(IDS, 0);
    engine.emit({ positionMs: 3000 });
    store.getState().stop();
    expect(listens).toHaveLength(1);
    expect(store.getState().queue).toEqual([]);
    expect(store.getState().currentTrackId).toBeNull();
    expect(store.getState().status).toBe('idle');
  });
});
