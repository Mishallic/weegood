import type { VibeVector } from './vibe';

export type Id = string;

/** The local user. There is exactly one until accounts exist (ROADMAP M3). */
export const ME_USER_ID: Id = 'me';

/** Where a track or person comes from. `demo` exists only for test fixtures. */
export type ProviderId = 'audius' | 'local' | 'demo';

export interface Genre {
  id: Id;
  name: string;
  description: string;
  vibe: VibeVector;
  /** Hue in degrees for UI accents. */
  hue: number;
  /** Shown in onboarding and the browse grid's first rows. */
  featured: boolean;
  /** The genre's name on each provider, for mapping both ways. */
  providerNames: { audius?: string };
}

/** An artist or curator on a provider. On Audius every account is both. */
export interface Artist {
  id: Id;
  name: string;
  handle: string | null;
  genreIds: Id[];
  bio: string;
  vibe: VibeVector;
  followerCount: number;
  trackCount: number;
  avatarUrl: string | null;
  verified: boolean;
  provider: ProviderId;
  externalId: string;
}

export type TrackSource =
  | {
      kind: 'local';
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      importedAt: number;
    }
  | {
      kind: 'stream';
      provider: ProviderId;
      externalId: string;
      /** Path on the provider's site, for attribution links. */
      permalink: string | null;
    };

export interface Track {
  id: Id;
  title: string;
  /** Null for local files whose artist is unknown. */
  artistId: Id | null;
  /** Denormalised so local tracks and streamed tracks render the same way. */
  artistName: string;
  genreIds: Id[];
  /** Provider mood label, e.g. "Melancholy". */
  mood: string | null;
  tags: string[];
  durationMs: number;
  year: number | null;
  artworkUrl: string | null;
  /** 0..1, log-scaled engagement. 0 for local files. */
  popularity: number;
  playCount: number | null;
  bpm: number | null;
  /** e.g. "A minor". */
  musicalKey: string | null;
  vibe: VibeVector;
  /** Whether `vibe` is a metadata prior or was measured from the audio. */
  vibeSource: 'prior' | 'measured';
  source: TrackSource;
}

export interface Playlist {
  id: Id;
  ownerId: Id;
  ownerName: string | null;
  name: string;
  description: string;
  trackIds: Id[];
  artworkUrl: string | null;
  isPublic: boolean;
  /** Null for the user's own playlists. */
  provider: ProviderId | null;
  externalId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type FollowKind = 'artist' | 'genre';

export interface Follow {
  kind: FollowKind;
  targetId: Id;
  createdAt: number;
}

export function followKey(follow: Pick<Follow, 'kind' | 'targetId'>): string {
  return `${follow.kind}:${follow.targetId}`;
}

/** One playback session of one track. The profile learns from these (ADR 0005, 0011). */
export interface ListenEvent {
  trackId: Id;
  startedAt: number;
  msPlayed: number;
  durationMs: number;
  /** The track reached its natural end. */
  completed: boolean;
  /** The user actively moved on before the end. */
  skipped: boolean;
}

export type ListeningContext = 'focus' | 'commute' | 'workout' | 'party' | 'relax' | 'everything';

export interface OnboardingAnswers {
  genreIds: Id[];
  moodIds: Id[];
  artistIds: Id[];
  context: ListeningContext;
}

export interface Recommendation {
  track: Track;
  /** 0..1, higher is better. Comparable only within one recommendation call. */
  score: number;
  /** Human-readable, most important first. Never empty (ADR 0005). */
  reasons: string[];
}

export interface ArtistRecommendation {
  artist: Artist;
  score: number;
  reasons: string[];
}

/** Audio features measured from a track's own audio, cached per track (ADR 0011). */
export interface MeasuredVibe {
  trackId: Id;
  vibe: VibeVector;
  features: {
    rmsDb: number;
    spectralCentroidHz: number;
    bassRatio: number;
    spectralFlatness: number;
    tempoBpm: number;
    beatStrength: number;
    majorness: number;
    durationSeconds: number;
  };
  measuredAt: number;
}
