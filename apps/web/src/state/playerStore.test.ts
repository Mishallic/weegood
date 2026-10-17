import { createCatalogIndex, DEMO_CATALOG, type ListenEvent, type Track } from '@weegood/core';
import { describe, expect, it } from 'vitest';
import type { EngineSnapshot } from '../audio/engine';
import { createPlayerStore, type PlayerControllerLike } from './playerStore';

const index = createCatalogIndex(DEMO_CATALOG);
const NOW = 1_800_000_000_000;

class FakeController implements PlayerControllerLike {
  loaded: Track[] = [];
  plays = 0;
  pauses = 0;
  seeks: number[] = [];
  volume = 1;
  private current: Track | null = null;
  private listeners = new Set<(snapshot: EngineSnapshot) => void>();

  async load(track: Track): Promise<void> {
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
  const controller = new FakeController();
  const listens: Array<{ track: Track; event: ListenEvent }> = [];
  const store = createPlayerStore({
    controller,
    resolveTrack: (id) => index.tracksById.get(id),
    loadBlob: async () => null,
    onListen: (track, event) => listens.push({ track, event }),
    now: () => NOW,
    random: () => 0.5,
  });
  return { controller, store, listens };
}

const IDS = ['lux-marlowe-1', 'lux-marlowe-2', 'lux-marlowe-3'];

describe('playerStore', () => {
  it('plays a queue from the chosen index', async () => {
    const { store, controller } = setup();
    await store.getState().playQueue(IDS, 1, 'Test');
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
    expect(store.getState().index).toBe(1);
    expect(store.getState().contextLabel).toBe('Test');
    expect(store.getState().status).toBe('playing');
    expect(controller.loaded.map((t) => t.id)).toEqual(['lux-marlowe-2']);
    expect(controller.plays).toBe(1);
  });

  it('drops ids it cannot resolve', async () => {
    const { store } = setup();
    await store.getState().playQueue(['nope', 'lux-marlowe-1'], 0);
    expect(store.getState().queue).toEqual(['lux-marlowe-1']);
  });

  it('records a completed listen when a track ends and advances', async () => {
    const { store, controller, listens } = setup();
    await store.getState().playQueue(IDS, 0);
    controller.emit({ positionMs: 120_000 });
    controller.emit({ status: 'ended', positionMs: 200_000 });
    await Promise.resolve();
    await Promise.resolve();
    expect(listens).toHaveLength(1);
    expect(listens[0]?.event.completed).toBe(true);
    expect(listens[0]?.event.skipped).toBe(false);
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
  });

  it('records a skip with the furthest position reached', async () => {
    const { store, controller, listens } = setup();
    await store.getState().playQueue(IDS, 0);
    controller.emit({ positionMs: 42_000 });
    controller.emit({ positionMs: 10_000 });
    await store.getState().next();
    expect(listens).toHaveLength(1);
    expect(listens[0]?.event.skipped).toBe(true);
    expect(listens[0]?.event.msPlayed).toBe(42_000);
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
  });

  it('stops at the end of the queue unless repeat all is on', async () => {
    const { store, controller } = setup();
    await store.getState().playQueue(IDS, 2);
    controller.emit({ status: 'ended', positionMs: 1 });
    await Promise.resolve();
    expect(store.getState().status).toBe('ended');
    expect(store.getState().currentTrackId).toBe('lux-marlowe-3');

    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe('all');
    controller.emit({ status: 'ended', positionMs: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().currentTrackId).toBe('lux-marlowe-1');
  });

  it('repeat one replays the same track', async () => {
    const { store, controller } = setup();
    await store.getState().playQueue(IDS, 0);
    store.getState().cycleRepeat();
    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe('one');
    controller.emit({ status: 'ended', positionMs: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().currentTrackId).toBe('lux-marlowe-1');
    expect(controller.loaded).toHaveLength(2);
  });

  it('previous restarts after three seconds, otherwise goes back', async () => {
    const { store, controller } = setup();
    await store.getState().playQueue(IDS, 1);
    controller.emit({ positionMs: 5000 });
    await store.getState().previous();
    expect(controller.seeks).toEqual([0]);
    expect(store.getState().currentTrackId).toBe('lux-marlowe-2');
    controller.emit({ positionMs: 1000 });
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
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().currentTrackId).toBe('lux-marlowe-1');
    store.getState().enqueue(['lux-marlowe-2']);
    store.getState().playNext('lux-marlowe-3');
    expect(store.getState().queue).toEqual(['lux-marlowe-1', 'lux-marlowe-3', 'lux-marlowe-2']);
    store.getState().removeFromQueue(1);
    expect(store.getState().queue).toEqual(['lux-marlowe-1', 'lux-marlowe-2']);
  });

  it('toggles play and pause and clamps seek and volume', async () => {
    const { store, controller } = setup();
    await store.getState().playQueue(IDS, 0);
    await store.getState().togglePlay();
    expect(controller.pauses).toBe(1);
    expect(store.getState().status).toBe('paused');
    await store.getState().togglePlay();
    expect(controller.plays).toBe(2);
    store.getState().seek(-5);
    expect(controller.seeks.at(-1)).toBe(0);
    store.getState().setVolume(1.7);
    expect(controller.volume).toBe(1);
  });

  it('stop clears everything and records the interrupted listen', async () => {
    const { store, controller, listens } = setup();
    await store.getState().playQueue(IDS, 0);
    controller.emit({ positionMs: 3000 });
    store.getState().stop();
    expect(listens).toHaveLength(1);
    expect(store.getState().queue).toEqual([]);
    expect(store.getState().currentTrackId).toBeNull();
    expect(store.getState().status).toBe('idle');
  });
});
