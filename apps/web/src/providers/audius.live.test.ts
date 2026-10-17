import { describe, expect, it } from 'vitest';
import { createAudiusProvider } from './audius';

/**
 * Hits the real Audius API. Skipped unless AUDIUS_LIVE=1 so CI stays offline and deterministic.
 * Run: AUDIUS_LIVE=1 npx vitest run --project web src/providers/audius.live.test.ts
 */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const live = env?.['AUDIUS_LIVE'] === '1';

describe.skipIf(!live)('Audius live', () => {
  const provider = createAudiusProvider();

  it('returns streamable trending tracks with artwork and analysis fields', async () => {
    const tracks = await provider.trending({ genreId: 'lo-fi', window: 'week', limit: 20 });
    expect(tracks.length).toBeGreaterThan(5);
    const withArt = tracks.filter((track) => track.artworkUrl);
    const withBpm = tracks.filter((track) => track.bpm !== null);
    expect(withArt.length).toBeGreaterThan(tracks.length / 2);
    expect(withBpm.length).toBeGreaterThan(tracks.length / 2);
    for (const track of tracks) {
      expect(track.genreIds).toEqual(['lo-fi']);
      expect(track.durationMs).toBeGreaterThan(0);
      expect(provider.streamUrl(track)).toMatch(/\/v1\/tracks\/.+\/stream/);
    }
  }, 30_000);

  it('resolves the stream URL to audio', async () => {
    const [track] = await provider.trending({ window: 'week', limit: 1 });
    if (!track) throw new Error('no track');
    const url = provider.streamUrl(track);
    if (!url) throw new Error('no url');
    const response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' } });
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type') ?? '').toMatch(/audio/);
  }, 30_000);

  it('loads an artist, their tracks, related artists and a trending playlist', async () => {
    const [track] = await provider.trending({ genreId: 'hip-hop', window: 'month', limit: 1 });
    if (!track?.artistId) throw new Error('no track');
    const artist = await provider.artist(track.artistId);
    expect(artist?.name).toBe(track.artistName);
    expect(provider.cachedArtist(track.artistId)?.genreIds).toContain('hip-hop');
    const tracks = await provider.artistTracks(track.artistId, 5);
    expect(tracks.length).toBeGreaterThan(0);
    const related = await provider.relatedArtists(track.artistId, 3);
    expect(related.length).toBeGreaterThan(0);

    const [playlist] = await provider.trendingPlaylists(1);
    if (!playlist) throw new Error('no playlist');
    const full = await provider.playlist(playlist.id);
    expect(full?.tracks.length).toBeGreaterThan(0);
    expect(full?.playlist.trackIds).toEqual(full?.tracks.map((t) => t.id));
  }, 45_000);
});
