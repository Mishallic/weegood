import type { Track } from '@weegood/core';
import { SnapshotEmitter, type EngineSnapshot, type PlaybackEngine } from './engine';
import { planVibeLoop } from './plan';
import { renderLoop } from './render';

const TICK_MS = 250;

/**
 * Plays catalog demo tracks by looping a buffer rendered from the track's vibe (ADR 0006). The
 * loop runs for the track's nominal duration so seeking and progress feel like a real track.
 */
export class SynthEngine implements PlaybackEngine {
  private readonly emitter = new SnapshotEmitter();
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private track: Track | null = null;
  private volume = 1;
  /** Position within the track when the current source started, in seconds. */
  private offsetSeconds = 0;
  /** AudioContext time at which the current source started. */
  private startedAtContextTime = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private loadId = 0;

  async load(track: Track, _blob: Blob | null): Promise<void> {
    const id = ++this.loadId;
    this.stopSource();
    this.track = track;
    this.offsetSeconds = 0;
    this.emitter.set({
      status: 'loading',
      positionMs: 0,
      durationMs: track.durationMs,
      error: null,
    });

    const context = this.ensureContext();
    try {
      const buffer = await renderLoop(planVibeLoop(track), context.sampleRate);
      if (id !== this.loadId) return;
      this.buffer = buffer;
      this.emitter.set({ status: 'paused' });
    } catch (error) {
      if (id !== this.loadId) return;
      this.emitter.set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not render the preview.',
      });
      throw error;
    }
  }

  async play(): Promise<void> {
    const context = this.ensureContext();
    if (!this.buffer || !this.track) return;
    if (context.state === 'suspended') await context.resume();
    if (this.emitter.value.status === 'ended') this.offsetSeconds = 0;
    this.startSource(context);
    this.emitter.set({ status: 'playing' });
    this.startTicker();
  }

  pause(): void {
    if (this.emitter.value.status !== 'playing') return;
    this.offsetSeconds = this.currentSeconds();
    this.stopSource();
    this.stopTicker();
    this.emitter.set({ status: 'paused', positionMs: this.offsetSeconds * 1000 });
  }

  seek(positionMs: number): void {
    if (!this.track) return;
    const seconds = Math.max(0, Math.min(positionMs, this.track.durationMs)) / 1000;
    const wasPlaying = this.emitter.value.status === 'playing';
    this.stopSource();
    this.offsetSeconds = seconds;
    if (wasPlaying && this.context) this.startSource(this.context);
    this.emitter.set({
      positionMs: seconds * 1000,
      status: wasPlaying ? 'playing' : 'paused',
    });
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gain) this.gain.gain.value = this.volume;
  }

  snapshot(): EngineSnapshot {
    return this.emitter.value;
  }

  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
    return this.emitter.subscribe(listener);
  }

  dispose(): void {
    this.stopSource();
    this.stopTicker();
    void this.context?.close();
    this.context = null;
    this.gain = null;
    this.buffer = null;
    this.track = null;
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.context.destination);
    }
    return this.context;
  }

  private startSource(context: AudioContext): void {
    if (!this.buffer || !this.gain) return;
    const source = context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = true;
    source.connect(this.gain);
    const loopOffset = this.offsetSeconds % this.buffer.duration;
    source.start(0, loopOffset);
    this.source = source;
    this.startedAtContextTime = context.currentTime;
  }

  private stopSource(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // Already stopped.
      }
      this.source.disconnect();
      this.source = null;
    }
  }

  private currentSeconds(): number {
    if (!this.context || !this.source) return this.offsetSeconds;
    return this.offsetSeconds + (this.context.currentTime - this.startedAtContextTime);
  }

  private startTicker(): void {
    this.stopTicker();
    this.ticker = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private tick(): void {
    if (!this.track) return;
    const positionMs = this.currentSeconds() * 1000;
    if (positionMs >= this.track.durationMs) {
      this.stopSource();
      this.stopTicker();
      this.offsetSeconds = 0;
      this.emitter.set({ status: 'ended', positionMs: this.track.durationMs });
      return;
    }
    this.emitter.set({ positionMs });
  }
}
