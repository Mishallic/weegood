import type { VibeVector } from './vibe';

export type Id = string;

/** The local user. There is exactly one until accounts exist (ROADMAP M3). */
export const ME_USER_ID: Id = 'me';

export interface Genre {
  id: Id;
  name: string;
  description: string;
  vibe: VibeVector;
  /** Hue in degrees for UI accents. Chosen per genre so chips and covers are recognisable. */
  hue: number;
}

export interface Artist {
  id: Id;
  name: string;
  genreIds: Id[];
  bio: string;
  vibe: VibeVector;
  followerCount: number;
}

export type TrackSource =
  | { kind: 'catalog' }
  | {
      kind: 'local';
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      importedAt: number;
    };

export interface Track {
  id: Id;
  title: string;
  /** Null for local files whose artist is unknown to the catalog. */
  artistId: Id | null;
  /** Denormalised so local tracks and catalog tracks render the same way. */
  artistName: string;
  genreIds: Id[];
  durationMs: number;
  year: number | null;
  vibe: VibeVector;
  source: TrackSource;
}

export interface Playlist {
  id: Id;
  ownerId: Id;
  name: string;
  description: string;
  trackIds: Id[];
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: Id;
  handle: string;
  displayName: string;
  bio: string;
  /** Hue for the generated avatar. */
  avatarHue: number;
  favoriteGenreIds: Id[];
  vibe: VibeVector;
}

export type FollowKind = 'artist' | 'genre' | 'user';

export interface Follow {
  kind: FollowKind;
  targetId: Id;
  createdAt: number;
}

export function followKey(follow: Pick<Follow, 'kind' | 'targetId'>): string {
  return `${follow.kind}:${follow.targetId}`;
}

/** One playback session of one track. The profile learns from these (ADR 0005). */
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

export interface TasteProfile {
  version: 1;
  vibe: VibeVector;
  /** 0..1 per genre id. Absent means zero. */
  genreWeights: Record<Id, number>;
  /** 0..1 per artist id. Absent means zero. */
  artistAffinity: Record<Id, number>;
  likedTrackIds: Id[];
  dislikedTrackIds: Id[];
  onboarding: OnboardingAnswers | null;
  listenCount: number;
  createdAt: number;
  updatedAt: number;
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
