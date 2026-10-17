import type { ListeningContext } from '../domain/types';
import { vibe, type VibeVector } from '../domain/vibe';

/** A mood is a named point in vibe space that people recognise. Onboarding and steering use them. */
export interface Mood {
  id: string;
  name: string;
  description: string;
  vibe: VibeVector;
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
  },
];

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

export function findMood(id: string): Mood | undefined {
  return MOODS.find((mood) => mood.id === id);
}
