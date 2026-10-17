import { createRng, tempoToBpm, type Track, type VibeVector } from '@weegood/core';

/**
 * The musical plan for a synthesised preview (ADR 0006), derived from a track's vibe. Pure and
 * deterministic so it can be unit-tested in Node; `render.ts` turns it into audio.
 */

export type Waveform = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface Note {
  /** Seconds from the start of the loop. */
  time: number;
  /** Seconds. */
  duration: number;
  midi: number;
  /** 0..1 */
  velocity: number;
}

export interface Hit {
  time: number;
  velocity: number;
}

export interface LoopPlan {
  bpm: number;
  bars: number;
  loopSeconds: number;
  major: boolean;
  padWave: Waveform;
  bassWave: Waveform;
  leadWave: Waveform;
  /** Low-pass cutoff for the pad and bass, in Hz. */
  cutoffHz: number;
  padGain: number;
  bassGain: number;
  leadGain: number;
  kickGain: number;
  hatGain: number;
  snareGain: number;
  pad: Note[];
  bass: Note[];
  lead: Note[];
  kicks: Hit[];
  hats: Hit[];
  snares: Hit[];
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
/** Scale degrees: I V vi IV for major, i VI III VII for minor. */
const MAJOR_PROGRESSION = [0, 4, 5, 3];
const MINOR_PROGRESSION = [0, 5, 2, 6];

export function planVibeLoop(track: Pick<Track, 'id' | 'vibe'>): LoopPlan {
  const v: VibeVector = track.vibe;
  const rng = createRng(`synth:${track.id}`);
  const bpm = tempoToBpm(v.tempo);
  const beat = 60 / bpm;
  const bars = 4;
  const loopSeconds = bars * 4 * beat;
  const major = v.valence >= 0.5;
  const scale = major ? MAJOR : MINOR;
  const progression = major ? MAJOR_PROGRESSION : MINOR_PROGRESSION;
  const rootMidi = 45 + rng.int(0, 11);

  const degreeToMidi = (degree: number, octave = 0): number => {
    const wrapped = ((degree % 7) + 7) % 7;
    const octaves = Math.floor(degree / 7) + octave;
    return rootMidi + (scale[wrapped] ?? 0) + octaves * 12;
  };

  const pad: Note[] = [];
  const bass: Note[] = [];
  const lead: Note[] = [];
  const kicks: Hit[] = [];
  const hats: Hit[] = [];
  const snares: Hit[] = [];

  const hasKick = v.energy > 0.3;
  const hasHats = v.danceability > 0.45;
  const sixteenths = v.danceability > 0.75;
  const hasSnare = v.energy > 0.6;
  const bassEighths = v.danceability > 0.6;
  const arpeggiate = v.instrumentalness > 0.5;

  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * 4 * beat;
    const degree = progression[bar] ?? 0;
    const chord = [degree, degree + 2, degree + 4];

    for (const tone of chord) {
      pad.push({
        time: barStart,
        duration: 4 * beat,
        midi: degreeToMidi(tone, 1),
        velocity: 0.8,
      });
    }

    const bassSteps = bassEighths ? 8 : 4;
    for (let step = 0; step < bassSteps; step++) {
      const time = barStart + (step * 4 * beat) / bassSteps;
      const octaveHop = bassEighths && step % 2 === 1 && rng.next() < 0.3 ? 1 : 0;
      bass.push({
        time,
        duration: ((4 * beat) / bassSteps) * 0.8,
        midi: degreeToMidi(degree, -1 + octaveHop),
        velocity: step % 2 === 0 ? 0.9 : 0.6,
      });
    }

    for (let beatIndex = 0; beatIndex < 4; beatIndex++) {
      const time = barStart + beatIndex * beat;
      if (hasKick) kicks.push({ time, velocity: beatIndex === 0 ? 1 : 0.85 });
      if (hasSnare && (beatIndex === 1 || beatIndex === 3)) snares.push({ time, velocity: 0.8 });
    }

    if (hasHats) {
      const steps = sixteenths ? 16 : 8;
      for (let step = 0; step < steps; step++) {
        const time = barStart + (step * 4 * beat) / steps;
        const offbeat = step % 2 === 1;
        hats.push({ time, velocity: offbeat ? 0.9 : 0.45 });
      }
    }

    if (arpeggiate) {
      const pattern = rng.shuffle([0, 1, 2, 1]);
      for (let step = 0; step < 8; step++) {
        const time = barStart + (step * beat) / 2;
        const tone = chord[pattern[step % 4] ?? 0] ?? degree;
        lead.push({ time, duration: beat * 0.45, midi: degreeToMidi(tone, 2), velocity: 0.7 });
      }
    } else {
      // A slower, song-like line over the chord for tracks that would have a vocal.
      const steps = 4;
      for (let step = 0; step < steps; step++) {
        if (rng.next() < 0.25) continue;
        const time = barStart + step * beat;
        const tone = rng.pick([degree, degree + 2, degree + 4, degree + 1, degree + 3]);
        lead.push({ time, duration: beat * 0.9, midi: degreeToMidi(tone, 2), velocity: 0.6 });
      }
    }
  }

  const bright = v.acousticness < 0.5;
  return {
    bpm,
    bars,
    loopSeconds,
    major,
    padWave: bright ? 'sawtooth' : 'triangle',
    bassWave: v.energy > 0.5 ? 'sawtooth' : 'triangle',
    leadWave: bright ? 'square' : 'sine',
    cutoffHz: 500 + v.energy * 3000,
    padGain: 0.1 + (1 - v.energy) * 0.08,
    bassGain: 0.14 + v.energy * 0.08,
    leadGain: arpeggiate ? 0.06 : 0.08,
    kickGain: hasKick ? 0.35 + v.energy * 0.35 : 0,
    hatGain: hasHats ? 0.05 + v.danceability * 0.08 : 0,
    snareGain: hasSnare ? 0.16 : 0,
    pad,
    bass,
    lead,
    kicks,
    hats,
    snares,
  };
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
