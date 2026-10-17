import { describe, expect, it } from 'vitest';
import { isVibeVector } from '../domain/vibe';
import {
  audiusNameForGenre,
  FEATURED_GENRES,
  genreById,
  genreIdForAudiusName,
  GENRES,
} from './genres';

describe('genre taxonomy', () => {
  it('has unique ids and provider names, valid vibes and a featured subset', () => {
    const ids = GENRES.map((genre) => genre.id);
    expect(new Set(ids).size).toBe(ids.length);
    const audiusNames = GENRES.map((genre) => genre.providerNames.audius);
    expect(new Set(audiusNames).size).toBe(audiusNames.length);
    for (const genre of GENRES) expect(isVibeVector(genre.vibe)).toBe(true);
    expect(FEATURED_GENRES.length).toBeGreaterThanOrEqual(12);
    expect(FEATURED_GENRES.length).toBeLessThan(GENRES.length);
  });

  it('maps provider names both ways, ignoring case', () => {
    expect(genreIdForAudiusName('Hip-Hop/Rap')).toBe('hip-hop');
    expect(genreIdForAudiusName('drum & bass')).toBe('drum-and-bass');
    expect(genreIdForAudiusName('Podcasts')).toBeNull();
    expect(genreIdForAudiusName(null)).toBeNull();
    expect(audiusNameForGenre('rnb')).toBe('R&B/Soul');
    expect(genreById('nope')).toBeUndefined();
  });
});
