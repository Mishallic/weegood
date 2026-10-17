import { isFollowing, type FollowKind, type Id } from '@weegood/core';
import { useApp } from '../app/storesContext';
import { Button, type ButtonSize } from './Button';

interface FollowButtonProps {
  kind: FollowKind;
  targetId: Id;
  size?: ButtonSize;
}

export function FollowButton({ kind, targetId, size = 'md' }: FollowButtonProps) {
  const following = useApp((state) => isFollowing(state.follows, kind, targetId));
  const toggleFollow = useApp((state) => state.toggleFollow);
  return (
    <Button
      variant={following ? 'outline' : 'primary'}
      size={size}
      icon={following ? 'check' : 'plus'}
      aria-pressed={following}
      onClick={() => void toggleFollow(kind, targetId)}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
