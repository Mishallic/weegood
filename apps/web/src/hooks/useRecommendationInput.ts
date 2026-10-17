import type { ListenEvent, RecommendationInput, TasteProfile } from '@weegood/core';
import { useMemo } from 'react';
import { useApp, useServices } from '../app/storesContext';
import { buildRecommendationInput } from '../state/recommendationInput';

export interface RecommendationInputOverrides {
  /** Use a snapshot instead of the live profile, so a feed does not reshuffle mid-session. */
  profile?: TasteProfile | null;
  recentListens?: readonly ListenEvent[];
}

/** Engine input over the demo catalog. Local tracks are library items, not candidates. */
export function useRecommendationInput(
  overrides: RecommendationInputOverrides = {},
): RecommendationInput {
  const { catalog, index, now } = useServices();
  const liveProfile = useApp((state) => state.profile);
  const follows = useApp((state) => state.follows);
  const liveListens = useApp((state) => state.recentListens);
  const profile = overrides.profile === undefined ? liveProfile : overrides.profile;
  const recentListens = overrides.recentListens ?? liveListens;

  return useMemo(
    () =>
      buildRecommendationInput({
        profile,
        follows,
        recentListens,
        tracks: catalog.tracks,
        index,
        now: now(),
      }),
    [profile, follows, recentListens, catalog, index, now],
  );
}
