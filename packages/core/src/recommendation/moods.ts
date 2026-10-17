import type { ListeningContext } from '../domain/types';
import { vibe, type VibeVector } from '../domain/vibe';

/**
 * Two mood vocabularies live here. `MOODS` are the eight listener-facing groups we ask about in
 * onboarding. `PROVIDER_MOODS` are the labels providers attach to tracks (Audius uses 23 of them);
 * each carries a vibe hint and belongs to one or more groups.
 */
export interface Mood {
  id: string;
  name: string;
  description: string;
  vibe: VibeVector;
  /** Provider mood labels that belong to this group. */
  providerMoods: string[];
}

export const MOODS: readonly Mood[] = [
  {
    id: 'chill',
    name: 'Chill',
    description: 'Soft edges, nothing urgent.',
    vibe: vibe({
      energy: 0.3,
      valence: 0.6,
      danceability: 0.4,
      acousticness: 0.6,
      instrumentalness: 0.55,
      tempo: 0.3,
    }),
    providerMoods: ['Peaceful', 'Easygoing', 'Tender', 'Cool'],
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'Stays out of the way while you work.',
    vibe: vibe({
      energy: 0.35,
      valence: 0.5,
      danceability: 0.3,
      acousticness: 0.5,
      instrumentalness: 0.9,
      tempo: 0.4,
    }),
    providerMoods: ['Sophisticated', 'Peaceful', 'Serious'],
  },
  {
    id: 'hype',
    name: 'Hype',
    description: 'Loud, fast, forward.',
    vibe: vibe({
      energy: 0.9,
      valence: 0.7,
      danceability: 0.85,
      acousticness: 0.1,
      instrumentalness: 0.3,
      tempo: 0.75,
    }),
    providerMoods: ['Energizing', 'Excited', 'Rowdy', 'Fiery'],
  },
  {
    id: 'melancholy',
    name: 'Melancholy',
    description: 'Rain on the window, in a good way.',
    vibe: vibe({
      energy: 0.3,
      valence: 0.2,
      danceability: 0.3,
      acousticness: 0.7,
      instrumentalness: 0.4,
      tempo: 0.3,
    }),
    providerMoods: ['Melancholy', 'Yearning', 'Brooding', 'Sentimental'],
  },
  {
    id: 'feel-good',
    name: 'Feel-good',
    description: 'Sunny, singalong, windows down.',
    vibe: vibe({
      energy: 0.65,
      valence: 0.9,
      danceability: 0.75,
      acousticness: 0.35,
      instrumentalness: 0.2,
      tempo: 0.6,
    }),
    providerMoods: ['Upbeat', 'Empowering', 'Excited', 'Easygoing'],
  },
  {
    id: 'dark',
    name: 'Dark & heavy',
    description: 'Weight, grit and distortion.',
    vibe: vibe({
      energy: 0.85,
      valence: 0.25,
      danceability: 0.5,
      acousticness: 0.05,
      instrumentalness: 0.5,
      tempo: 0.65,
    }),
    providerMoods: ['Aggressive', 'Gritty', 'Brooding', 'Defiant'],
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    description: 'Reverb, haze, slow motion.',
    vibe: vibe({
      energy: 0.4,
      valence: 0.6,
      danceability: 0.45,
      acousticness: 0.3,
      instrumentalness: 0.6,
      tempo: 0.4,
    }),
    providerMoods: ['Sentimental', 'Romantic', 'Peaceful', 'Yearning', 'Tender'],
  },
  {
    id: 'late-night',
    name: 'Late night',
    description: 'City lights, low voices, slow groove.',
    vibe: vibe({
      energy: 0.45,
      valence: 0.4,
      danceability: 0.6,
      acousticness: 0.2,
      instrumentalness: 0.5,
      tempo: 0.45,
    }),
    providerMoods: ['Sensual', 'Cool', 'Sophisticated', 'Romantic', 'Stirring'],
  },
];

/** Provider mood label -> what it says about valence and energy. */
export const PROVIDER_MOODS: Readonly<Record<string, { valence: number; energy: number }>> =
  Object.freeze({
    Peaceful: { valence: 0.6, energy: 0.15 },
    Romantic: { valence: 0.7, energy: 0.35 },
    Sentimental: { valence: 0.45, energy: 0.3 },
    Tender: { valence: 0.6, energy: 0.25 },
    Easygoing: { valence: 0.7, energy: 0.4 },
    Yearning: { valence: 0.35, energy: 0.35 },
    Sophisticated: { valence: 0.55, energy: 0.45 },
    Sensual: { valence: 0.6, energy: 0.45 },
    Cool: { valence: 0.6, energy: 0.5 },
    Gritty: { valence: 0.35, energy: 0.7 },
    Melancholy: { valence: 0.2, energy: 0.3 },
    Serious: { valence: 0.35, energy: 0.5 },
    Brooding: { valence: 0.25, energy: 0.5 },
    Fiery: { valence: 0.5, energy: 0.9 },
    Defiant: { valence: 0.4, energy: 0.8 },
    Aggressive: { valence: 0.2, energy: 0.95 },
    Rowdy: { valence: 0.65, energy: 0.9 },
    Excited: { valence: 0.85, energy: 0.85 },
    Energizing: { valence: 0.75, energy: 0.85 },
    Empowering: { valence: 0.8, energy: 0.75 },
    Stirring: { valence: 0.6, energy: 0.65 },
    Upbeat: { valence: 0.9, energy: 0.7 },
  });

export function providerMoodHint(mood: string | null | undefined): Partial<VibeVector> | null {
  if (!mood) return null;
  const hint = PROVIDER_MOODS[mood];
  return hint ? { valence: hint.valence, energy: hint.energy } : null;
}

export function findMood(id: string): Mood | undefined {
  return MOODS.find((mood) => mood.id === id);
}

export interface ListeningContextOption {
  id: ListeningContext;
  name: string;
  description: string;
  /** Dimensions that this context pulls toward, applied as a gentle nudge at onboarding. */
  vibeNudge: Partial<VibeVector>;
}

export const LISTENING_CONTEXTS: readonly ListeningContextOption[] = [
  {
    id: 'focus',
    name: 'Working or studying',
    description: 'Music that keeps me company without stealing attention.',
    vibeNudge: { instrumentalness: 0.85, energy: 0.35 },
  },
  {
    id: 'commute',
    name: 'Commuting',
    description: 'Headphones on, world off.',
    vibeNudge: { energy: 0.55, danceability: 0.55 },
  },
  {
    id: 'workout',
    name: 'Working out',
    description: 'Tempo and energy, please.',
    vibeNudge: { energy: 0.9, tempo: 0.8, danceability: 0.75 },
  },
  {
    id: 'party',
    name: 'With friends',
    description: 'Something everyone can move to.',
    vibeNudge: { danceability: 0.85, valence: 0.75, energy: 0.75 },
  },
  {
    id: 'relax',
    name: 'Winding down',
    description: 'Evenings, baths, slow mornings.',
    vibeNudge: { energy: 0.25, tempo: 0.3, acousticness: 0.65 },
  },
  {
    id: 'everything',
    name: 'A bit of everything',
    description: 'Depends on the day.',
    vibeNudge: {},
  },
];
