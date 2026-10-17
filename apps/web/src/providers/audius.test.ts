import { describe, expect, it } from 'vitest';
import { createAudiusProvider } from './audius';
import fixture from './__fixtures__/audius-trending.json';

interface Call {
  url: URL;
}

function fakeFetch(bodies: Record<string, unknown>, calls: Call[]): typeof fetch {
  return async (input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    calls.push({ url });
    const key = Object.keys(bodies).find((path) => url.pathname.endsWith(path));
    if (!key) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify({ data: bodies[key] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

describe('Audius provider', () => {
  it('maps trending tracks from the real API shape', async () => {
    const calls: Call[] = [];
    const provider = createAudiusProvider({
      fetch: fakeFetch({ '/tracks/trending': fixture.data }, calls),
    });
    const tracks = await provider.trending({ genreId: 'hip-hop', window: 'week', limit: 3 });

    const request = calls[0]?.url;
    expect(request?.searchParams.get('genre')).toBe('Hip-Hop/Rap');
    expect(request?.searchParams.get('time')).toBe('week');
    expect(request?.searchParams.get('app_name')).toBe('weegood');

    expect(tracks.length).toBe(fixture.data.length);
    const first = tracks[0];
    const raw = fixture.data[0];
    if (!first || !raw) throw new Error('fixture empty');
    expect(first.id).toBe(`audius:${raw.id}`);
    expect(first.artistId).toBe(`audius:${raw.user.id}`);
    expect(first.artistName).toBe(raw.user.name);
    expect(first.genreIds).toEqual(['hip-hop']);
    expect(first.durationMs).toBe(raw.duration * 1000);
    expect(first.artworkUrl).toBe(raw.artwork['480x480']);
    expect(first.playCount).toBe(raw.play_count);
    expect(first.popularity).toBeGreaterThan(0);
    expect(first.popularity).toBeLessThanOrEqual(1);
    expect(first.bpm).toBe(raw.bpm);
    expect(first.musicalKey).toBe(raw.musical_key);
    expect(first.vibeSource).toBe('prior');
    expect(first.source).toEqual({
      kind: 'stream',
      provider: 'audius',
      externalId: raw.id,
      permalink: raw.permalink,
    });
  });

  it('turns BPM and key into the vibe prior', async () => {
    const provider = createAudiusProvider({
      fetch: fakeFetch({ '/tracks/trending': fixture.data }, []),
    });
    const tracks = await provider.trending();
    for (const track of tracks) {
      if (track.bpm === null) continue;
      const folded = track.bpm < 60 ? track.bpm * 2 : track.bpm > 180 ? track.bpm / 2 : track.bpm;
      expect(track.vibe.tempo).toBeCloseTo((Math.round(folded) - 60) / 120, 2);
    }
  });

  it('drops gated, unlisted and non-streamable tracks', async () => {
    const [a, b, c] = fixture.data;
    if (!a || !b || !c) throw new Error('fixture too small');
    const provider = createAudiusProvider({
      fetch: fakeFetch(
        {
          '/tracks/search': [
            { ...a, is_stream_gated: true },
            { ...b, is_unlisted: true },
            { ...c, is_streamable: false },
            { ...c, id: 'ok1' },
          ],
        },
        [],
      ),
    });
    const tracks = await provider.searchTracks('anything');
    expect(tracks.map((track) => track.id)).toEqual(['audius:ok1']);
  });

  it('builds stream URLs through the API redirect and rejects foreign ids', async () => {
    const provider = createAudiusProvider({ fetch: fakeFetch({}, []) });
    const [raw] = fixture.data;
    if (!raw) throw new Error('fixture empty');
    const [track] = await createAudiusProvider({
      fetch: fakeFetch({ '/tracks/trending': [raw] }, []),
    }).trending();
    if (!track) throw new Error('no track');
    expect(provider.streamUrl(track)).toBe(
      `https://api.audius.co/v1/tracks/${raw.id}/stream?app_name=weegood`,
    );
    await expect(provider.artist('spotify:123')).rejects.toThrow(/Not an Audius id/);
  });

  it('fetches tracks by id in batches and surfaces HTTP errors', async () => {
    const calls: Call[] = [];
    const provider = createAudiusProvider({ fetch: fakeFetch({ '/tracks': fixture.data }, calls) });
    const tracks = await provider.tracksByIds(['audius:a', 'audius:b', 'local:x']);
    expect(calls[0]?.url.searchParams.getAll('id')).toEqual(['a', 'b']);
    expect(tracks.length).toBe(fixture.data.length);

    const failing = createAudiusProvider({
      fetch: async () => new Response('boom', { status: 503 }),
    });
    await expect(failing.underground()).rejects.toThrow(/503/);
  });
});
