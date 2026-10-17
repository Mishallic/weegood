import { analyzeSamples } from '@weegood/core';

/**
 * Runs feature extraction off the main thread (ADR 0011). Receives mono PCM and a sample rate,
 * returns `AudioFeatures`. Core does the work; this file is only the thread boundary.
 */
interface Request {
  id: number;
  samples: Float32Array;
  sampleRate: number;
}

const scope = globalThis as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<Request>) => void): void;
  postMessage(message: unknown): void;
};

scope.addEventListener('message', (event) => {
  const { id, samples, sampleRate } = event.data;
  try {
    scope.postMessage({ id, features: analyzeSamples(samples, sampleRate) });
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : 'analysis failed' });
  }
});
