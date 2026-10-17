import {
  createEmptyProfile,
  describeVibe,
  genreById,
  NEUTRAL_VIBE,
  pluralize,
  topGenreIds,
  topMoods,
  VIBE_DIMENSIONS,
  type VibeDimension,
} from '@weegood/core';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useApp } from '../../app/storesContext';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { ConfirmDialog } from '../../components/Dialog';
import { formatBytes } from '../../lib/format';
import { isDefined } from '../../lib/isDefined';
import type { ThemePreference } from '../../state/appStore';

const DIMENSION_LABELS: Record<VibeDimension, string> = {
  energy: 'Energy',
  valence: 'Positivity',
  danceability: 'Danceability',
  acousticness: 'Acousticness',
  instrumentalness: 'Instrumental',
  tempo: 'Tempo',
};

export function SettingsPage() {
  const profile = useApp((state) => state.profile);
  const theme = useApp((state) => state.theme);
  const follows = useApp((state) => state.follows);
  const playlists = useApp((state) => state.playlists);
  const localTracks = useApp((state) => state.localTracks);
  const measuredCount = useApp((state) => Object.keys(state.measured).length);
  const cachedCount = useApp((state) => Object.keys(state.tracks).length);
  const setTheme = useApp((state) => state.setTheme);
  const exportData = useApp((state) => state.exportData);
  const importData = useApp((state) => state.importData);
  const resetAll = useApp((state) => state.resetAll);
  const notify = useApp((state) => state.notify);
  const [, navigate] = useLocation();

  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [usage, setUsage] = useState<{ usage: number; quota: number | undefined } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage || typeof storage.estimate !== 'function') return;
    storage
      .estimate()
      .then((estimate) => {
        if (!cancelled && estimate.usage !== undefined)
          setUsage({ usage: estimate.usage, quota: estimate.quota });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [localTracks.length]);

  const vibe = profile?.vibe ?? NEUTRAL_VIBE;
  const words = describeVibe(vibe, 3);
  const topGenres = topGenreIds(profile ?? createEmptyProfile(0), 5)
    .map((id) => genreById(id))
    .filter(isDefined);
  const moods = topMoods(profile ?? createEmptyProfile(0), 4);

  const onExport = async () => {
    const bundle = await exportData();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `weegood-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Export downloaded');
  };

  const onImport = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      await importData(JSON.parse(await file.text()));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Import failed.', 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onReset = async () => {
    await resetAll();
    navigate('/onboarding');
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>Settings</h1>
          <p className="muted">Your taste, your data, your device.</p>
        </div>
      </header>

      <section className="card stack">
        <h2>Your taste profile</h2>
        {profile ? (
          <>
            <p className="muted">
              Right now you lean <strong>{words.join(', ')}</strong>. Every play, like and follow
              nudges this.
            </p>
            <div className="vibe-bars">
              {VIBE_DIMENSIONS.map((dim) => (
                <Fragment key={dim}>
                  <span className="muted small">{DIMENSION_LABELS[dim]}</span>
                  <div className="vibe-bars__track">
                    <div
                      className="vibe-bars__fill"
                      style={{ width: `${Math.round(vibe[dim] * 100)}%` }}
                    />
                  </div>
                  <span className="small faint" style={{ textAlign: 'right' }}>
                    {Math.round(vibe[dim] * 100)}
                  </span>
                </Fragment>
              ))}
            </div>
            {topGenres.length > 0 && (
              <div className="chip-row">
                {topGenres.map((genre) => (
                  <Chip key={genre.id} href={`/genre/${genre.id}`} hue={genre.hue}>
                    {genre.name}
                  </Chip>
                ))}
              </div>
            )}
            {moods.length > 0 && (
              <p className="muted small">Moods you lean toward: {moods.join(', ')}.</p>
            )}
            <div className="row" style={{ gap: 32, flexWrap: 'wrap' }}>
              <Stat label="Listens" value={profile.listenCount} />
              <Stat label="Liked" value={profile.likedTrackIds.length} />
              <Stat label="Following" value={follows.length} />
              <Stat label="Playlists" value={playlists.length} />
              <Stat label="Ranker updates" value={profile.ranker.updates} />
            </div>
            <p className="muted small">
              The ranking model has learned from {pluralize(profile.ranker.updates, 'play')}. It
              weighs vibe match at {profile.ranker.weights.vibe.toFixed(2)}, genre at{' '}
              {profile.ranker.weights.genre.toFixed(2)}, popularity at{' '}
              {profile.ranker.weights.popularity.toFixed(2)}, and it moves a little every time you
              finish or skip something.
            </p>
            <div className="row">
              <Button icon="refresh" onClick={() => navigate('/onboarding')}>
                Redo onboarding
              </Button>
            </div>
          </>
        ) : (
          <p className="muted">No profile yet.</p>
        )}
      </section>

      <section className="card stack">
        <h2>Music source and analysis</h2>
        <p className="muted small">
          Music streams from Audius, an open network where artists publish directly. Nothing is
          cached on disk beyond track metadata, and every track links back to its page on Audius.
        </p>
        <div className="row" style={{ gap: 32, flexWrap: 'wrap' }}>
          <Stat label="Tracks known" value={cachedCount} />
          <Stat label="Analysed on device" value={measuredCount} />
          <Stat label="Imported files" value={localTracks.length} />
        </div>
        <p className="muted small">
          When a track plays for the first time, Weegood measures its loudness, brightness, bass,
          tempo, beat strength and key from the first 45 seconds, right here in your browser, and
          refines the vibe it was recommended on.
        </p>
      </section>

      <section className="card">
        <h2>Appearance</h2>
        <div className="settings-row">
          <div>
            <div>Theme</div>
            <div className="muted small">System follows your operating system.</div>
          </div>
          <select
            className="select"
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemePreference)}
            aria-label="Theme"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          Everything lives in this browser. Export to move it or keep a backup. Audio files are not
          included in exports.
        </p>
        <div className="settings-row">
          <div>
            <div>Export</div>
            <div className="muted small">
              Profile, playlists, follows, referenced tracks and listening history as JSON.
            </div>
          </div>
          <Button icon="download" onClick={() => void onExport()}>
            Export
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <div>Import</div>
            <div className="muted small">
              Replaces your profile, playlists, follows and history. Imported files are kept.
            </div>
          </div>
          <Button icon="upload" onClick={() => fileInput.current?.click()}>
            Import
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void onImport(event.target.files)}
          />
        </div>
        <div className="settings-row">
          <div>
            <div>Storage</div>
            <div className="muted small">
              {usage
                ? `${formatBytes(usage.usage)}${usage.quota ? ` of ${formatBytes(usage.quota)}` : ''} used · `
                : ''}
              {pluralize(localTracks.length, 'imported file')}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Danger zone</h2>
        <div className="settings-row">
          <div>
            <div>Reset Weegood</div>
            <div className="muted small">
              Deletes your profile, playlists, follows, history and imported files from this device.
            </div>
          </div>
          <Button variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
            Reset everything
          </Button>
        </div>
      </section>

      <section className="card stack">
        <h2>About</h2>
        <p className="muted small">
          Weegood 0.2.0, pre-alpha. Real music from Audius, a taste model that lives on your device,
          your own files alongside.
        </p>
        <p className="muted small">
          Shortcuts: Space or K play/pause · J and L seek · N and P next/previous · M mute · /
          search.
        </p>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        message="This cannot be undone. Export first if you want a backup."
        confirmLabel="Reset"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void onReset()}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="muted small">{label}</span>
    </div>
  );
}
