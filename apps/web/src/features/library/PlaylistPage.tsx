import {
  centroid,
  formatDuration,
  ME_USER_ID,
  pluralize,
  recommendTracks,
  type Playlist,
  type Track,
} from '@weegood/core';
import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useApp, usePlayer, useServices } from '../../app/storesContext';
import { Button } from '../../components/Button';
import { Cover } from '../../components/Cover';
import { ConfirmDialog, PromptDialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { NotFound } from '../../components/NotFound';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';
import { useRecommendationInput } from '../../hooks/useRecommendationInput';
import { hueFor, trackHue } from '../../lib/hue';
import { isDefined } from '../../lib/isDefined';

const LIKED_ID = 'liked';

export function PlaylistPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { index } = useServices();
  const [, navigate] = useLocation();

  const mine = useApp((state) => state.playlists.find((playlist) => playlist.id === id));
  const likedIds = useApp((state) => state.profile?.likedTrackIds ?? []);
  const localTracks = useApp((state) => state.localTracks);
  const renamePlaylist = useApp((state) => state.renamePlaylist);
  const deletePlaylist = useApp((state) => state.deletePlaylist);
  const moveInPlaylist = useApp((state) => state.moveInPlaylist);
  const addToPlaylist = useApp((state) => state.addToPlaylist);
  const createPlaylist = useApp((state) => state.createPlaylist);
  const notify = useApp((state) => state.notify);
  const playQueue = usePlayer((state) => state.playQueue);
  const shuffle = usePlayer((state) => state.shuffle);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);
  const input = useRecommendationInput();

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameKey, setRenameKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const demo = index.playlistsById.get(id);
  const owner = demo ? index.usersById.get(demo.ownerId) : undefined;
  const isLiked = id === LIKED_ID;

  const playlist: Playlist | undefined = useMemo(() => {
    if (isLiked) {
      return {
        id: LIKED_ID,
        ownerId: ME_USER_ID,
        name: 'Liked songs',
        description: 'Everything you hearted, newest last.',
        trackIds: likedIds,
        isPublic: false,
        createdAt: 0,
        updatedAt: 0,
      };
    }
    return mine ?? demo;
  }, [isLiked, likedIds, mine, demo]);

  const editable = Boolean(mine);

  const tracks = useMemo(() => {
    const localById = new Map(localTracks.map((track) => [track.id, track]));
    return (playlist?.trackIds ?? [])
      .map((id) => index.tracksById.get(id) ?? localById.get(id))
      .filter(isDefined);
  }, [playlist, localTracks, index]);

  const suggestions = useMemo(() => {
    if (!playlist || !editable || tracks.length === 0) return [];
    const seed: Track = {
      id: `seed:${playlist.id}`,
      title: playlist.name,
      artistId: null,
      artistName: '',
      genreIds: [...new Set(tracks.flatMap((track) => track.genreIds))],
      durationMs: 0,
      year: null,
      vibe: centroid(tracks.map((track) => ({ vibe: track.vibe }))),
      source: { kind: 'catalog' },
    };
    return recommendTracks(input, {
      seed,
      limit: 6,
      diversity: 0.2,
      excludeTrackIds: new Set(playlist.trackIds),
    });
  }, [playlist, editable, tracks, input]);

  if (!playlist) return <NotFound what="playlist" />;

  const ids = tracks.map((track) => track.id);
  const durationMs = tracks.reduce((sum, track) => sum + track.durationMs, 0);
  const hue = isLiked
    ? 340
    : tracks[0]
      ? trackHue(tracks[0], index.genresById)
      : hueFor(playlist.id);

  const play = (startIndex = 0) => void playQueue(ids, startIndex, playlist.name);
  const shufflePlay = () => {
    if (!shuffle) toggleShuffle();
    play(0);
  };
  const saveCopy = async () => {
    const copy = await createPlaylist(playlist.name, playlist.trackIds);
    if (copy) {
      notify(`Saved ${copy.name} to your library`);
      navigate(`/playlist/${copy.id}`);
    }
  };

  return (
    <div className="page">
      <section className="hero">
        <Cover title={playlist.name} hue={hue} size={140} />
        <div className="hero__body">
          <span className="hero__kicker">
            Playlist ·{' '}
            {editable || isLiked ? (
              'by you'
            ) : owner ? (
              <Link href={`/u/${owner.handle}`}>by {owner.displayName}</Link>
            ) : (
              'demo'
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

      {tracks.length === 0 ? (
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
                <Cover title={track.title} hue={trackHue(track, index.genresById)} size={44} />
                <div
                  className="track-row__main"
                  onClick={() => void playQueue([track.id], 0, 'Suggestion')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) =>
                    event.key === 'Enter' && void playQueue([track.id], 0, 'Suggestion')
                  }
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
        message="The playlist goes away. The tracks stay in your library."
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
