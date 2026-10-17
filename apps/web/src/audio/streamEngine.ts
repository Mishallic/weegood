import type { Track } from '@weegood/core';
import { SnapshotEmitter, type EngineSnapshot, type PlaybackEngine } from './engine';

export interface StreamEngineOptions {
  /** Resolve a playable URL for a streamed track. Null means the track cannot be played. */
  streamUrlFor: (track: Track) => string | null;
  createAudio?: () => HTMLAudioElement;
}

/**
 * The one engine: plays local files from object URLs and streamed tracks straight from their URL
 * through an HTMLAudioElement, which handles progressive download, range requests and redirects.
 * A second element pre-buffers the next track so transitions are quick (ADR 0010).
 */
export class StreamEngine implements PlaybackEngine {
  private readonly emitter = new SnapshotEmitter();
  private readonly createAudio: () => HTMLAudioElement;
  private readonly streamUrlFor: (track: Track) => string | null;
  private audio: HTMLAudioElement;
  private prefetched: { url: string; audio: HTMLAudioElement } | null = null;
  private objectUrl: string | null = null;
  private fallbackDurationMs = 0;
  private volume = 1;

  constructor(options: StreamEngineOptions) {
    this.streamUrlFor = options.streamUrlFor;
    this.createAudio = options.createAudio ?? (() => new Audio());
    this.audio = this.createAudio();
    this.attach(this.audio);
  }

  async load(track: Track, blob: Blob | null): Promise<void> {
    const url = this.urlFor(track, blob);
    if (!url) throw new Error('This track has no playable source.');
    this.fallbackDurationMs = track.durationMs;
    this.emitter.set({
      status: 'loading',
      positionMs: 0,
      durationMs: track.durationMs,
      error: null,
    });

    if (this.prefetched && this.prefetched.url === url) {
      this.swapIn(this.prefetched.audio);
      this.prefetched = null;
      return;
    }
    this.releaseObjectUrl();
    if (blob) this.objectUrl = url;
    this.audio.src = url;
    this.audio.load();
  }

  /** Start buffering the next track so the switch is instant. Streamed tracks only. */
  prefetch(track: Track): void {
    if (track.source.kind !== 'stream') return;
    const url = this.streamUrlFor(track);
    if (!url || this.prefetched?.url === url || this.audio.src === url) return;
    this.prefetched?.audio.removeAttribute('src');
    const audio = this.createAudio();
    audio.preload = 'auto';
    audio.volume = this.volume;
    audio.src = url;
    audio.load();
    this.prefetched = { url, audio };
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
    this.volume = Math.max(0, Math.min(1, volume));
    this.audio.volume = this.volume;
    if (this.prefetched) this.prefetched.audio.volume = this.volume;
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
    this.prefetched?.audio.removeAttribute('src');
    this.prefetched = null;
    this.releaseObjectUrl();
  }

  private urlFor(track: Track, blob: Blob | null): string | null {
    if (track.source.kind === 'local') return blob ? URL.createObjectURL(blob) : null;
    return this.streamUrlFor(track);
  }

  private swapIn(next: HTMLAudioElement): void {
    this.detach(this.audio);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.releaseObjectUrl();
    this.audio = next;
    this.audio.volume = this.volume;
    this.attach(this.audio);
    this.onTime();
  }

  private attach(audio: HTMLAudioElement): void {
    audio.preload = 'auto';
    audio.volume = this.volume;
    audio.addEventListener('timeupdate', this.onTime);
    audio.addEventListener('durationchange', this.onTime);
    audio.addEventListener('play', this.onPlay);
    audio.addEventListener('pause', this.onPause);
    audio.addEventListener('ended', this.onEnded);
    audio.addEventListener('error', this.onError);
  }

  private detach(audio: HTMLAudioElement): void {
    audio.removeEventListener('timeupdate', this.onTime);
    audio.removeEventListener('durationchange', this.onTime);
    audio.removeEventListener('play', this.onPlay);
    audio.removeEventListener('pause', this.onPause);
    audio.removeEventListener('ended', this.onEnded);
    audio.removeEventListener('error', this.onError);
  }

  private onTime = (): void => {
    this.emitter.set({ positionMs: this.audio.currentTime * 1000, durationMs: this.durationMs() });
  };

  private onPlay = (): void => this.emitter.set({ status: 'playing', error: null });

  private onPause = (): void => {
    if (this.emitter.value.status !== 'ended') this.emitter.set({ status: 'paused' });
  };

  private onEnded = (): void => this.emitter.set({ status: 'ended' });

  private onError = (): void => {
    this.emitter.set({ status: 'error', error: 'This track could not be loaded.' });
  };

  private durationMs(): number {
    const seconds = this.audio.duration;
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : this.fallbackDurationMs;
  }

  private releaseObjectUrl(): void {
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
