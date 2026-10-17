import { createProfileFromOnboarding, DEMO_CATALOG, type Track } from '@weegood/core';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EngineSnapshot } from '../audio/engine';
import type { PlayerControllerLike } from '../state/playerStore';
import { App } from './App';
import { createTestServices } from './services';
import { createStores } from './stores';
import { StoresProvider } from './StoresProvider';

const noopController: PlayerControllerLike = {
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
  });
  afterEach(cleanup);

  it('sends a new visitor to onboarding', async () => {
    const stores = createStores(createTestServices(), noopController);
    void stores.useApp.getState().hydrate();
    render(
      <StoresProvider stores={stores}>
        <App />
      </StoresProvider>,
    );
    await waitFor(() => expect(screen.getByText(/find your vibe/i)).toBeTruthy());
    expect(window.location.pathname).toBe('/onboarding');
  });

  it('shows the home feed to a returning listener', async () => {
    const services = createTestServices();
    await services.repos.profile.save(
      createProfileFromOnboarding(
        { genreIds: ['lofi', 'jazz'], moodIds: ['chill'], artistIds: [], context: 'focus' },
        DEMO_CATALOG,
        Date.now(),
      ),
    );
    const stores = createStores(services, noopController);
    void stores.useApp.getState().hydrate();
    render(
      <StoresProvider stores={stores}>
        <App />
      </StoresProvider>,
    );
    await waitFor(() => expect(screen.getByText('For you')).toBeTruthy());
    expect(screen.getByText('Fresh vibes')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Play / }).length).toBeGreaterThan(0);
  });
});
