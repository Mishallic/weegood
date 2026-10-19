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
  /** Fetch tracks the saved queue references but the cache no longer holds. */
  ensureTracks?: (ids: readonly Id[]) => Promise<unknown>;
  now: () => number;
  random?: () => number;
  /** How long to show an error before skipping to the next track. Default 1200 ms. */
  errorSkipDelayMs?: number;
  /** localStorage key for the saved queue. Null disables persistence. Default `weegood:player`. */
  persistKey?: string | null;
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
  /** Reorder the queue. The current track keeps playing wherever it lands. */
  moveInQueue(from: number, to: number): void;
  /** Drop everything except the track that is playing. Stops when nothing is. */
  clearUpcoming(): void;
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
  /** Bring back the queue saved by a previous session, paused where it left off. */
  restore(): Promise<void>;
}

export type PlayerStore = UseBoundStore<StoreApi<PlayerState>>;

interface Session {
  track: Track;
  startedAt: number;
  maxPositionMs: number;
}

interface PersistedPlayer {
  queue: Id[];
  baseQueue: Id[];
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  contextLabel: string | null;
  positionMs: number;
}

const VOLUME_KEY = 'weegood:volume';
const DEFAULT_PERSIST_KEY = 'weegood:player';
const PREVIOUS_RESTART_MS = 3000;
const MAX_CONSECUTIVE_ERRORS = 3;
const POSITION_SAVE_INTERVAL_MS = 5000;

export function createPlayerStore(deps: PlayerDeps): PlayerStore {
  const random = deps.random ?? Math.random;
  const errorSkipDelayMs = deps.errorSkipDelayMs ?? 1200;
  const persistKey = deps.persistKey === undefined ? DEFAULT_PERSIST_KEY : deps.persistKey;
  let session: Session | null = null;
  let loadSeq = 0;
  let consecutiveErrors = 0;
  let errorTimer: ReturnType<typeof setTimeout> | null = null;
  /** True once the current track is loaded; the listen session begins at the first playing snapshot. */
  let armed = false;

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
      armed = false;
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
        armed = true;
        if (autoplay) await deps.engine.play();
        else set({ status: 'paused' });
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

    /**
     * A listen begins when sound actually starts, not when the track loads. A queue restored at
     * startup sits loaded and paused without counting as a listen, and nothing is prefetched or
     * analysed on behalf of a listener who has not pressed play.
     */
    const beginSession = (): void => {
      if (!armed || session) return;
      const { currentTrackId, queue, index } = get();
      const track = currentTrackId ? deps.resolveTrack(currentTrackId) : undefined;
      if (!track) return;
      session = { track, startedAt: deps.now(), maxPositionMs: 0 };
      const nextId = queue[index + 1];
      deps.onTrackStart?.(track, nextId ? (deps.resolveTrack(nextId) ?? null) : null);
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
      if (snapshot.status === 'playing') {
        consecutiveErrors = 0;
        beginSession();
      }
      if (session && snapshot.positionMs > session.maxPositionMs)
        session.maxPositionMs = snapshot.positionMs;
      if (snapshot.status === 'ended') {
        endSession(true);
        set({ status: 'ended', positionMs: snapshot.positionMs });
        void advance(true);
        return;
      }
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

      moveInQueue(from, to) {
        const { queue, index, shuffle } = get();
        if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
        const next = [...queue];
        const [moved] = next.splice(from, 1);
        if (moved === undefined) return;
        next.splice(to, 0, moved);
        let nextIndex = index;
        if (index === from) nextIndex = to;
        else if (from < index && to >= index) nextIndex = index - 1;
        else if (from > index && to <= index) nextIndex = index + 1;
        set({ queue: next, index: nextIndex, baseQueue: shuffle ? get().baseQueue : [...next] });
      },

      clearUpcoming() {
        const { queue, index } = get();
        const current = queue[index];
        if (current === undefined) {
          get().stop();
          return;
        }
        set({ queue: [current], baseQueue: [current], index: 0 });
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
        armed = false;
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

      async restore() {
        const saved = readPersisted(persistKey);
        if (!saved || saved.queue.length === 0 || get().currentTrackId) return;
        if (deps.ensureTracks) {
          try {
            await deps.ensureTracks([...new Set([...saved.queue, ...saved.baseQueue])]);
          } catch {
            // Offline or the provider is down; restore whatever the cache still holds.
          }
        }
        const queue = saved.queue.filter((id) => deps.resolveTrack(id) !== undefined);
        if (queue.length === 0) return;
        const baseQueue = saved.baseQueue.filter((id) => deps.resolveTrack(id) !== undefined);
        const currentId = saved.queue[saved.index];
        const index = Math.max(0, currentId ? queue.indexOf(currentId) : 0);
        set({
          queue,
          baseQueue: baseQueue.length > 0 ? baseQueue : queue,
          shuffle: saved.shuffle,
          repeat: saved.repeat,
          contextLabel: saved.contextLabel,
        });
        await startTrack(index, false);
        if (saved.positionMs > 0 && get().currentTrackId === queue[index])
          get().seek(saved.positionMs);
      },
    };
  });

  deps.engine.setVolume(store.getState().volume);

  if (persistKey) {
    let last: PlayerState | null = null;
    let lastPositionSave = 0;
    const persist = (force: boolean): void => {
      const state = store.getState();
      const changed =
        last === null ||
        last.queue !== state.queue ||
        last.baseQueue !== state.baseQueue ||
        last.index !== state.index ||
        last.shuffle !== state.shuffle ||
        last.repeat !== state.repeat ||
        last.contextLabel !== state.contextLabel;
      const now = Date.now();
      if (!force && !changed && now - lastPositionSave < POSITION_SAVE_INTERVAL_MS) return;
      last = state;
      lastPositionSave = now;
      const payload: PersistedPlayer = {
        queue: state.queue,
        baseQueue: state.baseQueue,
        index: state.index,
        shuffle: state.shuffle,
        repeat: state.repeat,
        contextLabel: state.contextLabel,
        positionMs: Math.round(state.positionMs),
      };
      try {
        localStorage.setItem(persistKey, JSON.stringify(payload));
      } catch {
        // Storage unavailable; the queue lives for this session only.
      }
    };
    store.subscribe(() => persist(false));
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => persist(true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') persist(true);
      });
    }
  }

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

function readPersisted(key: string | null): PersistedPlayer | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PersistedPlayer>;
    const ids = (list: unknown): Id[] =>
      Array.isArray(list) ? list.filter((id): id is Id => typeof id === 'string') : [];
    const repeat: RepeatMode =
      value.repeat === 'all' || value.repeat === 'one' ? value.repeat : 'off';
    return {
      queue: ids(value.queue),
      baseQueue: ids(value.baseQueue),
      index: typeof value.index === 'number' ? value.index : 0,
      shuffle: Boolean(value.shuffle),
      repeat,
      contextLabel: typeof value.contextLabel === 'string' ? value.contextLabel : null,
      positionMs:
        typeof value.positionMs === 'number' && value.positionMs > 0 ? value.positionMs : 0,
    };
  } catch {
    return null;
  }
}
