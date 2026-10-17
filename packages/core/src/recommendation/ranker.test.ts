import { describe, expect, it } from 'vitest';
import { createRng } from '../util/prng';
import {
  contributions,
  createRanker,
  emptyFeatures,
  normalizeRanker,
  PRIOR_WEIGHTS,
  scoreFeatures,
  trainRanker,
  type FeatureVector,
} from './ranker';

function features(partial: Partial<FeatureVector>): FeatureVector {
  return { ...emptyFeatures(), ...partial };
}

describe('ranker', () => {
  it('starts from the prior and scores in 0..1', () => {
    const model = createRanker();
    expect(model.weights).toEqual(PRIOR_WEIGHTS);
    const high = scoreFeatures(model, features({ vibe: 0.95, genre: 1, popularity: 0.6 }));
    const low = scoreFeatures(model, features({ vibe: 0.3, skippedRecently: 1 }));
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeGreaterThanOrEqual(0);
  });

  it('ranks contributions so reasons can cite the strongest ones', () => {
    const model = createRanker();
    const ranked = contributions(
      model,
      features({ vibe: 0.9, followArtist: 1, playedRecently: 1 }),
    );
    expect(ranked[0]?.feature).toBe('vibe');
    expect(ranked.at(-1)?.feature).toBe('playedRecently');
  });

  it('learns that a listener who completes popular tracks and skips vibe matches values popularity', () => {
    const rng = createRng('ranker');
    let model = createRanker();
    for (let i = 0; i < 400; i++) {
      const popularity = rng.next();
      const vibe = rng.next();
      // This listener finishes whatever is popular, regardless of vibe.
      const label = popularity > 0.5 ? 1 : 0;
      model = trainRanker(model, { features: features({ popularity, vibe }), label });
    }
    expect(model.updates).toBe(400);
    expect(model.weights.popularity).toBeGreaterThan(PRIOR_WEIGHTS.popularity);
    expect(model.weights.vibe).toBeLessThan(PRIOR_WEIGHTS.vibe);
    const popular = scoreFeatures(model, features({ popularity: 0.9, vibe: 0.2 }));
    const matching = scoreFeatures(model, features({ popularity: 0.1, vibe: 0.9 }));
    expect(popular).toBeGreaterThan(matching);
  });

  it('is pulled back toward the prior by regularisation when feedback stops being informative', () => {
    let model = createRanker();
    for (let i = 0; i < 50; i++) {
      model = trainRanker(model, { features: features({ vibe: 1 }), label: 1 });
    }
    const drifted = model.weights.vibe;
    for (let i = 0; i < 300; i++) {
      model = trainRanker(model, { features: emptyFeatures(), label: 0 });
    }
    expect(Math.abs(model.weights.vibe - PRIOR_WEIGHTS.vibe)).toBeLessThan(
      Math.abs(drifted - PRIOR_WEIGHTS.vibe),
    );
  });

  it('does not mutate the model it is given', () => {
    const model = createRanker();
    const before = JSON.stringify(model);
    trainRanker(model, { features: features({ vibe: 1 }), label: 1 });
    expect(JSON.stringify(model)).toBe(before);
  });

  it('normalises damaged persisted models', () => {
    const restored = normalizeRanker({
      weights: { vibe: 3, bogus: 9, genre: 'x' },
      bias: null,
      updates: 4.7,
    });
    expect(restored.weights.vibe).toBe(3);
    expect(restored.weights.genre).toBe(PRIOR_WEIGHTS.genre);
    expect(restored.bias).toBe(createRanker().bias);
    expect(restored.updates).toBe(4);
    expect(normalizeRanker(undefined)).toEqual(createRanker());
  });
});
