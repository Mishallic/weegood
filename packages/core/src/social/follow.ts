import type { Follow, FollowKind, Id } from '../domain/types';

export function isFollowing(follows: readonly Follow[], kind: FollowKind, targetId: Id): boolean {
  return follows.some((follow) => follow.kind === kind && follow.targetId === targetId);
}

export function followedIds(follows: readonly Follow[], kind: FollowKind): Set<Id> {
  const ids = new Set<Id>();
  for (const follow of follows) if (follow.kind === kind) ids.add(follow.targetId);
  return ids;
}

export interface ToggleFollowResult {
  follows: Follow[];
  /** True when the target is followed after the toggle. */
  following: boolean;
  /** The follow added or removed. */
  follow: Follow;
}

/** Follow if not followed, unfollow otherwise. Pure. */
export function toggleFollow(
  follows: readonly Follow[],
  kind: FollowKind,
  targetId: Id,
  now: number,
): ToggleFollowResult {
  const existing = follows.find((follow) => follow.kind === kind && follow.targetId === targetId);
  if (existing) {
    return {
      follows: follows.filter((follow) => follow !== existing),
      following: false,
      follow: existing,
    };
  }
  const follow: Follow = { kind, targetId, createdAt: now };
  return { follows: [...follows, follow], following: true, follow };
}
