import type { ReactNode } from 'react';
import type { Stores } from './stores';
import { StoresContext } from './storesContext';

export function StoresProvider({ stores, children }: { stores: Stores; children: ReactNode }) {
  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>;
}
