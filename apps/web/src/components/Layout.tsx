import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useApp } from '../app/storesContext';
import { SEARCH_INPUT_ID } from '../hooks/useKeyboardShortcuts';
import { cx } from '../lib/cx';
import { Button } from './Button';
import { PromptDialog } from './Dialog';
import { Icon, type IconName } from './Icon';
import { PlayerBar } from './PlayerBar';

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/browse', label: 'Browse', icon: 'explore' },
  { href: '/library', label: 'Library', icon: 'library' },
  { href: '/people', label: 'People', icon: 'people' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

function isActive(location: string, href: string): boolean {
  if (href === '/') return location === '/';
  return location === href || location.startsWith(`${href}/`);
}

function NavLinks({ location, className }: { location: string; className: string }) {
  return (
    <nav className={className} aria-label="Main">
      {NAV.map((item) => {
        const active = isActive(location, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx('nav__link', active && 'nav__link--active')}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Weegood home">
      <img
        className="brand__mark"
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        alt=""
        width={28}
        height={28}
      />
      {!compact && <span>Weegood</span>}
    </Link>
  );
}

/** The URL is the single source of truth for the query, so back and forward just work. */
function SearchBox() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const query = location === '/search' ? (new URLSearchParams(search).get('q') ?? '') : '';

  const onChange = (next: string) => {
    const target = next ? `/search?q=${encodeURIComponent(next)}` : '/search';
    navigate(target, { replace: location === '/search' });
  };

  return (
    <label className="search">
      <Icon name="search" size={18} />
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        placeholder="Search tracks, artists, genres, people"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Search"
        autoComplete="off"
      />
    </label>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const playlists = useApp((state) => state.playlists);
  const createPlaylist = useApp((state) => state.createPlaylist);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptKey, setPromptKey] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const main = mainRef.current;
    if (main && typeof main.scrollTo === 'function') main.scrollTo({ top: 0 });
  }, [location]);

  const openNewPlaylist = () => {
    setPromptKey((k) => k + 1);
    setPromptOpen(true);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <NavLinks location={location} className="nav" />
        <div className="sidebar__section">
          <div className="row">
            <span className="sidebar__label" style={{ marginBottom: 0 }}>
              Your playlists
            </span>
            <span className="spacer" />
            <Button
              variant="ghost"
              size="sm"
              icon="plus"
              iconOnly
              label="New playlist"
              onClick={openNewPlaylist}
            />
          </div>
          {playlists.length === 0 && (
            <span className="faint small" style={{ padding: '0 12px' }}>
              No playlists yet.
            </span>
          )}
          {playlists.slice(0, 12).map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              className="sidebar__playlist truncate"
            >
              {playlist.name}
            </Link>
          ))}
        </div>
      </aside>

      <main
        className="main"
        ref={mainRef}
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
      >
        <div className={cx('topbar', scrolled && 'topbar--scrolled')}>
          <Brand compact />
          <SearchBox />
        </div>
        {children}
      </main>

      <PlayerBar />

      <NavLinks location={location} className="bottom-nav" />

      <PromptDialog
        key={promptKey}
        open={promptOpen}
        title="New playlist"
        label="Name"
        placeholder="Late night drive"
        confirmLabel="Create"
        onClose={() => setPromptOpen(false)}
        onConfirm={(name) => {
          void createPlaylist(name).then((playlist) => {
            if (playlist) navigate(`/playlist/${playlist.id}`);
          });
        }}
      />
    </div>
  );
}
