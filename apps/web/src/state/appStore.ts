import {
  addTracksToPlaylist,
  applyFollowSignal,
  applyListen,
  createEmptyProfile,
  createId,
  createLocalTrack,
  createPlaylist,
  createProfileFromOnboarding,
  isSupportedAudioFile,
  isVibeVector,
  ME_USER_ID,
  moveTrackInPlaylist,
  removeTrackFromPlaylist,
  renamePlaylist,
  setDislike,
  setLike,
  toggleFollow,
  type Follow,
  type FollowKind,
  type Id,
  type ListenEvent,
  type OnboardingAnswers,
  type Playlist,
  type TasteProfile,
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
  version: 1;
  exportedAt: number;
  profile: TasteProfile | null;
  playlists: Playlist[];
  follows: Follow[];
  /** Metadata only. Audio never leaves the device (ADR 0008). */
  localTracks: Track[];
  listens: ListenEvent[];
}

export interface AppState {
  hydrated: boolean;
  profile: TasteProfile | null;
  playlists: Playlist[];
  follows: Follow[];
  localTracks: Track[];
  /** Newest first, capped. */
  recentListens: ListenEvent[];
  toasts: Toast[];
  theme: ThemePreference;

  hydrate(): Promise<void>;
  completeOnboarding(answers: OnboardingAnswers): Promise<void>;
  clearProfile(): Promise<void>;
  resetAll(): Promise<void>;

  createPlaylist(name: string, trackIds?: readonly Id[]): Promise<Playlist | null>;
  renamePlaylist(id: Id, name: string): Promise<void>;
  deletePlaylist(id: Id): Promise<void>;
  /** Returns how many tracks were actually added (duplicates are skipped). */
  addToPlaylist(id: Id, trackIds: readonly Id[]): Promise<number>;
  removeFromPlaylist(id: Id, trackId: Id): Promise<void>;
  moveInPlaylist(id: Id, from: number, to: number): Promise<void>;

  /** Returns whether the target is followed afterwards. */
  toggleFollow(kind: FollowKind, targetId: Id): Promise<boolean>;
  toggleLike(track: Track): Promise<boolean>;
  toggleDislike(track: Track): Promise<boolean>;
  recordListen(track: Track, event: ListenEvent): Promise<void>;

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
  const { repos, index, now } = services;
  let toastSeq = 0;

  return create<AppState>()((set, get) => {
    const persistProfile = async (profile: TasteProfile): Promise<void> => {
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

    return {
      hydrated: false,
      profile: null,
      playlists: [],
      follows: [],
      localTracks: [],
      recentListens: [],
      toasts: [],
      theme: readStoredTheme(),

      async hydrate() {
        const [profile, playlists, follows, localTracks, recentListens] = await Promise.all([
          repos.profile.get(),
          repos.playlists.list(),
          repos.follows.list(),
          repos.localTracks.list(),
          repos.listens.recent(RECENT_LISTENS),
        ]);
        set({
          hydrated: true,
          profile,
          playlists: sortPlaylists(playlists),
          follows,
          localTracks,
          recentListens,
        });
        applyTheme(get().theme);
      },

      async completeOnboarding(answers) {
        const profile = createProfileFromOnboarding(
          answers,
          { genres: services.catalog.genres, artists: services.catalog.artists },
          now(),
        );
        // Keep likes, dislikes and listen count when re-running onboarding.
        const previous = get().profile;
        await persistProfile(
          previous
            ? {
                ...profile,
                likedTrackIds: previous.likedTrackIds,
                dislikedTrackIds: previous.dislikedTrackIds,
                listenCount: previous.listenCount,
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
        set({ profile: null, playlists: [], follows: [], localTracks: [], recentListens: [] });
      },

      async createPlaylist(name, trackIds = []) {
        try {
          const playlist = createPlaylist(
            { id: createId('pl'), ownerId: ME_USER_ID, name, trackIds },
            now(),
          );
          set({ playlists: [playlist, ...get().playlists] });
          await repos.playlists.save(playlist);
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
        return next ? next.trackIds.length - before : 0;
      },

      async removeFromPlaylist(id, trackId) {
        await updatePlaylist(id, (playlist) => removeTrackFromPlaylist(playlist, trackId, now()));
      },

      async moveInPlaylist(id, from, to) {
        await updatePlaylist(id, (playlist) => moveTrackInPlaylist(playlist, from, to, now()));
      },

      async toggleFollow(kind, targetId) {
        const result = toggleFollow(get().follows, kind, targetId, now());
        set({ follows: result.follows });
        if (result.following) await repos.follows.save(result.follow);
        else await repos.follows.remove(kind, targetId);

        const profile = get().profile;
        if (result.following && profile) {
          const artist = kind === 'artist' ? index.artistsById.get(targetId) : undefined;
          const genre = kind === 'genre' ? index.genresById.get(targetId) : undefined;
          if (artist)
            await persistProfile(applyFollowSignal(profile, { kind: 'artist', artist }, now()));
          else if (genre)
            await persistProfile(applyFollowSignal(profile, { kind: 'genre', genre }, now()));
        }
        return result.following;
      },

      async toggleLike(track) {
        const profile = get().profile ?? createEmptyProfile(now());
        const liked = !profile.likedTrackIds.includes(track.id);
        await persistProfile(setLike(profile, track, liked, now()));
        return liked;
      },

      async toggleDislike(track) {
        const profile = get().profile ?? createEmptyProfile(now());
        const disliked = !profile.dislikedTrackIds.includes(track.id);
        await persistProfile(setDislike(profile, track, disliked, now()));
        return disliked;
      },

      async recordListen(track, event) {
        set({ recentListens: [event, ...get().recentListens].slice(0, RECENT_LISTENS) });
        await repos.listens.add(event);
        const profile = get().profile;
        if (profile) await persistProfile(applyListen(profile, track, event, now()));
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
          const parts = [];
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
        return {
          app: 'weegood',
          version: 1,
          exportedAt: now(),
          profile: state.profile,
          playlists: state.playlists,
          follows: state.follows,
          localTracks: state.localTracks,
          listens: await repos.listens.recent(2000),
        };
      },

      async importData(raw) {
        const bundle = parseBundle(raw);
        await Promise.all([repos.profile.clear(), repos.listens.clear()]);
        await Promise.all(get().playlists.map((playlist) => repos.playlists.remove(playlist.id)));
        await Promise.all(
          get().follows.map((follow) => repos.follows.remove(follow.kind, follow.targetId)),
        );
        if (bundle.profile) await repos.profile.save(bundle.profile);
        for (const playlist of bundle.playlists) await repos.playlists.save(playlist);
        for (const follow of bundle.follows) await repos.follows.save(follow);
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

function parseBundle(raw: unknown): ExportBundle {
  if (typeof raw !== 'object' || raw === null)
    throw new Error('That file is not a Weegood export.');
  const record = raw as Record<string, unknown>;
  if (record['app'] !== 'weegood' || record['version'] !== 1) {
    throw new Error('That file is not a Weegood export we can read.');
  }
  const profile = record['profile'];
  if (profile !== null && profile !== undefined) {
    const candidate = profile as Record<string, unknown>;
    if (!isVibeVector(candidate['vibe']) || !Array.isArray(candidate['likedTrackIds'])) {
      throw new Error('The taste profile in that file is damaged.');
    }
  }
  const list = (key: string): unknown[] => {
    const value = record[key];
    return Array.isArray(value) ? value : [];
  };
  return {
    app: 'weegood',
    version: 1,
    exportedAt: typeof record['exportedAt'] === 'number' ? record['exportedAt'] : 0,
    profile: (profile ?? null) as TasteProfile | null,
    playlists: list('playlists').filter(isPlaylistLike) as Playlist[],
    follows: list('follows').filter(isFollowLike) as Follow[],
    localTracks: [],
    listens: list('listens').filter(isListenLike) as ListenEvent[],
  };
}

function isPlaylistLike(value: unknown): boolean {
  const p = value as Record<string, unknown>;
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof p['id'] === 'string' &&
    typeof p['name'] === 'string' &&
    Array.isArray(p['trackIds'])
  );
}

function isFollowLike(value: unknown): boolean {
  const f = value as Record<string, unknown>;
  return (
    typeof f === 'object' &&
    f !== null &&
    (f['kind'] === 'artist' || f['kind'] === 'genre' || f['kind'] === 'user') &&
    typeof f['targetId'] === 'string'
  );
}

function isListenLike(value: unknown): boolean {
  const e = value as Record<string, unknown>;
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof e['trackId'] === 'string' &&
    typeof e['startedAt'] === 'number' &&
    typeof e['msPlayed'] === 'number'
  );
}
