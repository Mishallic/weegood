import {
  createEmptyProfile,
  type Artist,
  type Follow,
  type Id,
  type ListenEvent,
  type PeopleSignal,
  type RecommendationInput,
  type TasteProfileV2,
  type Track,
} from '@weegood/core';

export interface RecommendationSources {
  profile: TasteProfileV2 | null;
  follows: readonly Follow[];
  recentListens: readonly ListenEvent[];
  tracks: readonly Track[];
  artistsById: ReadonlyMap<Id, Artist>;
  peopleSignals?: readonly PeopleSignal[];
  now: number;
}

/** Assemble the engine input from app state and a candidate pool fetched from the provider. */
export function buildRecommendationInput(sources: RecommendationSources): RecommendationInput {
  return {
    profile: sources.profile ?? createEmptyProfile(sources.now),
    tracks: sources.tracks,
    artistsById: sources.artistsById,
    follows: sources.follows,
    recentListens: sources.recentListens,
    peopleSignals: sources.peopleSignals ?? [],
    now: sources.now,
  };
}
