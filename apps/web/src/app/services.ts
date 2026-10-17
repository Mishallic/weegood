import { createInMemoryRepositories, DEMO_CATALOG, type Repositories } from '@weegood/core';
import { createAnalyzer, type Analyzer } from '../audio/analyzeTrack';
import { openWeegoodDB } from '../data/db';
import { createIndexedDbRepositories } from '../data/repositories';
import { createAudiusProvider } from '../providers/audius';
import { createFakeProvider } from '../providers/fake';
import type { MusicProvider } from '../providers/types';

/** Everything the stores need from the outside world, so tests can swap all of it. */
export interface Services {
  repos: Repositories<Blob>;
  music: MusicProvider;
  /** On-device audio analysis. Null where Web Audio is unavailable (tests). */
  analyzer: Analyzer | null;
  now: () => number;
  /** Duration of an audio blob in ms, or 0 when it cannot be decoded. */
  readDuration: (blob: Blob) => Promise<number>;
}

export function createBrowserServices(): Services {
  return {
    repos: createIndexedDbRepositories(openWeegoodDB()),
    music: createAudiusProvider(),
    analyzer: createAnalyzer(),
    now: () => Date.now(),
    readDuration: readDurationWithAudioElement,
  };
}

export function createTestServices(overrides: Partial<Services> = {}): Services {
  return {
    repos: createInMemoryRepositories<Blob>(),
    music: createFakeProvider(DEMO_CATALOG),
    analyzer: null,
    now: () => Date.now(),
    readDuration: async () => 180_000,
    ...overrides,
  };
}

const DECODE_TIMEOUT_MS = 8000;

function readDurationWithAudioElement(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    let settled = false;
    const finish = (ms: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      audio.removeAttribute('src');
      resolve(ms);
    };
    const timer = setTimeout(() => finish(0), DECODE_TIMEOUT_MS);
    audio.addEventListener(
      'loadedmetadata',
      () => finish(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0),
      { once: true },
    );
    audio.addEventListener('error', () => finish(0), { once: true });
    audio.preload = 'metadata';
    audio.src = url;
  });
}
