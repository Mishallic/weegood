import { genreById, hashString, type Track } from '@weegood/core';

/** A stable hue for anything with a name, so generated covers are recognisable across visits. */
export function hueFor(key: string): number {
  return hashString(key) % 360;
}

export function trackHue(track: Track): number {
  const genre = genreById(track.genreIds[0] ?? '');
  return genre ? genre.hue : hueFor(track.artistName || track.title);
}
