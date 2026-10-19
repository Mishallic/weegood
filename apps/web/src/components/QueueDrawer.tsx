import { useEffect } from 'react';
import { usePlayer } from '../app/storesContext';
import { QueueView } from './QueueView';

/** The queue as a side drawer on desktop and a full-width sheet on phones. Escape and the backdrop close it. */
export function QueueDrawer() {
  const open = usePlayer((state) => state.queueOpen);
  const toggleQueue = usePlayer((state) => state.toggleQueue);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleQueue();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, toggleQueue]);

  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={toggleQueue} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-label="Queue">
        <QueueView onClose={toggleQueue} />
      </aside>
    </>
  );
}
