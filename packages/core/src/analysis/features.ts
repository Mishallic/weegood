import { bpmToTempo, clamp01, type VibeVector } from '../domain/vibe';
import { hannWindow, magnitudeSpectrum } from './fft';

/**
 * Audio feature extraction (ADR 0011). Pure functions over PCM samples so they run in a worker on
 * the web, in Node for tests, and later in the native shells. The web app decodes the first part
 * of a stream, mixes to mono, downsamples, and hands the samples here.
 */

export interface AudioFeatures {
  /** Seconds of audio analysed. */
  durationSeconds: number;
  /** Root mean square level, 0..1 linear. */
  rms: number;
  /** RMS in dBFS, floored at -100. */
  rmsDb: number;
  /** Energy-weighted mean frequency, Hz. Higher is brighter. */
  spectralCentroidHz: number;
  /** Share of spectral energy below 150 Hz, 0..1. */
  bassRatio: number;
  /** Geometric over arithmetic mean of the power spectrum, 0..1. Noise-like material is high. */
  spectralFlatness: number;
  /** Estimated tempo, beats per minute, within 60..180. */
  tempoBpm: number;
  /** How periodic the onset envelope is at the estimated tempo, 0..1. */
  beatStrength: number;
  /** 1 for clearly major-key material, 0 for clearly minor, 0.5 for ambiguous. */
  majorness: number;
}

export interface AnalysisOptions {
  /** Frame length in samples. Power of two. Default 2048. */
  frameSize?: number;
  /** Hop between frames in samples. Default 512. */
  hopSize?: number;
}

const BASS_CUTOFF_HZ = 150;
const CHROMA_MIN_HZ = 60;
const CHROMA_MAX_HZ = 4000;
const BPM_MIN = 60;
const BPM_MAX = 180;
const DB_FLOOR = -100;

/** Krumhansl-Schmuckler key profiles, C major and C minor. */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export function analyzeSamples(
  samples: Float32Array,
  sampleRate: number,
  options: AnalysisOptions = {},
): AudioFeatures {
  const frameSize = options.frameSize ?? 2048;
  const hopSize = options.hopSize ?? 512;
  const durationSeconds = samples.length / sampleRate;
  const rms = rootMeanSquare(samples);
  const rmsDb = rms > 0 ? Math.max(DB_FLOOR, 20 * Math.log10(rms)) : DB_FLOOR;

  const frameCount = Math.floor((samples.length - frameSize) / hopSize) + 1;
  if (frameCount < 2) {
    return {
      durationSeconds,
      rms,
      rmsDb,
      spectralCentroidHz: 0,
      bassRatio: 0,
      spectralFlatness: 0,
      tempoBpm: 120,
      beatStrength: 0,
      majorness: 0.5,
    };
  }

  const window = hannWindow(frameSize);
  const bins = frameSize / 2 + 1;
  const binHz = sampleRate / frameSize;
  const bassBins = Math.max(1, Math.ceil(BASS_CUTOFF_HZ / binHz));
  const chromaLow = Math.max(1, Math.floor(CHROMA_MIN_HZ / binHz));
  const chromaHigh = Math.min(bins - 1, Math.floor(CHROMA_MAX_HZ / binHz));

  let centroidSum = 0;
  let centroidWeight = 0;
  let bassEnergy = 0;
  let totalEnergy = 0;
  let flatnessSum = 0;
  let flatnessFrames = 0;
  const chroma = new Float64Array(12);
  const onsets = new Float64Array(frameCount);
  let previous: Float64Array = new Float64Array(bins);

  for (let f = 0; f < frameCount; f++) {
    const start = f * hopSize;
    const spectrum = magnitudeSpectrum(samples.subarray(start, start + frameSize), window);

    let weighted = 0;
    let magnitudeSum = 0;
    let frameEnergy = 0;
    let logSum = 0;
    let flux = 0;
    for (let b = 1; b < bins; b++) {
      const magnitude = spectrum[b] as number;
      const power = magnitude * magnitude;
      weighted += b * binHz * magnitude;
      magnitudeSum += magnitude;
      frameEnergy += power;
      if (b < bassBins) bassEnergy += power;
      logSum += Math.log(power + 1e-12);
      const rise = magnitude - (previous[b] as number);
      if (rise > 0) flux += rise;
    }
    totalEnergy += frameEnergy;
    if (magnitudeSum > 0) {
      centroidSum += weighted;
      centroidWeight += magnitudeSum;
    }
    if (frameEnergy > 1e-9) {
      const arithmetic = frameEnergy / (bins - 1);
      const geometric = Math.exp(logSum / (bins - 1));
      flatnessSum += geometric / arithmetic;
      flatnessFrames++;
    }
    onsets[f] = flux;

    for (let b = chromaLow; b <= chromaHigh; b++) {
      const magnitude = spectrum[b] as number;
      if (magnitude <= 0) continue;
      const hz = b * binHz;
      const pitchClass = (((Math.round(12 * Math.log2(hz / 440)) + 69) % 12) + 12) % 12;
      chroma[pitchClass] = (chroma[pitchClass] as number) + magnitude * magnitude;
    }
    previous = spectrum;
  }

  const { tempoBpm, beatStrength } = estimateTempo(onsets, sampleRate / hopSize);

  return {
    durationSeconds,
    rms,
    rmsDb,
    spectralCentroidHz: centroidWeight > 0 ? centroidSum / centroidWeight : 0,
    bassRatio: totalEnergy > 0 ? bassEnergy / totalEnergy : 0,
    spectralFlatness: flatnessFrames > 0 ? clamp01(flatnessSum / flatnessFrames) : 0,
    tempoBpm,
    beatStrength,
    majorness: estimateMajorness(chroma),
  };
}

/** Mix any number of channels to one. */
export function downmixToMono(channels: ReadonlyArray<Float32Array>): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first;
  const out = new Float32Array(first.length);
  for (const channel of channels) {
    for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) + (channel[i] ?? 0);
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) / channels.length;
  return out;
}

/** Linear-interpolation resampler. Fine for feature extraction, not for listening. */
export function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const a = samples[index] ?? 0;
    const b = samples[index + 1] ?? a;
    out[i] = a + (b - a) * fraction;
  }
  return out;
}

/**
 * Turn measurements into a vibe. Dimensions we can hear are measured; valence is only partly
 * observable (mode and energy), and instrumentalness is not measured at all, so those lean on the
 * prior that came with the track's metadata.
 */
export function featuresToVibe(features: AudioFeatures, prior: VibeVector): VibeVector {
  const loudness = clamp01((features.rmsDb + 32) / 24);
  const energy = clamp01(0.75 * loudness + 0.25 * features.beatStrength);
  const brightness = clamp01((features.spectralCentroidHz - 500) / 3500);
  const acousticness = clamp01(1 - 0.7 * brightness - 0.3 * clamp01(features.spectralFlatness * 4));
  const danceability = clamp01(
    0.6 * features.beatStrength + 0.4 * Math.min(1, features.bassRatio * 3),
  );
  const tempo = bpmToTempo(features.tempoBpm);
  const measuredValence = clamp01(0.2 + 0.5 * features.majorness + 0.3 * energy);
  return {
    energy,
    valence: clamp01(prior.valence * 0.4 + measuredValence * 0.6),
    danceability,
    acousticness,
    instrumentalness: prior.instrumentalness,
    tempo,
  };
}

/* ------------------------------------------------------------------------------------------- */

function rootMeanSquare(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] as number;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Tempo from the autocorrelation of the onset envelope over lags that correspond to 60..180 BPM,
 * with a soft prior around 120 BPM to break octave ties the way listeners do.
 */
function estimateTempo(
  onsets: Float64Array,
  frameRate: number,
): { tempoBpm: number; beatStrength: number } {
  const n = onsets.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += onsets[i] as number;
  mean /= n;
  const centered = new Float64Array(n);
  let energy = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, (onsets[i] as number) - mean);
    centered[i] = v;
    energy += v * v;
  }
  if (energy <= 0) return { tempoBpm: 120, beatStrength: 0 };

  const minLag = Math.max(1, Math.floor((60 / BPM_MAX) * frameRate));
  const maxLag = Math.min(n - 2, Math.ceil((60 / BPM_MIN) * frameRate));
  if (maxLag <= minLag) return { tempoBpm: 120, beatStrength: 0 };

  let bestLag = minLag;
  let bestValue = -Infinity;
  let bestRaw = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < n; i++)
      sum += (centered[i] as number) * (centered[i + lag] as number);
    const normalized = sum / energy;
    const bpm = (60 * frameRate) / lag;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    const value = normalized * (0.6 + 0.4 * prior);
    if (value > bestValue) {
      bestValue = value;
      bestLag = lag;
      bestRaw = normalized;
    }
  }
  const tempoBpm = Math.min(BPM_MAX, Math.max(BPM_MIN, (60 * frameRate) / bestLag));
  return { tempoBpm: Math.round(tempoBpm), beatStrength: clamp01(bestRaw) };
}

function estimateMajorness(chroma: Float64Array): number {
  let total = 0;
  for (let i = 0; i < 12; i++) total += chroma[i] as number;
  if (total <= 0) return 0.5;
  const normalized = Array.from(chroma, (v) => v / total);
  let bestMajor = -1;
  let bestMinor = -1;
  for (let rotation = 0; rotation < 12; rotation++) {
    bestMajor = Math.max(bestMajor, correlation(normalized, MAJOR_PROFILE, rotation));
    bestMinor = Math.max(bestMinor, correlation(normalized, MINOR_PROFILE, rotation));
  }
  return clamp01(0.5 + (bestMajor - bestMinor) * 1.5);
}

function correlation(values: number[], profile: number[], rotation: number): number {
  const n = 12;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += values[i] as number;
    meanB += profile[i] as number;
  }
  meanA /= n;
  meanB /= n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const a = (values[(i + rotation) % n] as number) - meanA;
    const b = (profile[i] as number) - meanB;
    cov += a * b;
    varA += a * a;
    varB += b * b;
  }
  return varA > 0 && varB > 0 ? cov / Math.sqrt(varA * varB) : 0;
}
