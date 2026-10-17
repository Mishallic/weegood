# Weegood: product brief

## One-liner

A lightweight music player that learns your vibe, explains its suggestions, and treats the music
you already own as a first-class citizen.

## Why now

Streaming apps have become heavy, ad-driven and opaque. Listeners increasingly describe music by
mood ("something chill for a rainy commute") rather than by genre, yet most recommendation
systems are black boxes tuned for engagement, not taste. At the same time, a large group of
listeners still own files (Bandcamp purchases, rips, DJ pools, bootlegs) that no major service
lets them mix into their playlists comfortably.

Weegood sits in that gap: fast, honest about why it recommends something, and happy to play what
is already on your device.

## Who it is for

| Persona                        | Need                                                 | What Weegood gives them                                           |
| ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **Maya, 24, mood listener**    | Finds music by feeling, distrusts opaque algorithms  | Vibe-based picks with a one-line reason each, easy to steer       |
| **Dev, 35, collector**         | Owns thousands of files, wants them beside streaming | Import local files, mix them into any playlist, same player       |
| **Sam, 29, social discoverer** | Discovers through friends' playlists                 | Follow people, artists and genres; their picks feed the home feed |

## The core concept: vibe

Every track carries a small **vibe vector**: energy, valence (positivity), danceability,
acousticness, instrumentalness and tempo, each normalised to 0..1. A listener's **taste profile**
is a vibe vector plus genre and artist affinities. Recommendation is similarity plus a little
deliberate variety, and each pick carries the reason it was chosen. The model is simple enough to
explain in a sentence, which is the point.

## MVP scope (web)

In:

- Onboarding questionnaire (genres, moods, a few artists, listening context) that seeds the taste
  profile; returning visitors skip it because the profile is persisted on-device.
- Home feed: "For you", "Because you follow", "From people you follow", "Fresh vibes".
- Browse genres and artists; follow or unfollow any of them.
- People: demo profiles with public playlists; follow them.
- Playlists: create, rename, delete, add, remove, reorder. Playlists can hold local and catalog
  tracks together.
- Local files: import MP3, WAV, FLAC, OGG, AAC; stored on-device; playable; addable to playlists.
- Player: play, pause, previous, next, seek, volume, shuffle, repeat, queue.
- Likes and listening history feed the profile continuously.
- Search across tracks, artists, genres and people.
- Settings: export and import your data, reset the profile.

Out (deliberately, for now):

- Accounts, sync, a real social graph between real users (see ROADMAP M3).
- Licensed streaming catalog. Catalog tracks in the MVP come from a seeded demo catalog with
  synthesised preview audio (see ADR 0006).
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

- Lightweight: initial JS under 150 KB gzipped for the web MVP.
- Private: no network calls without an explicit user action.
- Explainable: no recommendation without a reason the user can read.
- Portable core: nothing in `packages/core` depends on the browser.
