import type { Id, Track } from '@weegood/core';
import { createAppStore, type AppStore } from '../state/appStore';
import {
  createPlayerStore,
  type PlayerControllerLike,
  type PlayerStore,
} from '../state/playerStore';
import type { Services } from './services';

export interface Stores {
  services: Services;
  useApp: AppStore;
  usePlayer: PlayerStore;
  /** Catalog tracks and imported local tracks, by id. */
  resolveTrack: (id: Id) => Track | undefined;
}

export function createStores(services: Services, controller: PlayerControllerLike): Stores {
  const useApp = createAppStore(services);

  const resolveTrack = (id: Id): Track | undefined =>
    services.index.tracksById.get(id) ??
    useApp.getState().localTracks.find((track) => track.id === id);

  const usePlayer = createPlayerStore({
    controller,
    resolveTrack,
    loadBlob: async (track) => (await services.repos.audioBlobs.get(track.id)) ?? null,
    onListen: (track, event) => {
      void useApp.getState().recordListen(track, event);
    },
    now: services.now,
  });

  return { services, useApp, usePlayer, resolveTrack };
}
