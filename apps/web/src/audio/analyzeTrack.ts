import {
  analyzeSamples,
  downmixToMono,
  featuresToVibe,
  resample,
  type AudioFeatures,
  type MeasuredVibe,
  type Track,
} from '@weegood/core';

/**
 * Measure a track from its own audio (ADR 0011): fetch the first part of the stream, decode it,
 * mix to mono, downsample, extract features in a worker, map them to a vibe. Everything stays on
 * the device. Failures are expected (CORS, codec, offline) and surface as null.
 */

const ANALYSIS_RATE = 22_050;
const DEFAULT_BYTES = 1_200_000;
const DEFAULT_SECONDS = 45;

export interface AnalyzeOptions {
  /** How much of the stream to download. Default 1.2 MB, roughly 75 s at 128 kbps. */
  bytes?: number;
  /** How many seconds to analyse from the start. Default 45. */
  seconds?: number;
  signal?: AbortSignal;
}

export interface Analyzer {
  analyze(track: Track, url: string, options?: AnalyzeOptions): Promise<MeasuredVibe | null>;
  dispose(): void;
}

export function createAnalyzer(now: () => number = () => Date.now()): Analyzer {
  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (f: AudioFeatures) => void; reject: (e: Error) => void }
  >();

  const ensureWorker = (): Worker | null => {
    if (worker) return worker;
    if (typeof Worker === 'undefined') return null;
    try {
      worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return null;
    }
    worker.addEventListener(
      'message',
      (event: MessageEvent<{ id: number; features?: AudioFeatures; error?: string }>) => {
        const entry = pending.get(event.data.id);
        if (!entry) return;
        pending.delete(event.data.id);
        if (event.data.features) entry.resolve(event.data.features);
        else entry.reject(new Error(event.data.error ?? 'analysis failed'));
      },
    );
    worker.addEventListener('error', () => {
      for (const entry of pending.values()) entry.reject(new Error('analysis worker crashed'));
      pending.clear();
      worker?.terminate();
      worker = null;
    });
    return worker;
  };

  const extract = (samples: Float32Array, sampleRate: number): Promise<AudioFeatures> => {
    const w = ensureWorker();
    if (!w) return Promise.resolve(analyzeSamples(samples, sampleRate));
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      w.postMessage({ id, samples, sampleRate }, [samples.buffer]);
    });
  };

  return {
    async analyze(track, url, options = {}) {
      try {
        const bytes = options.bytes ?? DEFAULT_BYTES;
        const response = await fetch(url, {
          headers: { Range: `bytes=0-${bytes - 1}` },
          signal: options.signal ?? null,
        });
        if (!response.ok) return null;
        const encoded = await response.arrayBuffer();
        const decoded = await decode(encoded);
        if (!decoded) return null;

        const channels: Float32Array[] = [];
        for (let c = 0; c < decoded.numberOfChannels; c++) channels.push(decoded.getChannelData(c));
        const seconds = options.seconds ?? DEFAULT_SECONDS;
        const mono = downmixToMono(channels).slice(0, Math.floor(seconds * decoded.sampleRate));
        const samples = resample(mono, decoded.sampleRate, ANALYSIS_RATE);
        if (samples.length < ANALYSIS_RATE * 5) return null;

        const features = await extract(samples, ANALYSIS_RATE);
        return {
          trackId: track.id,
          vibe: featuresToVibe(features, track.vibe),
          features: {
            rmsDb: features.rmsDb,
            spectralCentroidHz: features.spectralCentroidHz,
            bassRatio: features.bassRatio,
            spectralFlatness: features.spectralFlatness,
            tempoBpm: features.tempoBpm,
            beatStrength: features.beatStrength,
            majorness: features.majorness,
            durationSeconds: features.durationSeconds,
          },
          measuredAt: now(),
        };
      } catch {
        return null;
      }
    },
    dispose() {
      worker?.terminate();
      worker = null;
      pending.clear();
    },
  };
}

async function decode(encoded: ArrayBuffer): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext !== 'undefined') {
    try {
      const ctx = new OfflineAudioContext(1, 1, 44_100);
      return await ctx.decodeAudioData(encoded.slice(0));
    } catch {
      // Fall through to a live context; Safari is picky about offline decoding.
    }
  }
  if (typeof AudioContext !== 'undefined') {
    const ctx = new AudioContext();
    try {
      return await ctx.decodeAudioData(encoded.slice(0));
    } catch {
      return null;
    } finally {
      void ctx.close();
    }
  }
  return null;
}
