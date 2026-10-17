import { describe, expect, it } from 'vitest';
import { NEUTRAL_VIBE, vibe } from '../domain/vibe';
import { analyzeSamples, downmixToMono, featuresToVibe, resample } from './features';
import { fft, isPowerOfTwo } from './fft';

const RATE = 22_050;

function seconds(n: number): Float32Array {
  return new Float32Array(Math.floor(n * RATE));
}

function sine(hz: number, durationSeconds: number, amplitude = 0.5): Float32Array {
  const out = seconds(durationSeconds);
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / RATE);
  return out;
}

function chord(frequencies: number[], durationSeconds: number): Float32Array {
  const out = seconds(durationSeconds);
  for (const hz of frequencies) {
    for (let i = 0; i < out.length; i++) {
      out[i] =
        (out[i] as number) + (0.3 / frequencies.length) * Math.sin((2 * Math.PI * hz * i) / RATE);
    }
  }
  return out;
}

function clickTrain(bpm: number, durationSeconds: number): Float32Array {
  const out = seconds(durationSeconds);
  const period = Math.round((60 / bpm) * RATE);
  for (let start = 0; start < out.length; start += period) {
    for (let i = 0; i < 400 && start + i < out.length; i++) {
      out[start + i] = Math.exp(-i / 60) * Math.sin(i * 0.9);
    }
  }
  return out;
}

function whiteNoise(durationSeconds: number): Float32Array {
  const out = seconds(durationSeconds);
  let state = 12345;
  for (let i = 0; i < out.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out[i] = (state / 4294967296) * 2 - 1;
  }
  return out;
}

describe('fft', () => {
  it('finds a single tone in the right bin', () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 64 * i) / n);
    fft(re, im);
    let bestBin = 0;
    let best = 0;
    for (let i = 0; i < n / 2; i++) {
      const magnitude = Math.hypot(re[i] as number, im[i] as number);
      if (magnitude > best) {
        best = magnitude;
        bestBin = i;
      }
    }
    expect(bestBin).toBe(64);
    expect(isPowerOfTwo(1024)).toBe(true);
    expect(isPowerOfTwo(1000)).toBe(false);
  });
});

describe('analyzeSamples', () => {
  it('hears silence as silence', () => {
    const features = analyzeSamples(seconds(5), RATE);
    expect(features.rms).toBe(0);
    expect(features.rmsDb).toBe(-100);
    expect(features.beatStrength).toBe(0);
    expect(features.majorness).toBe(0.5);
  });

  it('measures a low tone as bass-heavy and dark', () => {
    const features = analyzeSamples(sine(100, 5), RATE);
    expect(features.bassRatio).toBeGreaterThan(0.8);
    expect(features.spectralCentroidHz).toBeLessThan(300);
    expect(features.spectralFlatness).toBeLessThan(0.1);
    expect(features.rmsDb).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 0);
  });

  it('measures white noise as flat and bright', () => {
    const features = analyzeSamples(whiteNoise(5), RATE);
    expect(features.spectralFlatness).toBeGreaterThan(0.5);
    expect(features.spectralCentroidHz).toBeGreaterThan(4000);
    expect(features.bassRatio).toBeLessThan(0.1);
  });

  it('finds the tempo of a click train', () => {
    for (const bpm of [96, 128, 150]) {
      const features = analyzeSamples(clickTrain(bpm, 20), RATE);
      expect(Math.abs(features.tempoBpm - bpm)).toBeLessThanOrEqual(4);
      expect(features.beatStrength).toBeGreaterThan(0.3);
    }
  });

  it('tells major from minor', () => {
    const major = analyzeSamples(chord([261.63, 329.63, 392.0], 4), RATE);
    const minor = analyzeSamples(chord([261.63, 311.13, 392.0], 4), RATE);
    expect(major.majorness).toBeGreaterThan(0.5);
    expect(minor.majorness).toBeLessThan(0.5);
  });
});

describe('featuresToVibe', () => {
  it('maps loud, beat-driven, bright material to high energy and danceability', () => {
    const features = analyzeSamples(clickTrain(128, 10), RATE);
    const measured = featuresToVibe({ ...features, rmsDb: -10, bassRatio: 0.4 }, NEUTRAL_VIBE);
    expect(measured.energy).toBeGreaterThan(0.6);
    expect(measured.danceability).toBeGreaterThan(0.5);
    expect(measured.tempo).toBeCloseTo((128 - 60) / 120, 1);
  });

  it('keeps instrumentalness from the prior and blends valence', () => {
    const features = analyzeSamples(sine(220, 3), RATE);
    const prior = vibe({ instrumentalness: 0.9, valence: 0.9 });
    const measured = featuresToVibe(features, prior);
    expect(measured.instrumentalness).toBe(0.9);
    expect(measured.valence).toBeLessThan(0.9);
    expect(measured.valence).toBeGreaterThan(0.3);
  });
});

describe('downmixToMono and resample', () => {
  it('averages channels and resamples by ratio', () => {
    const left = new Float32Array([1, 1, 1, 1]);
    const right = new Float32Array([0, 0, 0, 0]);
    expect(Array.from(downmixToMono([left, right]))).toEqual([0.5, 0.5, 0.5, 0.5]);
    const down = resample(new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]), 8000, 4000);
    expect(down.length).toBe(4);
    expect(Array.from(down)).toEqual([0, 2, 4, 6]);
    expect(resample(left, 100, 100)).toBe(left);
  });
});
