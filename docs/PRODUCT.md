# Weegood: product brief

## One-liner

A lightweight music player that streams real music, learns your vibe on your own device, explains
its suggestions, and treats the music you already own as a first-class citizen.

## Why now

Streaming apps have become heavy, ad-driven and opaque. Listeners increasingly describe music by
mood ("something chill for a rainy commute") rather than by genre, yet most recommendation
systems are black boxes tuned for engagement, not taste. Independent artists publish to open
networks that the big apps ignore. And a large group of listeners still own files that no major
service lets them mix into their playlists comfortably.

Weegood sits in that gap: fast, honest about why it recommends something, sourced from an open
network, and happy to play what is already on your device.

## Who it is for

| Persona                        | Need                                                 | What Weegood gives them                                            |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------ |
| **Maya, 24, mood listener**    | Finds music by feeling, distrusts opaque algorithms  | Vibe-based picks with a one-line reason each, a model that is hers |
| **Dev, 35, collector**         | Owns thousands of files, wants them beside streaming | Import local files, mix them into any playlist, same player        |
| **Sam, 29, social discoverer** | Discovers through what people they trust share       | Follow artists and curators; their reposts and playlists feed home |

## The core concept: vibe

Every track carries a small **vibe vector**: energy, valence (positivity), danceability,
acousticness, instrumentalness and tempo, each normalised to 0..1. It starts as a prior from the
track's metadata (genre, mood, tags, BPM, key) and is replaced by a measurement of the actual audio
the first time the track plays. A listener's **taste profile** is a vibe vector, genre, mood and
artist affinities, and a small ranking model that learns from what they finish and what they skip.
Recommendation is that model plus deliberate variety, and each pick carries the reason it was
chosen, read straight off the model's arithmetic.

## Where the music comes from

Audius, an open music network where artists publish directly and anyone can stream for free. Full
length, no account, no key. Every track links back to its artist. It leans independent and
electronic; mainstream catalogs arrive as further providers that use the listener's own paid
accounts (see ROADMAP M2). Your own files play from your device.

## MVP scope (web)

In:

- Onboarding questionnaire (genres, moods, live artists for those genres, listening context) that
  seeds the taste profile; returning visitors skip it.
- Home feed: "For you", "Because you follow", "From people you follow", "Big right now", "Fresh vibes".
- Browse genres with trending and rising tracks; genre pages ordered for you or by plays.
- Artist pages with tracks, playlists and related artists; follow and unfollow.
- People: search and follow artists and curators; what they repost and playlist feeds your home.
- Playlists: create, rename, delete, add, remove, reorder; save any Audius playlist to your library;
  suggestions seeded from the playlist's own vibe. Playlists mix streamed and local tracks.
- Local files: import MP3, WAV, FLAC, OGG, AAC; stored on-device; playable; addable to playlists.
- Player: play, pause, previous, next, seek, volume, shuffle, repeat, queue, prefetch of the next
  track, automatic skip past broken streams.
- On-device audio analysis and a per-listener ranking model that learns from listens.
- Search across Audius tracks, artists and playlists, plus local files and own playlists.
- Settings: profile and model insight, export and import, storage, reset.

Out (deliberately, for now):

- Accounts and sync (ROADMAP M3).
- Mainstream catalogs: Spotify and others need the listener's own subscription and app registration
  (ROADMAP M2).
- Lyrics, podcasts, payments, ads.

## Success criteria for the MVP

We consider the concept validated when, with a group of 20 to 30 testers over two weeks:

| Metric                    | Target            | Definition                                             |
| ------------------------- | ----------------- | ------------------------------------------------------ |
| Onboarding completion     | >= 80%            | Reached the home feed after starting the questionnaire |
| Recommendation acceptance | >= 35%            | A "For you" track played for at least 30 s             |
| Playlist creation         | >= 50% of testers | Created at least one playlist with 3+ tracks           |
| Local import success      | >= 90%            | Import attempts that produced a playable track         |
| Perceived speed           | "fast" or better  | Post-test survey, 5-point scale                        |

Measurement is local and opt-in in the MVP (see ROADMAP M2). We do not phone home by default.

## Non-negotiables

- Honest sourcing: open networks and the listener's own accounts and files. No scraping, no
  re-streaming against a service's terms.
- Lightweight: initial JS under 150 KB gzipped for the web MVP.
- Private: no network calls beyond anonymous music requests without an explicit user action.
- Explainable: no recommendation without a reason the user can read.
- Portable core: nothing in `packages/core` depends on the browser.
