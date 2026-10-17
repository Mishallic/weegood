import { createContext, useContext } from 'react';
import type { AppState } from '../state/appStore';
import type { PlayerState } from '../state/playerStore';
import type { Services } from './services';
import type { Stores } from './stores';

export const StoresContext = createContext<Stores | null>(null);

export function useStores(): Stores {
  const stores = useContext(StoresContext);
  if (!stores) throw new Error('useStores must be used inside StoresProvider');
  return stores;
}

export function useServices(): Services {
  return useStores().services;
}

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStores().useApp(selector);
}

export function usePlayer<T>(selector: (state: PlayerState) => T): T {
  return useStores().usePlayer(selector);
}
