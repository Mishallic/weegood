import type { Track } from '@weegood/core';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useApp, usePlayer } from '../app/storesContext';
import { Button } from './Button';
import { PromptDialog } from './Dialog';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './Menu';

interface TrackMenuProps {
  track: Track;
  /** When shown inside one of the user's playlists, offers removal from it. */
  inPlaylistId?: string | undefined;
  direction?: 'down' | 'up';
}

/** The "..." menu on a track: queueing, playlists, artist, feedback, deletion of local files. */
export function TrackMenu({ track, inPlaylistId, direction = 'down' }: TrackMenuProps) {
  const [, navigate] = useLocation();
  const playlists = useApp((state) => state.playlists);
  const disliked = useApp((state) => state.profile?.dislikedTrackIds.includes(track.id) ?? false);
  const addToPlaylist = useApp((state) => state.addToPlaylist);
  const createPlaylist = useApp((state) => state.createPlaylist);
  const removeFromPlaylist = useApp((state) => state.removeFromPlaylist);
  const removeLocalTrack = useApp((state) => state.removeLocalTrack);
  const toggleDislike = useApp((state) => state.toggleDislike);
  const notify = useApp((state) => state.notify);
  const enqueue = usePlayer((state) => state.enqueue);
  const playNext = usePlayer((state) => state.playNext);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptKey, setPromptKey] = useState(0);

  const add = async (playlistId: string, name: string) => {
    const added = await addToPlaylist(playlistId, [track.id]);
    notify(added > 0 ? `Added to ${name}` : `Already in ${name}`);
  };

  return (
    <>
      <Menu
        direction={direction}
        trigger={(props) => (
          <Button {...props} variant="ghost" size="sm" icon="more" iconOnly label="More options" />
        )}
      >
        {({ close }) => (
          <>
            <MenuItem
              icon="next"
              onSelect={() => {
                playNext(track.id);
                notify('Playing next');
                close();
              }}
            >
              Play next
            </MenuItem>
            <MenuItem
              icon="queue"
              onSelect={() => {
                enqueue([track.id]);
                notify('Added to queue');
                close();
              }}
            >
              Add to queue
            </MenuItem>
            <MenuSeparator />
            <MenuLabel>Add to playlist</MenuLabel>
            {playlists.slice(0, 6).map((playlist) => (
              <MenuItem
                key={playlist.id}
                icon="playlistAdd"
                onSelect={() => {
                  void add(playlist.id, playlist.name);
                  close();
                }}
              >
                {playlist.name}
              </MenuItem>
            ))}
            <MenuItem
              icon="plus"
              onSelect={() => {
                setPromptKey((k) => k + 1);
                setPromptOpen(true);
                close();
              }}
            >
              New playlist
            </MenuItem>
            {inPlaylistId && (
              <MenuItem
                icon="close"
                onSelect={() => {
                  void removeFromPlaylist(inPlaylistId, track.id);
                  close();
                }}
              >
                Remove from this playlist
              </MenuItem>
            )}
            <MenuSeparator />
            {track.artistId && (
              <MenuItem
                icon="person"
                onSelect={() => {
                  navigate(`/artist/${track.artistId}`);
                  close();
                }}
              >
                Go to artist
              </MenuItem>
            )}
            {track.source.kind === 'catalog' && (
              <MenuItem
                icon="thumbDown"
                onSelect={() => {
                  void toggleDislike(track).then((now) =>
                    notify(now ? 'Noted. Fewer like this.' : 'Okay, back in the mix.'),
                  );
                  close();
                }}
              >
                {disliked ? 'Undo "not for me"' : 'Not for me'}
              </MenuItem>
            )}
            {track.source.kind === 'local' && (
              <MenuItem
                icon="trash"
                danger
                onSelect={() => {
                  void removeLocalTrack(track.id);
                  notify('Removed from your library');
                  close();
                }}
              >
                Delete from library
              </MenuItem>
            )}
          </>
        )}
      </Menu>
      <PromptDialog
        key={promptKey}
        open={promptOpen}
        title="New playlist"
        label="Name"
        placeholder="Late night drive"
        confirmLabel="Create"
        onClose={() => setPromptOpen(false)}
        onConfirm={(name) => {
          void createPlaylist(name, [track.id]).then((playlist) => {
            if (playlist) notify(`Created ${playlist.name}`);
          });
        }}
      />
    </>
  );
}
