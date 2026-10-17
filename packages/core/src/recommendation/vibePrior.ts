import { genreById } from '../catalog/genres';
import type { Id } from '../domain/types';
import {
  bpmToTempo,
  centroid,
  clamp01,
  mapVibe,
  NEUTRAL_VIBE,
  nudge,
  type VibeVector,
} from '../domain/vibe';
import { providerMoodHint } from './moods';

/**
 * The best vibe estimate for a track from its metadata alone. Used until the audio has been
 * measured (ADR 0011). Genre sets the centre, mood bends valence and energy, tags and BPM and key
 * refine what they can speak to.
 */
export interface VibePriorInput {
  genreIds: readonly Id[];
  mood: string | null;
  tags: readonly string[];
  bpm: number | null;
  musicalKey: string | null;
}

const INSTRUMENTAL_TAGS = [
  'instrumental',
  'beat',
  'beats',
  'type beat',
  'typebeat',
  'score',
  'ost',
];
const VOCAL_TAGS = ['vocal', 'vocals', 'rap', 'singer', 'singing', 'song', 'lyrics'];
const ACOUSTIC_TAGS = [
  'acoustic',
  'piano',
  'guitar',
  'unplugged',
  'strings',
  'orchestra',
  'orchestral',
];
const DANCE_TAGS = ['remix', 'club', 'dance', 'dj', 'bootleg', 'edit'];
const CALM_TAGS = ['ambient', 'drone', 'sleep', 'meditation', 'relax', 'chill', 'study'];

export function priorVibeForTrack(input: VibePriorInput): VibeVector {
  const genres = input.genreIds.map(genreById).filter((genre) => genre !== undefined);
  let v =
    genres.length > 0 ? centroid(genres.map((genre) => ({ vibe: genre.vibe }))) : NEUTRAL_VIBE;

  const moodHint = providerMoodHint(input.mood);
  if (moodHint) v = nudge(v, moodHint, 0.5);

  const tags = new Set(input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  const has = (list: readonly string[]) => list.some((tag) => tags.has(tag));
  if (has(INSTRUMENTAL_TAGS)) v = nudge(v, { instrumentalness: 0.9 }, 0.6);
  if (has(VOCAL_TAGS)) v = nudge(v, { instrumentalness: 0.1 }, 0.6);
  if (has(ACOUSTIC_TAGS)) v = nudge(v, { acousticness: 0.9 }, 0.5);
  if (has(DANCE_TAGS)) v = nudge(v, { danceability: 0.9 }, 0.3);
  if (has(CALM_TAGS)) v = nudge(v, { energy: 0.2, tempo: 0.3 }, 0.4);

  const bpm = normalizeBpm(input.bpm);
  if (bpm !== null) v = { ...v, tempo: bpmToTempo(bpm) };

  if (input.musicalKey) {
    const key = input.musicalKey.toLowerCase();
    if (key.includes('minor'))
      v = mapVibe(v, (value, dim) => (dim === 'valence' ? value - 0.1 : value));
    else if (key.includes('major'))
      v = mapVibe(v, (value, dim) => (dim === 'valence' ? value + 0.08 : value));
  }

  return v;
}

/** Fold reported BPM into the 60..180 range the tempo dimension covers; reject nonsense. */
export function normalizeBpm(bpm: number | null | undefined): number | null {
  if (bpm === null || bpm === undefined || !Number.isFinite(bpm) || bpm < 30 || bpm > 300)
    return null;
  let value = bpm;
  while (value < 60) value *= 2;
  while (value > 180) value /= 2;
  return Math.round(value);
}

/** Log-scaled engagement in 0..1. A million plays saturates. */
export function popularityFromEngagement(
  playCount: number | null | undefined,
  favoriteCount = 0,
  repostCount = 0,
): number {
  const plays = Math.max(0, playCount ?? 0);
  const score = plays + Math.max(0, favoriteCount) * 20 + Math.max(0, repostCount) * 30;
  return clamp01(Math.log10(1 + score) / 6);
}
