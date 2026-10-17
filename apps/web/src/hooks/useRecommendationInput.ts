import type {
  ListenEvent,
  PeopleSignal,
  RecommendationInput,
  TasteProfileV2,
  Track,
} from '@weegood/core';
import { useMemo } from 'react';
import { useApp, useServices } from '../app/storesContext';
import { buildRecommendationInput } from '../state/recommendationInput';

export interface RecommendationInputOptions {
  /** Candidate pool, usually fetched from the provider for the current page. */
  tracks: readonly Track[];
  peopleSignals?: readonly PeopleSignal[] | undefined;
  /** Use a snapshot instead of the live profile, so a feed does not reshuffle mid-session. */
  profile?: TasteProfileV2 | null | undefined;
  recentListens?: readonly ListenEvent[] | undefined;
}

export function useRecommendationInput(options: RecommendationInputOptions): RecommendationInput {
  const { now } = useServices();
  const liveProfile = useApp((state) => state.profile);
  const follows = useApp((state) => state.follows);
  const liveListens = useApp((state) => state.recentListens);
  const artists = useApp((state) => state.artists);
  const profile = options.profile === undefined ? liveProfile : options.profile;
  const recentListens = options.recentListens ?? liveListens;
  const { tracks, peopleSignals } = options;

  return useMemo(
    () =>
      buildRecommendationInput({
        profile,
        follows,
        recentListens,
        tracks,
        artistsById: new Map(Object.entries(artists)),
        peopleSignals: peopleSignals ?? [],
        now: now(),
      }),
    [profile, follows, recentListens, tracks, artists, peopleSignals, now],
  );
}
