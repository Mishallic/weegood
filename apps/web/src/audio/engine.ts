import type { Track } from '@weegood/core';

export type EngineStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface EngineSnapshot {
  status: EngineStatus;
  positionMs: number;
  durationMs: number;
  error: string | null;
}

/**
 * One interface for anything that can make sound. The UI and the player store never know whether
 * they are driving a real file or a synthesised demo loop (ADR 0006).
 */
export interface PlaybackEngine {
  /** Prepare `track`. `blob` is the audio for local tracks, null for catalog demo tracks. */
  load(track: Track, blob: Blob | null): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(positionMs: number): void;
  setVolume(volume: number): void;
  snapshot(): EngineSnapshot;
  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void;
  dispose(): void;
}

export const IDLE_SNAPSHOT: EngineSnapshot = {
  status: 'idle',
  positionMs: 0,
  durationMs: 0,
  error: null,
};

/** Small shared emitter so each engine only has to care about its own audio. */
export class SnapshotEmitter {
  private listeners = new Set<(snapshot: EngineSnapshot) => void>();
  private current: EngineSnapshot = IDLE_SNAPSHOT;

  get value(): EngineSnapshot {
    return this.current;
  }

  set(partial: Partial<EngineSnapshot>): void {
    this.current = { ...this.current, ...partial };
    for (const listener of this.listeners) listener(this.current);
  }

  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
