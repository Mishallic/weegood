import { isFollowing, type Artist, type FollowKind, type Id } from '@weegood/core';
import { useApp } from '../app/storesContext';
import { Button, type ButtonSize } from './Button';

interface FollowButtonProps {
  kind: FollowKind;
  targetId: Id;
  /** Pass the artist so following caches it for offline rendering and taste nudges. */
  artist?: Artist | undefined;
  size?: ButtonSize;
}

export function FollowButton({ kind, targetId, artist, size = 'md' }: FollowButtonProps) {
  const following = useApp((state) => isFollowing(state.follows, kind, targetId));
  const toggleFollow = useApp((state) => state.toggleFollow);
  return (
    <Button
      variant={following ? 'outline' : 'primary'}
      size={size}
      icon={following ? 'check' : 'plus'}
      aria-pressed={following}
      onClick={() => void toggleFollow(kind, targetId, artist)}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
