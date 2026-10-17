import type {
  CatalogIndex,
  Follow,
  ListenEvent,
  Playlist,
  RecommendationInput,
  TasteProfile,
  Track,
  User,
} from '@weegood/core';
import { createEmptyProfile } from '@weegood/core';

export interface RecommendationSources {
  profile: TasteProfile | null;
  follows: readonly Follow[];
  recentListens: readonly ListenEvent[];
  tracks: readonly Track[];
  index: CatalogIndex;
  now: number;
}

/**
 * Assemble the engine input from app state. Public playlists of followed demo people are
 * included so "From people you follow" works before a real social graph exists.
 */
export function buildRecommendationInput(sources: RecommendationSources): RecommendationInput {
  const peoplePlaylists: Array<{ user: User; playlist: Playlist }> = [];
  for (const follow of sources.follows) {
    if (follow.kind !== 'user') continue;
    const user = sources.index.usersById.get(follow.targetId);
    if (!user) continue;
    for (const playlist of sources.index.playlistsByOwnerId.get(user.id) ?? []) {
      if (playlist.isPublic) peoplePlaylists.push({ user, playlist });
    }
  }
  return {
    profile: sources.profile ?? createEmptyProfile(sources.now),
    tracks: sources.tracks,
    artistsById: sources.index.artistsById,
    genresById: sources.index.genresById,
    follows: sources.follows,
    recentListens: sources.recentListens,
    peoplePlaylists,
    now: sources.now,
  };
}
