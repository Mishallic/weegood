import type { Artist, Track } from '@weegood/core';

/** Where a streamed track lives on its provider's own site, for attribution. */
export function providerPageUrl(track: Track): string | null {
  if (track.source.kind !== 'stream') return null;
  if (track.source.provider === 'audius' && track.source.permalink) {
    return `https://audius.co${track.source.permalink}`;
  }
  return null;
}

export function artistPageUrl(artist: Artist): string | null {
  if (artist.provider === 'audius' && artist.handle) return `https://audius.co/${artist.handle}`;
  return null;
}
