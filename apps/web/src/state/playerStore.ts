import type { Id, ListenEvent, Track } from '@weegood/core';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { EngineSnapshot, EngineStatus } from '../audio/engine';

export type RepeatMode = 'off' | 'all' | 'one';

/** The subset of the playback engine the store needs. Tests pass a fake. */
export interface PlaybackEngineLike {
  load(track: Track, blob: Blob | null): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(positionMs: number): void;
  setVolume(volume: number): void;
  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void;
  prefetch?(track: Track): void;
}

export interface PlayerDeps {
  engine: PlaybackEngineLike;
  resolveTrack: (id: Id) => Track | undefined;
  loadBlob: (track: Track) => Promise<Blob | null>;
  onListen: (track: Track, event: ListenEvent) => void;
  /** Fires once a track is loaded and about to play; `next` is what follows in the queue. */
  onTrackStart?: (track: Track, next: Track | null) => void;
  now: () => number;
  random?: () => number;
  /** How long to show an error before skipping to the next track. Default 1200 ms. */
  errorSkipDelayMs?: number;
}

export interface PlayerState {
  /** Ids in play order (shuffled when shuffle is on). */
  queue: Id[];
  /** Ids in the order they were queued, used to un-shuffle. */
  baseQueue: Id[];
  index: number;
  currentTrackId: Id | null;
  status: EngineStatus;
  positionMs: number;
  durationMs: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Where playback started, e.g. a playlist name. Shown in the player bar. */
  contextLabel: string | null;
  error: string | null;
  queueOpen: boolean;

  playQueue(trackIds: readonly Id[], startIndex?: number, label?: string | null): Promise<void>;
  playTrack(trackId: Id): Promise<void>;
  /** Append to the queue. Starts playing if nothing is. Returns how many were added. */
  enqueue(trackIds: readonly Id[]): number;
  playNext(trackId: Id): void;
  removeFromQueue(position: number): void;
  jumpTo(position: number): Promise<void>;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(positionMs: number): void;
  setVolume(volume: number): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  toggleQueue(): void;
  stop(): void;
}

export type PlayerStore = UseBoundStore<StoreApi<PlayerState>>;

interface Session {
  track: Track;
  startedAt: number;
  maxPositionMs: number;
}

const VOLUME_KEY = 'weegood:volume';
const PREVIOUS_RESTART_MS = 3000;
const MAX_CONSECUTIVE_ERRORS = 3;

export function createPlayerStore(deps: PlayerDeps): PlayerStore {
  const random = deps.random ?? Math.random;
  const errorSkipDelayMs = deps.errorSkipDelayMs ?? 1200;
  let session: Session | null = null;
  let loadSeq = 0;
  let consecutiveErrors = 0;
  let errorTimer: ReturnType<typeof setTimeout> | null = null;

  const store = create<PlayerState>()((set, get) => {
    const endSession = (completed: boolean): void => {
      if (!session) return;
      const { track, startedAt, maxPositionMs } = session;
      session = null;
      deps.onListen(track, {
        trackId: track.id,
        startedAt,
        msPlayed: completed ? track.durationMs : Math.round(maxPositionMs),
        durationMs: track.durationMs,
        completed,
        skipped: !completed,
      });
    };

    const clearErrorTimer = (): void => {
      if (errorTimer) {
        clearTimeout(errorTimer);
        errorTimer = null;
      }
    };

    const startTrack = async (position: number, autoplay = true): Promise<void> => {
      clearErrorTimer();
      const id = get().queue[position];
      const track = id ? deps.resolveTrack(id) : undefined;
      if (!track) {
        set({ status: 'idle', currentTrackId: null, index: -1 });
        return;
      }
      endSession(false);
      const seq = ++loadSeq;
      set({
        index: position,
        currentTrackId: track.id,
        status: 'loading',
        positionMs: 0,
        durationMs: track.durationMs,
        error: null,
      });
      try {
        const blob = track.source.kind === 'local' ? await deps.loadBlob(track) : null;
        if (seq !== loadSeq) return;
        if (track.source.kind === 'local' && !blob) {
          throw new Error('The audio for this track is missing. Import it again.');
        }
        await deps.engine.load(track, blob);
        if (seq !== loadSeq) return;
        session = { track, startedAt: deps.now(), maxPositionMs: 0 };
        const nextId = get().queue[position + 1];
        deps.onTrackStart?.(track, nextId ? (deps.resolveTrack(nextId) ?? null) : null);
        if (autoplay) await deps.engine.play();
      } catch (error) {
        if (seq === loadSeq) {
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Playback failed.',
          });
          scheduleErrorSkip();
        }
      }
    };

    const advance = async (fromEnded: boolean): Promise<void> => {
      const { queue, index, repeat } = get();
      if (queue.length === 0) return;
      if (fromEnded && repeat === 'one') {
        await startTrack(index);
        return;
      }
      const nextIndex = index + 1;
      if (nextIndex < queue.length) {
        await startTrack(nextIndex);
      } else if (repeat === 'all' || !fromEnded) {
        await startTrack(0, !fromEnded || repeat === 'all');
      }
    };

    /** A broken stream should not stall the session: move on, but not forever. */
    const scheduleErrorSkip = (): void => {
      consecutiveErrors++;
      if (consecutiveErrors > MAX_CONSECUTIVE_ERRORS) return;
      const { queue, index } = get();
      if (index + 1 >= queue.length) return;
      clearErrorTimer();
      errorTimer = setTimeout(() => {
        errorTimer = null;
        if (get().status === 'error') void advance(false);
      }, errorSkipDelayMs);
    };

    deps.engine.subscribe((snapshot) => {
      if (session && snapshot.positionMs > session.maxPositionMs)
        session.maxPositionMs = snapshot.positionMs;
      if (snapshot.status === 'ended') {
        endSession(true);
        set({ status: 'ended', positionMs: snapshot.positionMs });
        void advance(true);
        return;
      }
      if (snapshot.status === 'playing') consecutiveErrors = 0;
      if (snapshot.status === 'error' && get().status !== 'error') scheduleErrorSkip();
      set({
        status: snapshot.status,
        positionMs: snapshot.positionMs,
        durationMs: snapshot.durationMs || get().durationMs,
        error: snapshot.error,
      });
    });

    return {
      queue: [],
      baseQueue: [],
      index: -1,
      currentTrackId: null,
      status: 'idle',
      positionMs: 0,
      durationMs: 0,
      volume: readStoredVolume(),
      shuffle: false,
      repeat: 'off',
      contextLabel: null,
      error: null,
      queueOpen: false,

      async playQueue(trackIds, startIndex = 0, label = null) {
        const ids = trackIds.filter((id) => deps.resolveTrack(id) !== undefined);
        if (ids.length === 0) return;
        consecutiveErrors = 0;
        let queue = ids;
        let position = Math.min(Math.max(startIndex, 0), ids.length - 1);
        if (get().shuffle) {
          const chosen = ids[position] as Id;
          queue = [
            chosen,
            ...shuffleIds(
              ids.filter((_, i) => i !== position),
              random,
            ),
          ];
          position = 0;
        }
        set({ baseQueue: ids, queue, contextLabel: label });
        await startTrack(position);
      },

      async playTrack(trackId) {
        await get().playQueue([trackId], 0, null);
      },

      enqueue(trackIds) {
        const ids = trackIds.filter((id) => deps.resolveTrack(id) !== undefined);
        if (ids.length === 0) return 0;
        const wasEmpty = get().queue.length === 0;
        set({ queue: [...get().queue, ...ids], baseQueue: [...get().baseQueue, ...ids] });
        if (wasEmpty) void startTrack(0);
        return ids.length;
      },

      playNext(trackId) {
        if (!deps.resolveTrack(trackId)) return;
        const { queue, baseQueue, index, currentTrackId } = get();
        const at = index + 1;
        const nextQueue = [...queue.slice(0, at), trackId, ...queue.slice(at)];
        const baseAt = currentTrackId ? baseQueue.indexOf(currentTrackId) + 1 : baseQueue.length;
        const nextBase = [...baseQueue.slice(0, baseAt), trackId, ...baseQueue.slice(baseAt)];
        set({ queue: nextQueue, baseQueue: nextBase });
        if (queue.length === 0) void startTrack(0);
      },

      removeFromQueue(position) {
        const { queue, index } = get();
        if (position === index || position < 0 || position >= queue.length) return;
        const removedId = queue[position];
        const nextQueue = queue.filter((_, i) => i !== position);
        const baseIndex = get().baseQueue.indexOf(removedId ?? '');
        const nextBase =
          baseIndex >= 0 ? get().baseQueue.filter((_, i) => i !== baseIndex) : get().baseQueue;
        set({ queue: nextQueue, baseQueue: nextBase, index: position < index ? index - 1 : index });
      },

      async jumpTo(position) {
        consecutiveErrors = 0;
        await startTrack(position);
      },

      async togglePlay() {
        const state = get();
        if (state.status === 'playing') {
          deps.engine.pause();
        } else if (state.currentTrackId) {
          if (state.status === 'ended' || state.status === 'error') await startTrack(state.index);
          else await deps.engine.play();
        }
      },

      async next() {
        consecutiveErrors = 0;
        await advance(false);
      },

      async previous() {
        const { positionMs, index } = get();
        if (positionMs > PREVIOUS_RESTART_MS || index <= 0) {
          get().seek(0);
          return;
        }
        await startTrack(index - 1);
      },

      seek(positionMs) {
        const clamped = Math.max(0, Math.min(positionMs, get().durationMs || positionMs));
        deps.engine.seek(clamped);
        set({ positionMs: clamped });
      },

      setVolume(volume) {
        const clamped = Math.max(0, Math.min(1, volume));
        deps.engine.setVolume(clamped);
        set({ volume: clamped });
        try {
          localStorage.setItem(VOLUME_KEY, String(clamped));
        } catch {
          // ignore
        }
      },

      toggleShuffle() {
        const { shuffle, baseQueue, currentTrackId } = get();
        const nextShuffle = !shuffle;
        let queue: Id[];
        let index: number;
        if (nextShuffle) {
          const rest = baseQueue.filter((id) => id !== currentTrackId);
          queue = currentTrackId
            ? [currentTrackId, ...shuffleIds(rest, random)]
            : shuffleIds(rest, random);
          index = currentTrackId ? 0 : -1;
        } else {
          queue = [...baseQueue];
          index = currentTrackId ? queue.indexOf(currentTrackId) : -1;
        }
        set({ shuffle: nextShuffle, queue, index });
      },

      cycleRepeat() {
        const order: RepeatMode[] = ['off', 'all', 'one'];
        const current = order.indexOf(get().repeat);
        set({ repeat: order[(current + 1) % order.length] ?? 'off' });
      },

      toggleQueue() {
        set({ queueOpen: !get().queueOpen });
      },

      stop() {
        clearErrorTimer();
        endSession(false);
        loadSeq++;
        deps.engine.pause();
        set({
          queue: [],
          baseQueue: [],
          index: -1,
          currentTrackId: null,
          status: 'idle',
          positionMs: 0,
          durationMs: 0,
          contextLabel: null,
          error: null,
        });
      },
    };
  });

  deps.engine.setVolume(store.getState().volume);
  return store;
}

function shuffleIds(ids: readonly Id[], random: () => number): Id[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i] as Id;
    out[i] = out[j] as Id;
    out[j] = a;
  }
  return out;
}

function readStoredVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = Number(stored);
    if (stored && Number.isFinite(value) && value >= 0 && value <= 1) return value;
  } catch {
    // ignore
  }
  return 0.8;
}
