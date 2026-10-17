import { useEffect } from 'react';
import { usePlayer, useStores } from '../app/storesContext';

/** Lock screens, headsets and OS media widgets drive the player through the Media Session API. */
export function useMediaSession(): void {
  const { usePlayer: playerStore, resolveTrack } = useStores();
  const currentTrackId = usePlayer((state) => state.currentTrackId);
  const status = usePlayer((state) => state.status);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const track = currentTrackId ? resolveTrack(currentTrackId) : undefined;
    navigator.mediaSession.metadata = track
      ? new MediaMetadata({ title: track.title, artist: track.artistName, album: 'Weegood' })
      : null;
    navigator.mediaSession.playbackState =
      status === 'playing' ? 'playing' : status === 'paused' ? 'paused' : 'none';
  }, [currentTrackId, status, resolveTrack]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void playerStore.getState().togglePlay()],
      ['pause', () => void playerStore.getState().togglePlay()],
      ['nexttrack', () => void playerStore.getState().next()],
      ['previoustrack', () => void playerStore.getState().previous()],
      [
        'seekto',
        (details) => {
          if (details.seekTime !== undefined) playerStore.getState().seek(details.seekTime * 1000);
        },
      ],
    ];
    for (const [action, handler] of actions) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Action not supported by this browser.
      }
    }
    return () => {
      for (const [action] of actions) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, [playerStore]);
}
