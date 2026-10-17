import type { Id, Playlist, Track } from '../domain/types';

export const PLAYLIST_NAME_MAX = 80;
export const PLAYLIST_DESCRIPTION_MAX = 300;

/** Trim, collapse whitespace, cap length. */
export function normalizePlaylistName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, PLAYLIST_NAME_MAX);
}

/** Returns an error message, or null when the name is acceptable. */
export function validatePlaylistName(name: string): string | null {
  const normalized = normalizePlaylistName(name);
  if (normalized.length === 0) return 'Give your playlist a name.';
  return null;
}

export interface CreatePlaylistInput {
  id: Id;
  ownerId: Id;
  name: string;
  description?: string;
  isPublic?: boolean;
  trackIds?: readonly Id[];
}

/** A playlist owned by the local user. Provider playlists are mapped by the provider adapter. */
export function createPlaylist(input: CreatePlaylistInput, now: number): Playlist {
  const error = validatePlaylistName(input.name);
  if (error) throw new Error(error);
  return {
    id: input.id,
    ownerId: input.ownerId,
    ownerName: null,
    name: normalizePlaylistName(input.name),
    description: (input.description ?? '').trim().slice(0, PLAYLIST_DESCRIPTION_MAX),
    trackIds: dedupe(input.trackIds ?? []),
    artworkUrl: null,
    isPublic: input.isPublic ?? false,
    provider: null,
    externalId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function renamePlaylist(playlist: Playlist, name: string, now: number): Playlist {
  const error = validatePlaylistName(name);
  if (error) throw new Error(error);
  const normalized = normalizePlaylistName(name);
  if (normalized === playlist.name) return playlist;
  return { ...playlist, name: normalized, updatedAt: now };
}

export function describePlaylist(playlist: Playlist, description: string, now: number): Playlist {
  const next = description.trim().slice(0, PLAYLIST_DESCRIPTION_MAX);
  if (next === playlist.description) return playlist;
  return { ...playlist, description: next, updatedAt: now };
}

/** Append tracks, skipping ones already present. Order of new tracks is preserved. */
export function addTracksToPlaylist(
  playlist: Playlist,
  trackIds: readonly Id[],
  now: number,
): Playlist {
  const existing = new Set(playlist.trackIds);
  const additions = dedupe(trackIds).filter((id) => !existing.has(id));
  if (additions.length === 0) return playlist;
  return { ...playlist, trackIds: [...playlist.trackIds, ...additions], updatedAt: now };
}

export function removeTrackFromPlaylist(playlist: Playlist, trackId: Id, now: number): Playlist {
  if (!playlist.trackIds.includes(trackId)) return playlist;
  return {
    ...playlist,
    trackIds: playlist.trackIds.filter((id) => id !== trackId),
    updatedAt: now,
  };
}

/** Move the track at `from` to position `to`. Out-of-range indices are a no-op. */
export function moveTrackInPlaylist(
  playlist: Playlist,
  from: number,
  to: number,
  now: number,
): Playlist {
  const length = playlist.trackIds.length;
  if (from === to || from < 0 || to < 0 || from >= length || to >= length) return playlist;
  const trackIds = [...playlist.trackIds];
  const [moved] = trackIds.splice(from, 1);
  if (moved === undefined) return playlist;
  trackIds.splice(to, 0, moved);
  return { ...playlist, trackIds, updatedAt: now };
}

export function playlistDurationMs(
  playlist: Playlist,
  getTrack: (id: Id) => Track | undefined,
): number {
  let total = 0;
  for (const id of playlist.trackIds) total += getTrack(id)?.durationMs ?? 0;
  return total;
}

function dedupe(ids: readonly Id[]): Id[] {
  return [...new Set(ids)];
}
