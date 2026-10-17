import { pluralize, SUPPORTED_AUDIO_EXTENSIONS } from '@weegood/core';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'wouter';
import { useApp, useStores } from '../../app/storesContext';
import { Button } from '../../components/Button';
import { PromptDialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';
import { formatBytes } from '../../lib/format';
import { hueFor } from '../../lib/hue';
import { isDefined } from '../../lib/isDefined';

const ACCEPT = ['audio/*', ...SUPPORTED_AUDIO_EXTENSIONS.map((ext) => `.${ext}`)].join(',');

export function LibraryPage() {
  const { resolveTrack } = useStores();
  const playlists = useApp((state) => state.playlists);
  const localTracks = useApp((state) => state.localTracks);
  const likedIds = useApp((state) => state.profile?.likedTrackIds ?? []);
  const recentListens = useApp((state) => state.recentListens);
  const createPlaylist = useApp((state) => state.createPlaylist);
  const importLocalFiles = useApp((state) => state.importLocalFiles);
  const [, navigate] = useLocation();

  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptKey, setPromptKey] = useState(0);
  const [usage, setUsage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage || typeof storage.estimate !== 'function') return;
    storage
      .estimate()
      .then((estimate) => {
        if (cancelled || estimate.usage === undefined) return;
        const quota = estimate.quota ? ` of ${formatBytes(estimate.quota)}` : '';
        setUsage(`${formatBytes(estimate.usage)}${quota} used`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [localTracks.length]);

  const likedCount = likedIds.length;
  const recentTracks = [...new Set(recentListens.map((event) => event.trackId))]
    .map(resolveTrack)
    .filter(isDefined)
    .slice(0, 10);

  const pickFiles = () => fileInput.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      await importLocalFiles(Array.from(files));
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const openNewPlaylist = () => {
    setPromptKey((k) => k + 1);
    setPromptOpen(true);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>Your library</h1>
          <p className="muted">Playlists, likes and the files you brought.</p>
        </div>
        <div className="row">
          <Button icon="upload" onClick={pickFiles} disabled={importing}>
            {importing ? 'Importing...' : 'Import files'}
          </Button>
          <Button variant="primary" icon="plus" onClick={openNewPlaylist}>
            New playlist
          </Button>
        </div>
      </header>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => void onFiles(event.target.files)}
      />

      <Section title="Playlists">
        {playlists.length === 0 && likedCount === 0 ? (
          <EmptyState
            icon="playlistAdd"
            title="No playlists yet"
            description="Create one here, or use the menu on any track. Playlists can mix demo tracks and your own files."
            action={
              <Button variant="primary" icon="plus" onClick={openNewPlaylist}>
                New playlist
              </Button>
            }
          />
        ) : (
          <div className="grid">
            {likedCount > 0 && (
              <Link
                href="/playlist/liked"
                className="tile"
                style={{ '--hue': 340 } as CSSProperties}
              >
                <span>Liked songs</span>
                <span className="tile__sub">{pluralize(likedCount, 'track')}</span>
              </Link>
            )}
            {playlists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/playlist/${playlist.id}`}
                className="tile"
                style={{ '--hue': hueFor(playlist.id) } as CSSProperties}
              >
                <span className="truncate">{playlist.name}</span>
                <span className="tile__sub">{pluralize(playlist.trackIds.length, 'track')}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Your files"
        subtitle={
          usage ? `Stored on this device · ${usage}` : 'Stored on this device. Nothing is uploaded.'
        }
        actions={
          localTracks.length > 0 ? (
            <Button size="sm" icon="upload" onClick={pickFiles} disabled={importing}>
              Import
            </Button>
          ) : undefined
        }
      >
        {localTracks.length === 0 ? (
          <EmptyState
            icon="upload"
            title="Bring your own music"
            description="MP3, WAV, FLAC, OGG, AAC and M4A files play right here and go in any playlist. They never leave your device."
            action={
              <Button variant="primary" icon="upload" onClick={pickFiles} disabled={importing}>
                Choose files
              </Button>
            }
          />
        ) : (
          <TrackList tracks={localTracks} contextLabel="Your files" />
        )}
      </Section>

      {recentTracks.length > 0 && (
        <Section title="Recently played">
          <TrackList tracks={recentTracks} contextLabel="Recently played" numbered={false} />
        </Section>
      )}

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
