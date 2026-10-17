import type { Artist, Id, Playlist, Track } from '../domain/types';

/** A bundle of entities, used by the test fixture and by tests that need lookups. */
export interface Catalog {
  artists: Artist[];
  tracks: Track[];
  playlists: Playlist[];
}

export interface CatalogIndex {
  tracksById: ReadonlyMap<Id, Track>;
  artistsById: ReadonlyMap<Id, Artist>;
  playlistsById: ReadonlyMap<Id, Playlist>;
  tracksByArtistId: ReadonlyMap<Id, Track[]>;
  tracksByGenreId: ReadonlyMap<Id, Track[]>;
  playlistsByOwnerId: ReadonlyMap<Id, Playlist[]>;
}

export function createCatalogIndex(catalog: Catalog): CatalogIndex {
  const tracksByArtistId = new Map<Id, Track[]>();
  const tracksByGenreId = new Map<Id, Track[]>();
  for (const track of catalog.tracks) {
    if (track.artistId) push(tracksByArtistId, track.artistId, track);
    for (const genreId of track.genreIds) push(tracksByGenreId, genreId, track);
  }
  const playlistsByOwnerId = new Map<Id, Playlist[]>();
  for (const playlist of catalog.playlists) push(playlistsByOwnerId, playlist.ownerId, playlist);

  return {
    tracksById: new Map(catalog.tracks.map((track) => [track.id, track])),
    artistsById: new Map(catalog.artists.map((artist) => [artist.id, artist])),
    playlistsById: new Map(catalog.playlists.map((playlist) => [playlist.id, playlist])),
    tracksByArtistId,
    tracksByGenreId,
    playlistsByOwnerId,
  };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
