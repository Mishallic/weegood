import {
  addTracksToPlaylist,
  applyFollowSignal,
  applyListen,
  createEmptyProfile,
  createId,
  createLocalTrack,
  createPlaylist,
  createProfileFromOnboarding,
  genreById,
  isSupportedAudioFile,
  ME_USER_ID,
  moveTrackInPlaylist,
  normalizeProfile,
  removeTrackFromPlaylist,
  renamePlaylist,
  setDislike,
  setLike,
  toggleFollow,
  type Artist,
  type FeatureVector,
  type Follow,
  type FollowKind,
  type Id,
  type ListenEvent,
  type MeasuredVibe,
  type OnboardingAnswers,
  type Playlist,
  type TasteProfileV2,
  type Track,
} from '@weegood/core';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { Services } from '../app/services';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

export interface ImportResult {
  imported: Track[];
  rejected: Array<{ name: string; reason: string }>;
}

export interface ExportBundle {
  app: 'weegood';
  version: 2;
  exportedAt: number;
  profile: TasteProfileV2 | null;
  playlists: Playlist[];
  follows: Follow[];
  /** Streamed tracks referenced by playlists, likes and history, so an import resolves offline. */
  tracks: Track[];
  artists: Artist[];
  /** Local file metadata only. Audio never leaves the device (ADR 0008). */
  localTracks: Track[];
  listens: ListenEvent[];
}

export interface AppState {
  hydrated: boolean;
  profile: TasteProfileV2 | null;
  playlists: Playlist[];
  follows: Follow[];
  localTracks: Track[];
  /** Streamed tracks seen this session or persisted because something references them. */
  tracks: Record<Id, Track>;
  artists: Record<Id, Artist>;
  measured: Record<Id, MeasuredVibe>;
  /** Newest first, capped. */
  recentListens: ListenEvent[];
  toasts: Toast[];
  theme: ThemePreference;

  hydrate(): Promise<void>;
  completeOnboarding(answers: OnboardingAnswers, chosenArtists: readonly Artist[]): Promise<void>;
  clearProfile(): Promise<void>;
  resetAll(): Promise<void>;

  getTrack(id: Id): Track | undefined;
  /** Put tracks in the in-memory cache; persist when something will reference them later. */
  rememberTracks(tracks: readonly Track[], persist?: boolean): void;
  rememberArtists(artists: readonly Artist[], persist?: boolean): void;
  /** Resolve ids from cache, fetching the rest from the provider. Keeps the input order. */
  ensureTracks(ids: readonly Id[]): Promise<Track[]>;
  recordMeasuredVibe(measured: MeasuredVibe): Promise<void>;

  createPlaylist(name: string, trackIds?: readonly Id[]): Promise<Playlist | null>;
  renamePlaylist(id: Id, name: string): Promise<void>;
  deletePlaylist(id: Id): Promise<void>;
  /** Returns how many tracks were actually added (duplicates are skipped). */
  addToPlaylist(id: Id, trackIds: readonly Id[]): Promise<number>;
  removeFromPlaylist(id: Id, trackId: Id): Promise<void>;
  moveInPlaylist(id: Id, from: number, to: number): Promise<void>;

  /** Returns whether the target is followed afterwards. Pass the artist so it is cached. */
  toggleFollow(kind: FollowKind, targetId: Id, artist?: Artist): Promise<boolean>;
  toggleLike(track: Track): Promise<boolean>;
  toggleDislike(track: Track): Promise<boolean>;
  recordListen(track: Track, event: ListenEvent, features?: FeatureVector): Promise<void>;

  importLocalFiles(files: Iterable<File>): Promise<ImportResult>;
  removeLocalTrack(id: Id): Promise<void>;

  exportData(): Promise<ExportBundle>;
  importData(raw: unknown): Promise<void>;

  setTheme(theme: ThemePreference): void;
  notify(message: string, kind?: Toast['kind']): void;
  dismissToast(id: number): void;
}

export type AppStore = UseBoundStore<StoreApi<AppState>>;

const THEME_KEY = 'weegood:theme';
const RECENT_LISTENS = 200;
const TOAST_MS = 3500;

export function createAppStore(services: Services): AppStore {
  const { repos, music, now } = services;
  let toastSeq = 0;

  return create<AppState>()((set, get) => {
    const persistProfile = async (profile: TasteProfileV2): Promise<void> => {
      set({ profile });
      await repos.profile.save(profile);
    };

    const updatePlaylist = async (
      id: Id,
      update: (playlist: Playlist) => Playlist,
    ): Promise<Playlist | null> => {
      const current = get().playlists.find((playlist) => playlist.id === id);
      if (!current) return null;
      const next = update(current);
      if (next === current) return current;
      set({ playlists: get().playlists.map((playlist) => (playlist.id === id ? next : playlist)) });
      await repos.playlists.save(next);
      return next;
    };

    /** Apply a stored measurement to a track so the cache always holds the best known vibe. */
    const withMeasurement = (track: Track, measured: Record<Id, MeasuredVibe>): Track => {
      const m = measured[track.id];
      return m && track.vibeSource !== 'measured'
        ? { ...track, vibe: m.vibe, vibeSource: 'measured' }
        : track;
    };

    return {
      hydrated: false,
      profile: null,
      playlists: [],
      follows: [],
      localTracks: [],
      tracks: {},
      artists: {},
      measured: {},
      recentListens: [],
      toasts: [],
      theme: readStoredTheme(),

      async hydrate() {
        const [
          rawProfile,
          playlists,
          follows,
          localTracks,
          cachedTracks,
          cachedArtists,
          measuredList,
          recentListens,
        ] = await Promise.all([
          repos.profile.get(),
          repos.playlists.list(),
          repos.follows.list(),
          repos.localTracks.list(),
          repos.tracks.list(),
          repos.artists.list(),
          repos.measuredVibes.list(),
          repos.listens.recent(RECENT_LISTENS),
        ]);
        const measured: Record<Id, MeasuredVibe> = {};
        for (const m of measuredList) measured[m.trackId] = m;
        const tracks: Record<Id, Track> = {};
        for (const track of cachedTracks) tracks[track.id] = withMeasurement(track, measured);
        const artists: Record<Id, Artist> = {};
        for (const artist of cachedArtists) artists[artist.id] = artist;
        const profile = rawProfile ? normalizeProfile(rawProfile, now()) : null;
        set({
          hydrated: true,
          profile,
          playlists: sortPlaylists(playlists),
          follows: follows.filter((follow) => follow.kind === 'artist' || follow.kind === 'genre'),
          localTracks: localTracks.map((track) => withMeasurement(track, measured)),
          tracks,
          artists,
          measured,
          recentListens,
        });
        applyTheme(get().theme);
      },

      async completeOnboarding(answers, chosenArtists) {
        get().rememberArtists(chosenArtists, true);
        const profile = createProfileFromOnboarding(answers, { artists: chosenArtists }, now());
        const previous = get().profile;
        await persistProfile(
          previous
            ? {
                ...profile,
                likedTrackIds: previous.likedTrackIds,
                dislikedTrackIds: previous.dislikedTrackIds,
                listenCount: previous.listenCount,
                ranker: previous.ranker,
                createdAt: previous.createdAt,
              }
            : profile,
        );
      },

      async clearProfile() {
        set({ profile: null });
        await repos.profile.clear();
      },

      async resetAll() {
        await repos.clearAll();
        set({
          profile: null,
          playlists: [],
          follows: [],
          localTracks: [],
          tracks: {},
          artists: {},
          measured: {},
          recentListens: [],
        });
      },

      getTrack(id) {
        return get().tracks[id] ?? get().localTracks.find((track) => track.id === id);
      },

      rememberTracks(incoming, persist = false) {
        if (incoming.length === 0) return;
        const { tracks, measured } = get();
        const next = { ...tracks };
        const toPersist: Track[] = [];
        for (const track of incoming) {
          if (track.source.kind === 'local') continue;
          const merged = withMeasurement(track, measured);
          next[track.id] = merged;
          if (persist) toPersist.push(merged);
        }
        set({ tracks: next });
        if (toPersist.length > 0) void repos.tracks.saveMany(toPersist);
      },

      rememberArtists(incoming, persist = false) {
        if (incoming.length === 0) return;
        const next = { ...get().artists };
        for (const artist of incoming) {
          const existing = next[artist.id];
          // Keep genres we already learned when a newer object has none.
          next[artist.id] =
            existing && artist.genreIds.length === 0
              ? { ...artist, genreIds: existing.genreIds, vibe: existing.vibe }
              : artist;
        }
        set({ artists: next });
        if (persist)
          void repos.artists.saveMany(incoming.map((artist) => next[artist.id] ?? artist));
      },

      async ensureTracks(ids) {
        const missing = ids.filter((id) => !get().getTrack(id));
        if (missing.length > 0) {
          try {
            const fetched = await music.tracksByIds(missing);
            get().rememberTracks(fetched, true);
          } catch (error) {
            get().notify(
              error instanceof Error ? error.message : 'Could not load tracks.',
              'error',
            );
          }
        }
        return ids
          .map((id) => get().getTrack(id))
          .filter((track): track is Track => track !== undefined);
      },

      async recordMeasuredVibe(measured) {
        const nextMeasured = { ...get().measured, [measured.trackId]: measured };
        const tracks = { ...get().tracks };
        const cached = tracks[measured.trackId];
        if (cached)
          tracks[measured.trackId] = { ...cached, vibe: measured.vibe, vibeSource: 'measured' };
        const localTracks = get().localTracks.map((track) =>
          track.id === measured.trackId
            ? { ...track, vibe: measured.vibe, vibeSource: 'measured' as const }
            : track,
        );
        set({ measured: nextMeasured, tracks, localTracks });
        await repos.measuredVibes.save(measured);
        const updated = tracks[measured.trackId];
        if (updated) await repos.tracks.saveMany([updated]);
        const local = localTracks.find((track) => track.id === measured.trackId);
        if (local) await repos.localTracks.save(local);
      },

      async createPlaylist(name, trackIds = []) {
        try {
          const playlist = createPlaylist(
            { id: createId('pl'), ownerId: ME_USER_ID, name, trackIds },
            now(),
          );
          set({ playlists: [playlist, ...get().playlists] });
          await repos.playlists.save(playlist);
          await persistReferenced(get, repos, trackIds);
          return playlist;
        } catch (error) {
          get().notify(messageOf(error), 'error');
          return null;
        }
      },

      async renamePlaylist(id, name) {
        try {
          await updatePlaylist(id, (playlist) => renamePlaylist(playlist, name, now()));
        } catch (error) {
          get().notify(messageOf(error), 'error');
        }
      },

      async deletePlaylist(id) {
        set({ playlists: get().playlists.filter((playlist) => playlist.id !== id) });
        await repos.playlists.remove(id);
      },

      async addToPlaylist(id, trackIds) {
        const before = get().playlists.find((playlist) => playlist.id === id)?.trackIds.length ?? 0;
        const next = await updatePlaylist(id, (playlist) =>
          addTracksToPlaylist(playlist, trackIds, now()),
        );
        await persistReferenced(get, repos, trackIds);
        return next ? next.trackIds.length - before : 0;
      },

      async removeFromPlaylist(id, trackId) {
        await updatePlaylist(id, (playlist) => removeTrackFromPlaylist(playlist, trackId, now()));
      },

      async moveInPlaylist(id, from, to) {
        await updatePlaylist(id, (playlist) => moveTrackInPlaylist(playlist, from, to, now()));
      },

      async toggleFollow(kind, targetId, artist) {
        const result = toggleFollow(get().follows, kind, targetId, now());
        set({ follows: result.follows });
        if (result.following) await repos.follows.save(result.follow);
        else await repos.follows.remove(kind, targetId);

        const known = artist ?? get().artists[targetId];
        if (result.following && known) get().rememberArtists([known], true);

        const profile = get().profile;
        if (result.following && profile) {
          const genre = kind === 'genre' ? genreById(targetId) : undefined;
          if (kind === 'artist' && known)
            await persistProfile(
              applyFollowSignal(profile, { kind: 'artist', artist: known }, now()),
            );
          else if (genre)
            await persistProfile(applyFollowSignal(profile, { kind: 'genre', genre }, now()));
        }
        return result.following;
      },

      async toggleLike(track) {
        const profile = get().profile ?? createEmptyProfile(now());
        const liked = !profile.likedTrackIds.includes(track.id);
        if (liked) get().rememberTracks([track], true);
        await persistProfile(setLike(profile, track, liked, now()));
        return liked;
      },

      async toggleDislike(track) {
        const profile = get().profile ?? createEmptyProfile(now());
        const disliked = !profile.dislikedTrackIds.includes(track.id);
        await persistProfile(setDislike(profile, track, disliked, now()));
        return disliked;
      },

      async recordListen(track, event, features) {
        set({ recentListens: [event, ...get().recentListens].slice(0, RECENT_LISTENS) });
        get().rememberTracks([track], true);
        await repos.listens.add(event);
        const profile = get().profile;
        if (profile)
          await persistProfile(
            applyListen(profile, track, event, now(), features ? { features } : {}),
          );
      },

      async importLocalFiles(files) {
        const imported: Track[] = [];
        const rejected: ImportResult['rejected'] = [];

        for (const file of files) {
          if (!isSupportedAudioFile(file)) {
            rejected.push({ name: file.name, reason: 'Not a supported audio format.' });
            continue;
          }
          try {
            const durationMs = await services.readDuration(file);
            const track = createLocalTrack({
              id: createId('local'),
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              durationMs,
              importedAt: now(),
            });
            await repos.audioBlobs.put(track.id, file);
            await repos.localTracks.save(track);
            imported.push(track);
          } catch (error) {
            rejected.push({
              name: file.name,
              reason: isQuotaError(error) ? 'Not enough storage space.' : messageOf(error),
            });
          }
        }

        if (imported.length > 0) set({ localTracks: [...get().localTracks, ...imported] });
        if (imported.length > 0 || rejected.length > 0) {
          const parts: string[] = [];
          if (imported.length > 0)
            parts.push(`Imported ${imported.length} ${imported.length === 1 ? 'track' : 'tracks'}`);
          if (rejected.length > 0)
            parts.push(`${rejected.length} skipped (${rejected[0]?.reason ?? 'unsupported'})`);
          get().notify(parts.join('. '), imported.length === 0 ? 'error' : 'info');
        }
        return { imported, rejected };
      },

      async removeLocalTrack(id) {
        const touched = get()
          .playlists.filter((playlist) => playlist.trackIds.includes(id))
          .map((playlist) => removeTrackFromPlaylist(playlist, id, now()));
        set({
          localTracks: get().localTracks.filter((track) => track.id !== id),
          playlists: get().playlists.map(
            (playlist) => touched.find((t) => t.id === playlist.id) ?? playlist,
          ),
        });
        await Promise.all([
          repos.localTracks.remove(id),
          repos.audioBlobs.remove(id),
          ...touched.map((playlist) => repos.playlists.save(playlist)),
        ]);
      },

      async exportData() {
        const state = get();
        const referenced = new Set<Id>([
          ...state.playlists.flatMap((playlist) => playlist.trackIds),
          ...(state.profile?.likedTrackIds ?? []),
          ...state.recentListens.map((event) => event.trackId),
        ]);
        return {
          app: 'weegood',
          version: 2,
          exportedAt: now(),
          profile: state.profile,
          playlists: state.playlists,
          follows: state.follows,
          tracks: [...referenced]
            .map((id) => state.tracks[id])
            .filter((track): track is Track => track !== undefined),
          artists: state.follows
            .filter((follow) => follow.kind === 'artist')
            .map((follow) => state.artists[follow.targetId])
            .filter((artist): artist is Artist => artist !== undefined),
          localTracks: state.localTracks,
          listens: await repos.listens.recent(2000),
        };
      },

      async importData(raw) {
        const bundle = parseBundle(raw, now());
        await Promise.all([repos.profile.clear(), repos.listens.clear()]);
        await Promise.all(get().playlists.map((playlist) => repos.playlists.remove(playlist.id)));
        await Promise.all(
          get().follows.map((follow) => repos.follows.remove(follow.kind, follow.targetId)),
        );
        if (bundle.profile) await repos.profile.save(bundle.profile);
        for (const playlist of bundle.playlists) await repos.playlists.save(playlist);
        for (const follow of bundle.follows) await repos.follows.save(follow);
        await repos.tracks.saveMany(bundle.tracks);
        await repos.artists.saveMany(bundle.artists);
        for (const event of bundle.listens) await repos.listens.add(event);
        await get().hydrate();
        get().notify('Your data was imported.');
      },

      setTheme(theme) {
        set({ theme });
        applyTheme(theme);
        try {
          localStorage.setItem(THEME_KEY, theme);
        } catch {
          // Storage unavailable (private mode). The choice lasts for the session.
        }
      },

      notify(message, kind = 'info') {
        const id = ++toastSeq;
        set({ toasts: [...get().toasts, { id, message, kind }] });
        setTimeout(() => get().dismissToast(id), TOAST_MS);
      },

      dismissToast(id) {
        set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
      },
    };
  });
}

/* ------------------------------------------------------------------------------------------- */

async function persistReferenced(
  get: () => AppState,
  repos: Services['repos'],
  ids: readonly Id[],
): Promise<void> {
  const tracks = ids
    .map((id) => get().tracks[id])
    .filter((track): track is Track => track !== undefined);
  if (tracks.length > 0) await repos.tracks.saveMany(tracks);
}

function sortPlaylists(playlists: Playlist[]): Playlist[] {
  return [...playlists].sort((a, b) => b.updatedAt - a.updatedAt);
}

function readStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // ignore
  }
  return 'system';
}

export function applyTheme(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  if (theme === 'system') delete document.documentElement.dataset['theme'];
  else document.documentElement.dataset['theme'] = theme;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function isQuotaError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'QuotaExceededError') ||
    (error instanceof Error && /quota/i.test(error.message))
  );
}

function parseBundle(raw: unknown, now: number): ExportBundle {
  if (typeof raw !== 'object' || raw === null)
    throw new Error('That file is not a Weegood export.');
  const record = raw as Record<string, unknown>;
  if (record['app'] !== 'weegood' || (record['version'] !== 1 && record['version'] !== 2)) {
    throw new Error('That file is not a Weegood export we can read.');
  }
  const profile =
    record['profile'] === null || record['profile'] === undefined
      ? null
      : normalizeProfile(record['profile'], now);
  if (record['profile'] && !profile) throw new Error('The taste profile in that file is damaged.');
  const list = (key: string): unknown[] => {
    const value = record[key];
    return Array.isArray(value) ? value : [];
  };
  return {
    app: 'weegood',
    version: 2,
    exportedAt: typeof record['exportedAt'] === 'number' ? record['exportedAt'] : 0,
    profile,
    playlists: list('playlists').filter(isPlaylistLike) as Playlist[],
    follows: list('follows').filter(isFollowLike) as Follow[],
    tracks: list('tracks').filter(isTrackLike) as Track[],
    artists: list('artists').filter(isArtistLike) as Artist[],
    localTracks: [],
    listens: list('listens').filter(isListenLike) as ListenEvent[],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlaylistLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    Array.isArray(value['trackIds'])
  );
}

function isFollowLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value['kind'] === 'artist' || value['kind'] === 'genre') &&
    typeof value['targetId'] === 'string'
  );
}

function isTrackLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['title'] === 'string' &&
    isRecord(value['source']) &&
    value['source']['kind'] === 'stream' &&
    isRecord(value['vibe'])
  );
}

function isArtistLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    Array.isArray(value['genreIds'])
  );
}

function isListenLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['trackId'] === 'string' &&
    typeof value['startedAt'] === 'number' &&
    typeof value['msPlayed'] === 'number'
  );
}
