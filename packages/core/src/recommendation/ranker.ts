/**
 * A per-listener ranking model learned online from implicit feedback (ADR 0011).
 *
 * Logistic regression over a handful of interpretable features. It starts from hand-set prior
 * weights so recommendations are sensible from the first second, and each completed play or early
 * skip nudges the weights toward what predicts *this* listener's behaviour. Regularisation pulls
 * weights back toward the prior so a few noisy sessions cannot wreck the model. Because the model is
 * linear in named features, every score decomposes into contributions, which is what powers the
 * "why this track" reasons.
 */
export const RANK_FEATURES = [
  'vibe',
  'genre',
  'mood',
  'artist',
  'popularity',
  'followArtist',
  'followGenre',
  'people',
  'novelty',
  'playedRecently',
  'skippedRecently',
] as const;

export type RankFeature = (typeof RANK_FEATURES)[number];

/** Every feature is in 0..1. Penalty features are 1 when the penalty applies. */
export type FeatureVector = Record<RankFeature, number>;

export interface RankerModel {
  version: 1;
  weights: Record<RankFeature, number>;
  bias: number;
  /** Number of training examples seen. */
  updates: number;
}

export const PRIOR_WEIGHTS: Readonly<Record<RankFeature, number>> = Object.freeze({
  vibe: 2.2,
  genre: 0.9,
  mood: 0.7,
  artist: 0.7,
  popularity: 0.5,
  followArtist: 0.5,
  followGenre: 0.3,
  people: 0.5,
  novelty: 0.2,
  playedRecently: -0.8,
  skippedRecently: -1.2,
});

export const PRIOR_BIAS = -1.6;

export interface TrainingOptions {
  /** Step size. Default 0.08. */
  learningRate?: number;
  /** Pull toward the prior weights. Default 0.02. */
  regularization?: number;
}

export interface TrainingExample {
  features: FeatureVector;
  /** 1 for a positive signal (completed, long play, like), 0 for a negative one (early skip). */
  label: 0 | 1;
}

export function createRanker(): RankerModel {
  return { version: 1, weights: { ...PRIOR_WEIGHTS }, bias: PRIOR_BIAS, updates: 0 };
}

export function emptyFeatures(): FeatureVector {
  const out = {} as Record<RankFeature, number>;
  for (const name of RANK_FEATURES) out[name] = 0;
  return out;
}

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function logit(model: RankerModel, features: FeatureVector): number {
  let z = model.bias;
  for (const name of RANK_FEATURES) z += model.weights[name] * features[name];
  return z;
}

/** Probability-like score in 0..1. */
export function scoreFeatures(model: RankerModel, features: FeatureVector): number {
  return sigmoid(logit(model, features));
}

/** Signed contribution of each feature to the logit, largest first. */
export function contributions(
  model: RankerModel,
  features: FeatureVector,
): Array<{ feature: RankFeature; value: number }> {
  return RANK_FEATURES.map((feature) => ({
    feature,
    value: model.weights[feature] * features[feature],
  })).sort((a, b) => b.value - a.value);
}

/** One step of stochastic gradient descent on log loss, regularised toward the prior. Pure. */
export function trainRanker(
  model: RankerModel,
  example: TrainingExample,
  options: TrainingOptions = {},
): RankerModel {
  const lr = options.learningRate ?? 0.08;
  const reg = options.regularization ?? 0.02;
  const error = scoreFeatures(model, example.features) - example.label;
  const weights = { ...model.weights };
  for (const name of RANK_FEATURES) {
    const gradient = error * example.features[name] + reg * (weights[name] - PRIOR_WEIGHTS[name]);
    weights[name] = weights[name] - lr * gradient;
  }
  const bias = model.bias - lr * (error + reg * (model.bias - PRIOR_BIAS));
  return { version: 1, weights, bias, updates: model.updates + 1 };
}

/** Accepts anything persisted earlier and returns a valid model, filling gaps from the prior. */
export function normalizeRanker(raw: unknown): RankerModel {
  const fresh = createRanker();
  if (typeof raw !== 'object' || raw === null) return fresh;
  const record = raw as { weights?: Record<string, unknown>; bias?: unknown; updates?: unknown };
  const weights = { ...fresh.weights };
  for (const name of RANK_FEATURES) {
    const value = record.weights?.[name];
    if (typeof value === 'number' && Number.isFinite(value)) weights[name] = value;
  }
  return {
    version: 1,
    weights,
    bias:
      typeof record.bias === 'number' && Number.isFinite(record.bias) ? record.bias : fresh.bias,
    updates:
      typeof record.updates === 'number' && Number.isFinite(record.updates)
        ? Math.max(0, Math.floor(record.updates))
        : 0,
  };
}
