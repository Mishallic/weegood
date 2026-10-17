import { createProfileFromOnboarding, DEMO_CATALOG, type Track } from '@weegood/core';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EngineSnapshot } from '../audio/engine';
import { clearQueryCache } from '../hooks/useQuery';
import type { PlaybackEngineLike } from '../state/playerStore';
import { App } from './App';
import { createTestServices } from './services';
import { createStores } from './stores';
import { StoresProvider } from './StoresProvider';

const noopEngine: PlaybackEngineLike = {
  async load(_track: Track) {},
  async play() {},
  pause() {},
  seek() {},
  setVolume() {},
  subscribe(_listener: (snapshot: EngineSnapshot) => void) {
    return () => undefined;
  },
};

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    clearQueryCache();
  });
  afterEach(cleanup);

  it('sends a new visitor to onboarding', async () => {
    const stores = createStores(createTestServices(), noopEngine);
    void stores.useApp.getState().hydrate();
    render(
      <StoresProvider stores={stores}>
        <App />
      </StoresProvider>,
    );
    await waitFor(() => expect(screen.getByText(/find your vibe/i)).toBeTruthy());
    expect(window.location.pathname).toBe('/onboarding');
  });

  it('shows a home feed built from the provider to a returning listener', async () => {
    const services = createTestServices();
    await services.repos.profile.save(
      createProfileFromOnboarding(
        { genreIds: ['lo-fi', 'jazz'], moodIds: ['chill'], artistIds: [], context: 'focus' },
        { artists: DEMO_CATALOG.artists },
        Date.now(),
      ),
    );
    const stores = createStores(services, noopEngine);
    void stores.useApp.getState().hydrate();
    render(
      <StoresProvider stores={stores}>
        <App />
      </StoresProvider>,
    );
    await waitFor(() => expect(screen.getByText('For you')).toBeTruthy(), { timeout: 4000 });
    expect(screen.getByRole('heading', { name: 'Big right now' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Play / }).length).toBeGreaterThan(0);
  });
});
