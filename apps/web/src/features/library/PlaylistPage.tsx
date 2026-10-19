import {
  centroid,
  formatDuration,
  ME_USER_ID,
  NEUTRAL_VIBE,
  pluralize,
  recommendTracks,
  type Playlist,
  type Track,
} from '@weegood/core';
import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useApp, usePlayer, useServices } from '../../app/storesContext';
import { AsyncState } from '../../components/AsyncState';
import { Button } from '../../components/Button';
import { Cover } from '../../components/Cover';
import { ConfirmDialog, PromptDialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { NotFound } from '../../components/NotFound';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';
import { VibeAura } from '../../components/VibeAura';
import { useQuery } from '../../hooks/useQuery';
import { useRecommendationInput } from '../../hooks/useRecommendationInput';
import { hueFor, trackHue } from '../../lib/hue';

const LIKED_ID = 'liked';

export function PlaylistPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? '');
  const { music } = useServices();
  const [, navigate] = useLocation();

  const mine = useApp((state) => state.playlists.find((playlist) => playlist.id === id));
  const likedIds = useApp((state) => state.profile?.likedTrackIds ?? []);
  const cachedTracks = useApp((state) => state.tracks);
  const localTracks = useApp((state) => state.localTracks);
  const ensureTracks = useApp((state) => state.ensureTracks);
  const rememberTracks = useApp((state) => state.rememberTracks);
  const renamePlaylist = useApp((state) => state.renamePlaylist);
  const deletePlaylist = useApp((state) => state.deletePlaylist);
  const moveInPlaylist = useApp((state) => state.moveInPlaylist);
  const addToPlaylist = useApp((state) => state.addToPlaylist);
  const createPlaylist = useApp((state) => state.createPlaylist);
  const notify = useApp((state) => state.notify);
  const playQueue = usePlayer((state) => state.playQueue);
  const shuffle = usePlayer((state) => state.shuffle);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameKey, setRenameKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isLiked = id === LIKED_ID;
  const isRemote = !isLiked && !mine && id.includes(':');

  const remoteFetcher = useCallback(() => music.playlist(id), [music, id]);
  const remote = useQuery(isRemote ? `playlist:${id}` : null, remoteFetcher, {
    ttlMs: 15 * 60_000,
  });

  const playlist: Playlist | undefined = useMemo(() => {
    if (isLiked) {
      return {
        id: LIKED_ID,
        ownerId: ME_USER_ID,
        ownerName: null,
        name: 'Liked songs',
        description: 'Everything you hearted, newest last.',
        trackIds: likedIds,
        artworkUrl: null,
        isPublic: false,
        provider: null,
        externalId: null,
        createdAt: 0,
        updatedAt: 0,
      };
    }
    return mine ?? remote.data?.playlist ?? undefined;
  }, [isLiked, likedIds, mine, remote.data]);

  const editable = Boolean(mine);
  const idsKey = playlist?.trackIds.join(',') ?? '';

  // Own and liked playlists reference tracks that may not be in memory yet; fetch what is missing.
  const resolveFetcher = useCallback(
    () => ensureTracks(playlist?.trackIds ?? []),
    [ensureTracks, playlist?.trackIds],
  );
  const resolved = useQuery<Track[]>(
    !isRemote && playlist ? `playlist-tracks:${id}:${idsKey}` : null,
    resolveFetcher,
    { ttlMs: 60_000 },
  );

  const tracks = useMemo(() => {
    if (isRemote) return remote.data?.tracks ?? [];
    if (!playlist) return [];
    const localById = new Map(localTracks.map((track) => [track.id, track]));
    return playlist.trackIds
      .map((trackId) => cachedTracks[trackId] ?? localById.get(trackId))
      .filter((track): track is Track => track !== undefined);
  }, [isRemote, remote.data, playlist, cachedTracks, localTracks]);

  const playlistVibe = useMemo(
    () =>
      tracks.length > 0 ? centroid(tracks.map((track) => ({ vibe: track.vibe }))) : NEUTRAL_VIBE,
    [tracks],
  );

  const dominantGenre = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of tracks)
      for (const genreId of track.genreIds) counts.set(genreId, (counts.get(genreId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [tracks]);
  const poolFetcher = useCallback(async () => {
    const pool = await music.trending({ genreId: dominantGenre, window: 'month', limit: 60 });
    rememberTracks(pool);
    return pool;
  }, [music, dominantGenre, rememberTracks]);
  const pool = useQuery<Track[]>(
    editable && tracks.length > 0 ? `suggest-pool:${dominantGenre ?? 'all'}` : null,
    poolFetcher,
  );
  const input = useRecommendationInput({ tracks: pool.data ?? [] });

  const suggestions = useMemo(() => {
    const first = tracks[0];
    if (!playlist || !editable || !first || !pool.data?.length) return [];
    const seed: Track = {
      ...first,
      id: `seed:${playlist.id}`,
      title: playlist.name,
      genreIds: [...new Set(tracks.flatMap((track) => track.genreIds))],
      vibe: playlistVibe,
    };
    return recommendTracks(input, {
      seed,
      limit: 6,
      diversity: 0.2,
      excludeTrackIds: new Set(playlist.trackIds),
    });
  }, [playlist, editable, tracks, pool.data, input, playlistVibe]);

  if (!playlist) {
    if (isRemote && (remote.loading || remote.error)) {
      return (
        <div className="page">
          <AsyncState
            loading={remote.loading}
            error={remote.error}
            empty
            onRetry={remote.refresh}
            loadingMessage="Loading playlist..."
          >
            {null}
          </AsyncState>
        </div>
      );
    }
    return <NotFound what="playlist" />;
  }

  const ids = tracks.map((track) => track.id);
  const durationMs = tracks.reduce((sum, track) => sum + track.durationMs, 0);
  const hue = isLiked ? 340 : tracks[0] ? trackHue(tracks[0]) : hueFor(playlist.id);
  const artwork = playlist.artworkUrl ?? tracks[0]?.artworkUrl ?? null;

  const play = (startIndex = 0) => {
    rememberTracks(tracks);
    void playQueue(ids, startIndex, playlist.name);
  };
  const shufflePlay = () => {
    if (!shuffle) toggleShuffle();
    play(0);
  };
  const saveCopy = async () => {
    rememberTracks(tracks, true);
    const copy = await createPlaylist(playlist.name, ids);
    if (copy) {
      notify(`Saved ${copy.name} to your library`);
      navigate(`/playlist/${encodeURIComponent(copy.id)}`);
    }
  };

  const loadingTracks =
    !isRemote && resolved.loading && tracks.length === 0 && playlist.trackIds.length > 0;

  return (
    <div className="page">
      <section className="hero">
        <VibeAura vibe={playlistVibe} />
        <Cover title={playlist.name} hue={hue} src={artwork} vibe={playlistVibe} size={168} />
        <div className="hero__body">
          <span className="hero__kicker">
            Playlist ·{' '}
            {editable || isLiked ? (
              'by you'
            ) : playlist.ownerName ? (
              <Link href={`/artist/${encodeURIComponent(playlist.ownerId)}`}>
                by {playlist.ownerName}
              </Link>
            ) : (
              'Audius'
            )}
          </span>
          <h1 className="hero__title">{playlist.name}</h1>
          {playlist.description && <p className="muted">{playlist.description}</p>}
          <p className="small faint">
            {pluralize(tracks.length, 'track')} · {formatDuration(durationMs)}
          </p>
          <div className="hero__actions">
            <Button
              variant="primary"
              icon="play"
              onClick={() => play(0)}
              disabled={tracks.length === 0}
            >
              Play
            </Button>
            <Button icon="shuffle" onClick={shufflePlay} disabled={tracks.length < 2}>
              Shuffle
            </Button>
            {editable && (
              <>
                <Button
                  variant="ghost"
                  icon="edit"
                  onClick={() => {
                    setRenameKey((k) => k + 1);
                    setRenameOpen(true);
                  }}
                >
                  Rename
                </Button>
                <Button variant="ghost" icon="trash" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </>
            )}
            {!editable && !isLiked && (
              <Button variant="outline" icon="playlistAdd" onClick={() => void saveCopy()}>
                Save to library
              </Button>
            )}
          </div>
        </div>
      </section>

      {loadingTracks ? (
        <p className="muted small">Loading tracks...</p>
      ) : tracks.length === 0 ? (
        <EmptyState
          title={isLiked ? 'Nothing liked yet' : 'This playlist is empty'}
          description={
            isLiked
              ? 'Tap the heart on any track and it lands here.'
              : 'Use the menu on any track, anywhere in Weegood, to add it here.'
          }
          action={
            <Link href="/" className="btn btn--primary">
              Find something
            </Link>
          }
        />
      ) : (
        <TrackList
          tracks={tracks}
          contextLabel={playlist.name}
          inPlaylistId={editable ? playlist.id : undefined}
          onMove={editable ? (from, to) => void moveInPlaylist(playlist.id, from, to) : undefined}
        />
      )}

      {suggestions.length > 0 && (
        <Section
          title="Suggested for this playlist"
          subtitle="Based on the vibe of what is already in it."
        >
          <div className="track-list">
            {suggestions.map(({ track, reasons }) => (
              <div
                key={track.id}
                className="track-row"
                style={{ gridTemplateColumns: '44px minmax(0, 1fr) auto' }}
              >
                <Cover
                  title={track.title}
                  hue={trackHue(track)}
                  src={track.artworkUrl}
                  vibe={track.vibe}
                  size={44}
                />
                <div
                  className="track-row__main"
                  onClick={() => {
                    rememberTracks([track]);
                    void playQueue([track.id], 0, 'Suggestion');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void playQueue([track.id], 0, 'Suggestion');
                  }}
                >
                  <span className="track-row__title truncate">{track.title}</span>
                  <span className="track-row__meta">
                    <span className="truncate">{track.artistName}</span>
                    {reasons[0] && <span className="track-row__reason truncate">{reasons[0]}</span>}
                  </span>
                </div>
                <Button
                  size="sm"
                  icon="plus"
                  onClick={() => {
                    rememberTracks([track], true);
                    void addToPlaylist(playlist.id, [track.id]).then(() =>
                      notify(`Added to ${playlist.name}`),
                    );
                  }}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <PromptDialog
        key={renameKey}
        open={renameOpen}
        title="Rename playlist"
        label="Name"
        initialValue={playlist.name}
        onClose={() => setRenameOpen(false)}
        onConfirm={(name) => void renamePlaylist(playlist.id, name)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${playlist.name}"?`}
        message="The playlist goes away. The tracks stay where they are."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deletePlaylist(playlist.id).then(() => navigate('/library'));
        }}
      />
    </div>
  );
}
