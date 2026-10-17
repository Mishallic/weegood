# 0011. On-device learned ranking and audio analysis

Date: 2026-10-17
Status: Accepted. Extends 0005.

## Context

ADR 0005 chose a content-based engine with hand-set term weights. Two things were missing for it to
deserve the word "learning": the weights never changed, and the vibe vectors were authored, not
measured. With a real catalog (ADR 0010) we have the raw material to fix both, and the privacy
promise means it has to happen on the device.

## Decision

Three layers, all local, all explainable:

1. **Metadata prior.** A track's first vibe estimate comes from its genre centre, bent by the
   provider's mood label, tags, server-analysed BPM and key. Deterministic and instant.
2. **Measured vibe.** The first time a streamed track plays, the app fetches its first ~45 seconds,
   decodes them, and extracts features in a worker: loudness, spectral centroid, bass ratio,
   spectral flatness, tempo by onset autocorrelation, beat strength, and major/minor by chroma
   correlation. These map onto the vibe dimensions we can hear; valence blends with the prior and
   instrumentalness stays with the prior. Results are cached per track and shared by every view.
3. **Learned ranker.** Scoring is logistic regression over named features: vibe match, genre,
   mood and artist affinity, popularity, follow boosts, people signals, novelty, recency and skip
   penalties. Weights start at a hand-set prior so day one is sensible, and each completed play or
   early skip takes one stochastic gradient step, regularised toward the prior so a few sessions
   cannot wreck it. Reasons are read off the per-feature contributions, so the explanation and the
   score are the same arithmetic.

## Consequences

- The system learns what predicts _this_ listener's completions, not what we guessed. A listener
  who finishes anything popular ends up with a popularity-heavy model; one who only finishes vibe
  matches ends up vibe-heavy. Tests cover both.
- Measurement costs about a megabyte of download and well under a second of CPU per new track,
  once, and only for tracks that actually play.
- Everything is classic signal processing and linear models. Neural audio embeddings (for example
  YAMNet class probabilities, or a small CLAP-style model) are the natural next layer: they would
  give a far better instrumentalness and genre signal at the cost of a model download. Tracked in
  the roadmap, behind the same `MeasuredVibe` cache.
- A natural-language "AI DJ" that turns a sentence into a query and explanation is a separate,
  optional layer that would need a model API key; it is on the roadmap, not in the model.

## Alternatives considered

- Bandit-style exploration bonuses: complementary, not a replacement; novelty is a feature today.
- Server-side collaborative filtering: still planned for M3 as another feature, once there is a
  backend with enough listeners; the device model stays as the cold-start path.
- Shipping a neural embedding model now: heavier, untestable without a browser in our pipeline
  today, and the DSP features already move the needle.
