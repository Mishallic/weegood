import type { Id, Recommendation } from '../domain/types';
import { followedIds } from '../social/follow';
import { recommendTracks, type RecommendationInput } from './engine';

export type HomeSectionId = 'for-you' | 'because-you-follow' | 'from-people' | 'fresh';

export interface HomeSection {
  id: HomeSectionId;
  title: string;
  subtitle: string;
  items: Recommendation[];
}

export interface HomeFeedOptions {
  /** Items per section. Default 10. */
  perSection?: number;
}

/**
 * The home feed, composed here so every platform shows the same rows for the same listener.
 * Sections that would be empty are omitted; the UI never renders a header over nothing.
 */
export function buildHomeFeed(
  input: RecommendationInput,
  options: HomeFeedOptions = {},
): HomeSection[] {
  const limit = options.perSection ?? 10;
  const sections: HomeSection[] = [];
  const used = new Set<Id>();

  const forYou = recommendTracks(input, { limit });
  take(used, forYou);
  sections.push({
    id: 'for-you',
    title: 'For you',
    subtitle: 'Closest to your vibe right now.',
    items: forYou,
  });

  const followedArtists = followedIds(input.follows, 'artist');
  const followedGenres = followedIds(input.follows, 'genre');
  if (followedArtists.size > 0 || followedGenres.size > 0) {
    const candidates = input.tracks.filter(
      (track) =>
        (track.artistId !== null && followedArtists.has(track.artistId)) ||
        track.genreIds.some((id) => followedGenres.has(id)),
    );
    const items = recommendTracks(
      { ...input, tracks: candidates },
      { limit, diversity: 0.4, excludeTrackIds: used },
    );
    take(used, items);
    sections.push({
      id: 'because-you-follow',
      title: 'Because you follow',
      subtitle: 'New from the artists and genres you follow.',
      items,
    });
  }

  const people = input.peoplePlaylists ?? [];
  if (people.length > 0) {
    const inPlaylists = new Set<Id>();
    for (const hit of people) for (const id of hit.playlist.trackIds) inPlaylists.add(id);
    const candidates = input.tracks.filter((track) => inPlaylists.has(track.id));
    const items = recommendTracks(
      { ...input, tracks: candidates },
      { limit, diversity: 0.4, excludeTrackIds: used, maxPerArtist: 3 },
    );
    take(used, items);
    const names = [...new Set(people.map((hit) => hit.user.displayName))];
    sections.push({
      id: 'from-people',
      title: 'From people you follow',
      subtitle: `Picked from ${listNames(names)}.`,
      items,
    });
  }

  const fresh = recommendTracks(input, {
    limit,
    diversity: 0.75,
    excludeListened: true,
    excludeTrackIds: used,
    maxPerArtist: 1,
  });
  sections.push({
    id: 'fresh',
    title: 'Fresh vibes',
    subtitle: 'A wider net. Nothing here has been played yet.',
    items: fresh,
  });

  return sections.filter((section) => section.items.length > 0);
}

function take(used: Set<Id>, items: Recommendation[]): void {
  for (const item of items) used.add(item.track.id);
}

function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}
