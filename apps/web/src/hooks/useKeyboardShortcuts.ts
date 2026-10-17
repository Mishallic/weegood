import { useEffect } from 'react';
import { useStores } from '../app/storesContext';

export const SEARCH_INPUT_ID = 'weegood-search';
const SEEK_STEP_MS = 10_000;

/** Space or K: play/pause. J/L or arrows: seek 10 s. N/P: next/previous. M: mute. /: search. */
export function useKeyboardShortcuts(): void {
  const { usePlayer } = useStores();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;

      if (event.key === '/' && !typing) {
        event.preventDefault();
        document.getElementById(SEARCH_INPUT_ID)?.focus();
        return;
      }
      if (typing) return;

      const player = usePlayer.getState();
      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          void player.togglePlay();
          break;
        case 'j':
        case 'ArrowLeft':
          player.seek(player.positionMs - SEEK_STEP_MS);
          break;
        case 'l':
        case 'ArrowRight':
          player.seek(player.positionMs + SEEK_STEP_MS);
          break;
        case 'n':
          void player.next();
          break;
        case 'p':
          void player.previous();
          break;
        case 'm':
          player.setVolume(player.volume > 0 ? 0 : 0.8);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [usePlayer]);
}
