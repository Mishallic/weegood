import type { Track } from '@weegood/core';
import { SnapshotEmitter, type EngineSnapshot, type PlaybackEngine } from './engine';

/** Plays local files through an HTMLAudioElement fed by an object URL (ADR 0008). */
export class HtmlAudioEngine implements PlaybackEngine {
  private readonly audio: HTMLAudioElement;
  private readonly emitter = new SnapshotEmitter();
  private objectUrl: string | null = null;
  private fallbackDurationMs = 0;

  constructor(audio: HTMLAudioElement = new Audio()) {
    this.audio = audio;
    this.audio.preload = 'auto';
    this.audio.addEventListener('timeupdate', this.onTime);
    this.audio.addEventListener('durationchange', this.onTime);
    this.audio.addEventListener('play', () => this.emitter.set({ status: 'playing' }));
    this.audio.addEventListener('pause', () => {
      if (this.emitter.value.status !== 'ended') this.emitter.set({ status: 'paused' });
    });
    this.audio.addEventListener('ended', () => this.emitter.set({ status: 'ended' }));
    this.audio.addEventListener('error', () => {
      this.emitter.set({ status: 'error', error: 'This file could not be decoded.' });
    });
  }

  async load(track: Track, blob: Blob | null): Promise<void> {
    if (!blob) throw new Error('Local tracks need their audio blob.');
    this.revoke();
    this.fallbackDurationMs = track.durationMs;
    this.emitter.set({
      status: 'loading',
      positionMs: 0,
      durationMs: track.durationMs,
      error: null,
    });
    this.objectUrl = URL.createObjectURL(blob);
    this.audio.src = this.objectUrl;
    this.audio.load();
  }

  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch (error) {
      this.emitter.set({ status: 'error', error: messageOf(error) });
      throw error;
    }
  }

  pause(): void {
    this.audio.pause();
  }

  seek(positionMs: number): void {
    const duration = this.durationMs();
    const clamped = Math.max(0, Math.min(positionMs, duration || positionMs));
    this.audio.currentTime = clamped / 1000;
    this.emitter.set({ positionMs: clamped });
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  snapshot(): EngineSnapshot {
    return this.emitter.value;
  }

  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
    return this.emitter.subscribe(listener);
  }

  dispose(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.revoke();
  }

  private onTime = (): void => {
    this.emitter.set({
      positionMs: this.audio.currentTime * 1000,
      durationMs: this.durationMs(),
    });
  };

  private durationMs(): number {
    const seconds = this.audio.duration;
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : this.fallbackDurationMs;
  }

  private revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'Tap play to start audio. Browsers block autoplay.';
  }
  return error instanceof Error ? error.message : 'Playback failed.';
}
