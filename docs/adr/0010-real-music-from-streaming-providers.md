# 0010. Real music from streaming providers, Audius first

Date: 2026-10-17
Status: Accepted. Supersedes 0006.

## Context

The demo catalog with synthesised previews (ADR 0006) let us build the loop, but it is not a
product: nobody wants to listen to a placeholder. We need real, full-length songs, streamed, with
no licensing exposure for us and no accounts or keys for the listener, and the client must stay
lightweight.

We probed the options. YouTube and SoundCloud forbid the use we need or have closed their APIs.
Spotify and Apple Music stream real catalogs but only through the listener's own paid account and
a registered developer app. Jamendo requires a client id. Audius is an open music network with a
public, keyless API, full-length MP3 streams served from content nodes with permissive CORS, and
rich per-track metadata: genre, mood, tags, play and repost counts and, on nearly every upload,
server-analysed BPM and musical key.

## Decision

- Music comes from **providers** behind one interface (`MusicProvider`): trending by genre,
  search, tracks by id, artists and their tracks, reposts, playlists, and a stream URL.
- **Audius is the first provider.** It is the default and needs no configuration.
- Playback is plain HTML5 audio pointed at the provider's stream URL. The browser handles
  progressive download, range requests and redirects; a second element pre-buffers the next track.
  No custom streaming stack, no service worker in the audio path.
- The synthesiser and the fake catalog are gone from the product. The fake catalog survives only as
  a test fixture so engine and store tests stay deterministic and offline.
- Every streamed track links back to its page on Audius, and the artist page links to the artist.
- Our genre taxonomy maps to Audius genre names; Audius moods feed the vibe prior (ADR 0011).

## Consequences

- Real songs, full length, free, with no keys to manage and no licensing exposure for Weegood.
  The repertoire is independent and electronic-leaning rather than mainstream chart music.
- The app now depends on a third-party service being up. Views degrade to an explicit error with
  a retry, and anything the listener touched (plays, likes, playlists) is cached on the device so
  the library still renders offline.
- Mainstream catalogs remain possible as further providers behind the same interface: Spotify
  through the Web Playback SDK for Premium subscribers with their own client id, Jamendo with a
  free client id. Both are roadmap items; both are adapters, not rewrites.

## Alternatives considered

- Scraping or re-streaming services that forbid it: not something we will ship, whatever the
  personal-use argument.
- Bundled Creative Commons files: real but tiny and heavy.
- Spotify first: real mainstream catalog, but only for Premium subscribers who also register a
  developer app, and recommendation data endpoints are closed to new apps.
