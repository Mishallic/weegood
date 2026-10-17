import { hashString, type Genre, type Id, type Track } from '@weegood/core';

/** A stable hue for anything with a name, so generated covers are recognisable across visits. */
export function hueFor(key: string): number {
  return hashString(key) % 360;
}

export function trackHue(track: Track, genresById: ReadonlyMap<Id, Genre>): number {
  const genreId = track.genreIds[0];
  const genre = genreId ? genresById.get(genreId) : undefined;
  return genre ? genre.hue : hueFor(track.artistName || track.title);
}
