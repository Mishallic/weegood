import type {
  Artist,
  ArtistRecommendation,
  Follow,
  Genre,
  Id,
  ListenEvent,
  Playlist,
  Recommendation,
  TasteProfile,
  Track,
  User,
} from '../domain/types';
import { describeVibe, vibeSimilarity } from '../domain/vibe';
import { followedIds } from '../social/follow';

/** Everything the engine needs to know about the listener and the world. All read-only. */
export interface RecommendationInput {
  profile: TasteProfile;
  /** Candidate pool. The caller decides what is in it (whole catalog, one genre, a friend's list). */
  tracks: readonly Track[];
  artistsById: ReadonlyMap<Id, Artist>;
  genresById: ReadonlyMap<Id, Genre>;
  follows: readonly Follow[];
  recentListens: readonly ListenEvent[];
  /** Public playlists of people the listener follows, with their owners. */
  peoplePlaylists?: ReadonlyArray<{ user: User; playlist: Playlist }>;
  now: number;
}

export interface RecommendOptions {
  /** Default 10. */
  limit?: number;
  /** 0 = pure relevance, 1 = pure variety. Default 0.3. */
  diversity?: number;
  /** Default 2. */
  maxPerArtist?: number;
  excludeTrackIds?: ReadonlySet<Id>;
  /** Drop anything the listener has played before. For "fresh" rows. */
  excludeListened?: boolean;
  /** Rank by closeness to this track instead of to the profile. For "more like this". */
  seed?: Track;
}

/** Term weights. Sum of positive profile terms is 1 so scores stay in 0..1 before boosts. */
export const WEIGHTS = Object.freeze({
  vibe: 0.5,
  genre: 0.2,
  artist: 0.15,
  /** Boosts, added on top (score is clamped to 1 afterwards). */
  followArtist: 0.1,
  followGenre: 0.06,
  people: 0.1,
  /** Seed mode: how much the seed's vibe counts versus the listener's profile. */
  seedVibe: 0.65,
  seedGenre: 0.15,
  seedProfile: 0.2,
  /** Penalties. */
  playedToday: 0.15,
  playedThisWeek: 0.05,
  skippedRecently: 0.2,
});

const DAY_MS = 86_400_000;
const DIVERSIFY_POOL = 200;

export function recommendTracks(
  input: RecommendationInput,
  options: RecommendOptions = {},
): Recommendation[] {
  const limit = options.limit ?? 10;
  if (limit <= 0) return [];
  const context = prepare(input, options);

  const scored: Recommendation[] = [];
  for (const track of input.tracks) {
    const result = scoreTrack(track, input, options, context);
    if (result) scored.push(result);
  }

  scored.sort(byScoreThenId);
  return diversify(scored.slice(0, DIVERSIFY_POOL), {
    limit,
    diversity: options.diversity ?? 0.3,
    maxPerArtist: options.maxPerArtist ?? 2,
  });
}

/** "More like this": tracks closest to `seed`, lightly personalised. */
export function similarTracks(
  seed: Track,
  input: RecommendationInput,
  limit = 8,
): Recommendation[] {
  const exclude = new Set<Id>([seed.id]);
  return recommendTracks(input, { seed, limit, diversity: 0.15, excludeTrackIds: exclude });
}

/** Artists worth following, excluding ones already followed. */
export function recommendArtists(
  input: RecommendationInput,
  artists: readonly Artist[],
  limit = 6,
): ArtistRecommendation[] {
  const followedArtists = followedIds(input.follows, 'artist');
  const followedGenres = followedIds(input.follows, 'genre');
  const profile = input.profile;
  const profileWords = describeVibe(profile.vibe);

  const scored: ArtistRecommendation[] = [];
  for (const artist of artists) {
    if (followedArtists.has(artist.id)) continue;
    const vibeMatch = vibeSimilarity(profile.vibe, artist.vibe);
    const genreAffinity = maxWeight(profile.genreWeights, artist.genreIds);
    const genreFollowed = artist.genreIds.some((id) => followedGenres.has(id));
    const affinity = profile.artistAffinity[artist.id] ?? 0;
    const score = clamp(
      0.55 * vibeMatch + 0.25 * genreAffinity + 0.1 * affinity + (genreFollowed ? 0.1 : 0),
    );

    const reasons: Array<[number, string]> = [];
    if (affinity >= 0.5) reasons.push([3, `You already like ${artist.name}`]);
    if (genreFollowed) {
      const genre = artist.genreIds
        .map((id) => input.genresById.get(id))
        .find((g) => g && followedGenres.has(g.id));
      if (genre) reasons.push([2.5, `Because you follow ${genre.name}`]);
    }
    if (genreAffinity >= 0.6) {
      const genre = strongestGenre(profile, artist.genreIds, input.genresById);
      if (genre) reasons.push([2, `You're into ${genre.name}`]);
    }
    if (vibeMatch >= 0.75) reasons.push([1, `Shares your ${profileWords.join(', ')} vibe`]);
    scored.push({ artist, score, reasons: finalizeReasons(reasons, artist.vibe) });
  }

  scored.sort((a, b) => b.score - a.score || a.artist.id.localeCompare(b.artist.id));
  return scored.slice(0, limit);
}

/* ---------------------------------------------------------------------------------------------
 * Internals
 * ------------------------------------------------------------------------------------------ */

interface ListenMemory {
  lastAt: number;
  skippedLast: boolean;
}

interface ScoringContext {
  followedArtists: ReadonlySet<Id>;
  followedGenres: ReadonlySet<Id>;
  listens: ReadonlyMap<Id, ListenMemory>;
  people: ReadonlyMap<Id, { user: User; playlist: Playlist }>;
  liked: ReadonlySet<Id>;
  disliked: ReadonlySet<Id>;
  profileWords: string[];
}

function prepare(input: RecommendationInput, options: RecommendOptions): ScoringContext {
  const listens = new Map<Id, ListenMemory>();
  for (const event of input.recentListens) {
    const existing = listens.get(event.trackId);
    if (!existing || event.startedAt > existing.lastAt) {
      listens.set(event.trackId, { lastAt: event.startedAt, skippedLast: event.skipped });
    }
  }

  const people = new Map<Id, { user: User; playlist: Playlist }>();
  for (const hit of input.peoplePlaylists ?? []) {
    for (const trackId of hit.playlist.trackIds) {
      if (!people.has(trackId)) people.set(trackId, hit);
    }
  }

  return {
    followedArtists: followedIds(input.follows, 'artist'),
    followedGenres: followedIds(input.follows, 'genre'),
    listens,
    people,
    liked: new Set(input.profile.likedTrackIds),
    disliked: new Set(input.profile.dislikedTrackIds),
    profileWords: describeVibe(options.seed ? options.seed.vibe : input.profile.vibe),
  };
}

function scoreTrack(
  track: Track,
  input: RecommendationInput,
  options: RecommendOptions,
  ctx: ScoringContext,
): Recommendation | null {
  if (options.excludeTrackIds?.has(track.id)) return null;
  if (ctx.disliked.has(track.id)) return null;
  if (ctx.liked.has(track.id)) return null;
  const memory = ctx.listens.get(track.id);
  if (options.excludeListened && memory) return null;

  const profile = input.profile;
  const vibeMatch = vibeSimilarity(profile.vibe, track.vibe);
  const genreAffinity = maxWeight(profile.genreWeights, track.genreIds);
  const artistAffinity = track.artistId ? (profile.artistAffinity[track.artistId] ?? 0) : 0;

  let score =
    WEIGHTS.vibe * vibeMatch + WEIGHTS.genre * genreAffinity + WEIGHTS.artist * artistAffinity;

  const reasons: Array<[number, string]> = [];

  if (options.seed) {
    const seedSim = vibeSimilarity(options.seed.vibe, track.vibe);
    const sharesGenre = track.genreIds.some((id) => options.seed?.genreIds.includes(id)) ? 1 : 0;
    score =
      WEIGHTS.seedVibe * seedSim + WEIGHTS.seedGenre * sharesGenre + WEIGHTS.seedProfile * score;
    reasons.push([3, `Similar to "${options.seed.title}"`]);
  }

  const artist = track.artistId ? input.artistsById.get(track.artistId) : undefined;
  if (artist && ctx.followedArtists.has(artist.id)) {
    score += WEIGHTS.followArtist;
    reasons.push([2.5, `Because you follow ${artist.name}`]);
  }

  const peopleHit = ctx.people.get(track.id);
  if (peopleHit) {
    score += WEIGHTS.people;
    reasons.push([2.4, `On ${peopleHit.user.displayName}'s playlist "${peopleHit.playlist.name}"`]);
  }

  if (artist && artistAffinity >= 0.5) reasons.push([2, `You like ${artist.name}`]);

  const followedGenre = track.genreIds
    .map((id) => input.genresById.get(id))
    .find((genre) => genre && ctx.followedGenres.has(genre.id));
  if (followedGenre) {
    score += WEIGHTS.followGenre;
    reasons.push([1.8, `Because you follow ${followedGenre.name}`]);
  }

  if (genreAffinity >= 0.6) {
    const genre = strongestGenre(profile, track.genreIds, input.genresById);
    if (genre) reasons.push([1.5, `You're into ${genre.name}`]);
  }

  if (!options.seed && vibeMatch >= 0.75) {
    reasons.push([1, `Matches your ${ctx.profileWords.join(', ')} vibe`]);
  }

  if (memory) {
    const age = input.now - memory.lastAt;
    if (age < DAY_MS) score -= WEIGHTS.playedToday;
    else if (age < 7 * DAY_MS) score -= WEIGHTS.playedThisWeek;
    if (memory.skippedLast && age < 7 * DAY_MS) score -= WEIGHTS.skippedRecently;
  }

  return { track, score: clamp(score), reasons: finalizeReasons(reasons, track.vibe) };
}

interface DiversifyOptions {
  limit: number;
  diversity: number;
  maxPerArtist: number;
}

/**
 * Maximal marginal relevance: each pick balances its own score against its similarity to what is
 * already picked, so a row is not twelve near-identical tracks. Also caps tracks per artist.
 */
function diversify(scored: Recommendation[], opts: DiversifyOptions): Recommendation[] {
  const diversity = clamp(opts.diversity);
  const pool = [...scored];
  const selected: Recommendation[] = [];
  const perArtist = new Map<string, number>();

  while (selected.length < opts.limit && pool.length > 0) {
    let bestIndex = -1;
    let bestValue = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i] as Recommendation;
      const artistKey = candidate.track.artistId ?? `name:${candidate.track.artistName}`;
      if ((perArtist.get(artistKey) ?? 0) >= opts.maxPerArtist) continue;

      let maxSimilarity = 0;
      for (const chosen of selected) {
        const s = vibeSimilarity(chosen.track.vibe, candidate.track.vibe);
        if (s > maxSimilarity) maxSimilarity = s;
      }
      const value = (1 - diversity) * candidate.score - diversity * maxSimilarity;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) break;
    const [chosen] = pool.splice(bestIndex, 1) as [Recommendation];
    selected.push(chosen);
    const key = chosen.track.artistId ?? `name:${chosen.track.artistName}`;
    perArtist.set(key, (perArtist.get(key) ?? 0) + 1);
  }

  return selected;
}

function finalizeReasons(reasons: Array<[number, string]>, fallbackVibe: Track['vibe']): string[] {
  const unique = new Set<string>();
  const ordered = [...reasons].sort((a, b) => b[0] - a[0]).map(([, text]) => text);
  for (const text of ordered) unique.add(text);
  const out = [...unique].slice(0, 2);
  if (out.length === 0) {
    const [word] = describeVibe(fallbackVibe, 1);
    out.push(`A ${word ?? 'balanced'} pick to explore`);
  }
  return out;
}

function strongestGenre(
  profile: TasteProfile,
  genreIds: readonly Id[],
  genresById: ReadonlyMap<Id, Genre>,
): Genre | undefined {
  let best: Genre | undefined;
  let bestWeight = -1;
  for (const id of genreIds) {
    const weight = profile.genreWeights[id] ?? 0;
    const genre = genresById.get(id);
    if (genre && weight > bestWeight) {
      best = genre;
      bestWeight = weight;
    }
  }
  return best;
}

function maxWeight(weights: Record<Id, number>, ids: readonly Id[]): number {
  let max = 0;
  for (const id of ids) {
    const w = weights[id] ?? 0;
    if (w > max) max = w;
  }
  return max;
}

function clamp(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function byScoreThenId(a: Recommendation, b: Recommendation): number {
  return b.score - a.score || a.track.id.localeCompare(b.track.id);
}
