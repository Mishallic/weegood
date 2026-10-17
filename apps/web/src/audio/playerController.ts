import type { Track } from '@weegood/core';
import { IDLE_SNAPSHOT, type EngineSnapshot, type PlaybackEngine } from './engine';

export interface PlayerControllerDeps {
  /** Engine for local files. */
  html: PlaybackEngine;
  /** Engine for catalog demo tracks. */
  synth: PlaybackEngine;
}

/**
 * Routes each track to the right engine and presents one stream of snapshots. Only the active
 * engine's snapshots are forwarded, so a paused engine cannot talk over the playing one.
 */
export class PlayerController {
  private readonly engines: PlayerControllerDeps;
  private active: PlaybackEngine | null = null;
  private unsubscribeActive: (() => void) | null = null;
  private readonly listeners = new Set<(snapshot: EngineSnapshot) => void>();
  private volume = 1;

  constructor(engines: PlayerControllerDeps) {
    this.engines = engines;
  }

  async load(track: Track, blob: Blob | null): Promise<void> {
    const next = track.source.kind === 'local' ? this.engines.html : this.engines.synth;
    if (this.active && this.active !== next) this.active.pause();
    if (this.active !== next) {
      this.unsubscribeActive?.();
      this.active = next;
      this.unsubscribeActive = next.subscribe((snapshot) => this.emit(snapshot));
    }
    next.setVolume(this.volume);
    await next.load(track, blob);
  }

  async play(): Promise<void> {
    await this.active?.play();
  }

  pause(): void {
    this.active?.pause();
  }

  seek(positionMs: number): void {
    this.active?.seek(positionMs);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.engines.html.setVolume(volume);
    this.engines.synth.setVolume(volume);
  }

  snapshot(): EngineSnapshot {
    return this.active?.snapshot() ?? IDLE_SNAPSHOT;
  }

  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.unsubscribeActive?.();
    this.engines.html.dispose();
    this.engines.synth.dispose();
    this.listeners.clear();
  }

  private emit(snapshot: EngineSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }
}
