import { featuresForTrack, type Id, type Track } from '@weegood/core';
import { StreamEngine } from '../audio/streamEngine';
import { createAppStore, type AppStore } from '../state/appStore';
import { createPlayerStore, type PlaybackEngineLike, type PlayerStore } from '../state/playerStore';
import { buildRecommendationInput } from '../state/recommendationInput';
import type { Services } from './services';

export interface Stores {
  services: Services;
  useApp: AppStore;
  usePlayer: PlayerStore;
  /** Streamed tracks from the cache and imported local tracks, by id. */
  resolveTrack: (id: Id) => Track | undefined;
}

export function createBrowserEngine(services: Services): StreamEngine {
  return new StreamEngine({ streamUrlFor: (track) => services.music.streamUrl(track) });
}

export function createStores(services: Services, engine: PlaybackEngineLike): Stores {
  const useApp = createAppStore(services);
  const resolveTrack = (id: Id): Track | undefined => useApp.getState().getTrack(id);

  const usePlayer = createPlayerStore({
    engine,
    resolveTrack,
    loadBlob: async (track) => (await services.repos.audioBlobs.get(track.id)) ?? null,
    now: services.now,

    onListen: (track, event) => {
      // Score the track the way the feed would have, so the ranker learns from the outcome.
      const state = useApp.getState();
      const features = featuresForTrack(
        track,
        buildRecommendationInput({
          profile: state.profile,
          follows: state.follows,
          recentListens: state.recentListens,
          tracks: [],
          artistsById: new Map(Object.entries(state.artists)),
          now: services.now(),
        }),
      );
      void state.recordListen(track, event, features);
    },

    onTrackStart: (track, next) => {
      const state = useApp.getState();
      state.rememberTracks([track], true);
      if (next) engine.prefetch?.(next);
      if (
        services.analyzer &&
        track.source.kind === 'stream' &&
        track.vibeSource !== 'measured' &&
        !state.measured[track.id]
      ) {
        const url = services.music.streamUrl(track);
        if (url) {
          void services.analyzer.analyze(track, url).then((measured) => {
            if (measured) void useApp.getState().recordMeasuredVibe(measured);
          });
        }
      }
    },
  });

  return { services, useApp, usePlayer, resolveTrack };
}
