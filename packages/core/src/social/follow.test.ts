import { describe, expect, it } from 'vitest';
import { followedIds, isFollowing, toggleFollow } from './follow';

const NOW = 1_800_000_000_000;

describe('toggleFollow', () => {
  it('follows, then unfollows, without mutating the input', () => {
    const first = toggleFollow([], 'artist', 'ironwake', NOW);
    expect(first.following).toBe(true);
    expect(first.follows).toEqual([{ kind: 'artist', targetId: 'ironwake', createdAt: NOW }]);

    const second = toggleFollow(first.follows, 'artist', 'ironwake', NOW + 1);
    expect(second.following).toBe(false);
    expect(second.follows).toEqual([]);
    expect(first.follows.length).toBe(1);
  });

  it('keeps kinds separate', () => {
    const { follows } = toggleFollow([], 'genre', 'jazz', NOW);
    expect(isFollowing(follows, 'genre', 'jazz')).toBe(true);
    expect(isFollowing(follows, 'artist', 'jazz')).toBe(false);
    expect([...followedIds(follows, 'genre')]).toEqual(['jazz']);
    expect(followedIds(follows, 'artist').size).toBe(0);
  });
});
