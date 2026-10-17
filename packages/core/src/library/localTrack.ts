import type { Id, Track } from '../domain/types';
import { NEUTRAL_VIBE, type VibeVector } from '../domain/vibe';

/**
 * Local files are first-class tracks (ADR 0008). This module turns a picked file into a `Track`
 * without touching any platform API: the app passes in what it read, core shapes it.
 */

export const SUPPORTED_AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'flac',
  'ogg',
  'oga',
  'opus',
  'aac',
  'm4a',
  'webm',
] as const;

const EXTENSION_SET: ReadonlySet<string> = new Set(SUPPORTED_AUDIO_EXTENSIONS);

export interface FileLike {
  name: string;
  /** MIME type as reported by the platform; may be empty. */
  type: string;
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** Accept by MIME type when present, by extension otherwise. Browsers are inconsistent here. */
export function isSupportedAudioFile(file: FileLike): boolean {
  if (file.type.startsWith('audio/')) return true;
  return EXTENSION_SET.has(fileExtension(file.name));
}

export interface InferredMetadata {
  title: string;
  artistName: string | null;
  trackNumber: number | null;
}

/**
 * Best-effort metadata from a file name. Handles the common shapes:
 *   "Artist - Title.mp3", "03 - Artist - Title.flac", "03. Title.wav", "Title.ogg",
 *   underscores as spaces. Reading embedded tags is a roadmap item (M1 P2).
 */
export function inferTrackMetadata(fileName: string): InferredMetadata {
  const base = stripExtension(fileName).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  let trackNumber: number | null = null;
  let rest = base;
  const numbered = /^(\d{1,3})\s*[.\-)]?\s+(.+)$/.exec(rest);
  if (numbered && numbered[1] !== undefined && numbered[2] !== undefined) {
    trackNumber = Number.parseInt(numbered[1], 10);
    rest = numbered[2].trim();
  }

  const parts = rest.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const artistName = parts[0]?.trim() ?? '';
    const title = parts.slice(1).join(' - ').trim();
    if (artistName && title) return { title, artistName, trackNumber };
  }

  return { title: rest || fileName, artistName: null, trackNumber };
}

export interface CreateLocalTrackInput {
  id: Id;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  importedAt: number;
  /** Optional estimate from audio analysis (ROADMAP M2). Neutral when absent. */
  vibe?: VibeVector;
}

export function createLocalTrack(input: CreateLocalTrackInput): Track {
  const meta = inferTrackMetadata(input.fileName);
  return {
    id: input.id,
    title: meta.title,
    artistId: null,
    artistName: meta.artistName ?? 'Unknown artist',
    genreIds: [],
    durationMs: Math.max(0, Math.round(input.durationMs)),
    year: null,
    vibe: input.vibe ?? NEUTRAL_VIBE,
    source: {
      kind: 'local',
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      importedAt: input.importedAt,
    },
  };
}

export function isLocalTrack(track: Track): boolean {
  return track.source.kind === 'local';
}

function stripExtension(fileName: string): string {
  const ext = fileExtension(fileName);
  return ext ? fileName.slice(0, -(ext.length + 1)) : fileName;
}
