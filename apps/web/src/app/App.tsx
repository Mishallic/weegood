import { useEffect } from 'react';
import { Redirect, Route, Switch } from 'wouter';
import { Layout } from '../components/Layout';
import { NotFound } from '../components/NotFound';
import { Toasts } from '../components/Toasts';
import { ArtistPage } from '../features/browse/ArtistPage';
import { BrowsePage } from '../features/browse/BrowsePage';
import { GenrePage } from '../features/browse/GenrePage';
import { HomePage } from '../features/home/HomePage';
import { LibraryPage } from '../features/library/LibraryPage';
import { PlaylistPage } from '../features/library/PlaylistPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { PeoplePage } from '../features/people/PeoplePage';
import { UserPage } from '../features/people/UserPage';
import { SearchPage } from '../features/search/SearchPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useMediaSession } from '../hooks/useMediaSession';
import { applyTheme } from '../state/appStore';
import { useApp } from './storesContext';

export function App() {
  const hydrated = useApp((state) => state.hydrated);
  const hasProfile = useApp((state) => state.profile !== null);
  const theme = useApp((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useMediaSession();
  useKeyboardShortcuts();

  if (!hydrated) return <div className="loading">Loading your vibe...</div>;

  return (
    <>
      <Switch>
        <Route path="/onboarding" component={OnboardingPage} />
        <Route>{hasProfile ? <Shell /> : <Redirect to="/onboarding" replace />}</Route>
      </Switch>
      <Toasts />
    </>
  );
}

function Shell() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/browse" component={BrowsePage} />
        <Route path="/genre/:id" component={GenrePage} />
        <Route path="/artist/:id" component={ArtistPage} />
        <Route path="/library" component={LibraryPage} />
        <Route path="/playlist/:id" component={PlaylistPage} />
        <Route path="/people" component={PeoplePage} />
        <Route path="/u/:handle" component={UserPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </Layout>
  );
}
