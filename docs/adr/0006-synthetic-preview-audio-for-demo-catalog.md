# 0006. Synthesised preview audio for the demo catalog

Date: 2026-10-17
Status: Accepted

## Context

We have no licensed catalog, and will not for a while (see ROADMAP M3). Yet the player, queue,
seek bar, listen tracking and recommendation loop all need something to play so testers can
experience the product end-to-end. Shipping copyrighted audio is out; shipping silence makes the
demo lifeless; bundling even a dozen Creative Commons tracks adds tens of megabytes to a product
that promises to be lightweight.

## Decision

Catalog tracks in the demo have no audio file. When one is played, `SynthEngine` renders a short
loop with the Web Audio API, deterministically from the track id and vibe vector: tempo from the
tempo dimension, major or minor key from valence, drum density from energy and danceability,
waveform brightness from acousticness, an arpeggio when instrumentalness is high. The loop plays
for the track's nominal duration, so seeking and progress behave like a real track.

Every catalog track is clearly labelled "demo" in the UI. Local files play real audio.

## Consequences

- The whole product is testable with zero licensing exposure and zero bundled media.
- The synth adds about 2 KB of code and no assets.
- Testers will judge the audio as what it is, a placeholder. Interviews must separate "the
  recommendations feel right" from "the music sounds good".
- The `PlaybackEngine` interface already exists, so swapping in streamed audio later is an adapter,
  not a rewrite.

## Alternatives considered

- Bundle Creative Commons MP3s: real music, but 3 to 8 MB per track and attribution handling.
- Stream from a public API with previews: network dependency, terms of service risk, and the API
  dictates the catalog instead of our vibe model.
- No playback for catalog tracks: breaks the core loop we are trying to validate.
