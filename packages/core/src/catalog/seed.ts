import type { Artist, Id, Playlist, Track } from '../domain/types';
import { jitterVibe, vibe, type VibeVector } from '../domain/vibe';
import { createRng, type Rng } from '../util/prng';
import { genreById } from './genres';
import type { Catalog } from './catalogIndex';

/**
 * TEST FIXTURE ONLY. A deterministic fake catalog so engine, feed and store tests have a stable
 * world with known shapes. It is never shown to users: the product streams real music through
 * providers (ADR 0010). Everything here is fictional.
 */

const SEED_EPOCH = Date.UTC(2026, 0, 1);

interface ArtistDef {
  id: Id;
  name: string;
  genreIds: Id[];
  bio: string;
  vibe: Partial<VibeVector>;
  followerCount: number;
}

const ARTIST_DEFS: readonly ArtistDef[] = [
  {
    id: 'paper-lanterns',
    name: 'Paper Lanterns',
    genreIds: ['lo-fi'],
    bio: 'Bedroom producer turning rainy afternoons into loops.',
    vibe: { valence: 0.65 },
    followerCount: 48_200,
  },
  {
    id: 'komori-tapes',
    name: 'Komori Tapes',
    genreIds: ['lo-fi', 'jazz'],
    bio: 'Cassette samples, upright bass, one lamp.',
    vibe: { acousticness: 0.7, tempo: 0.25 },
    followerCount: 21_900,
  },
  {
    id: 'the-saltmarsh',
    name: 'The Saltmarsh',
    genreIds: ['alternative'],
    bio: 'Four friends with one van and many choruses.',
    vibe: { energy: 0.7, valence: 0.6 },
    followerCount: 133_000,
  },
  {
    id: 'velvet-antlers',
    name: 'Velvet Antlers',
    genreIds: ['alternative', 'folk'],
    bio: 'Harmonies first, distortion second.',
    vibe: { energy: 0.55, acousticness: 0.55 },
    followerCount: 61_400,
  },
  {
    id: 'juno-ward',
    name: 'Juno Ward',
    genreIds: ['hip-hop'],
    bio: 'Sharp pen, warm beats, zero filler.',
    vibe: { valence: 0.6, danceability: 0.85 },
    followerCount: 410_000,
  },
  {
    id: 'marrow-and-bone',
    name: 'Marrow & Bone',
    genreIds: ['hip-hop', 'rnb'],
    bio: 'Duo. One sings, one does not, both write.',
    vibe: { energy: 0.6, acousticness: 0.25 },
    followerCount: 97_300,
  },
  {
    id: 'delphine-rey',
    name: 'Delphine Rey',
    genreIds: ['house'],
    bio: 'Piano stabs and sunrise sets.',
    vibe: { valence: 0.85 },
    followerCount: 212_000,
  },
  {
    id: 'sunroom-collective',
    name: 'Sunroom Collective',
    genreIds: ['house', 'rnb'],
    bio: 'Live band house with real horns.',
    vibe: { acousticness: 0.3, instrumentalness: 0.4 },
    followerCount: 54_800,
  },
  {
    id: 'kessler-grid',
    name: 'Kessler Grid',
    genreIds: ['techno'],
    bio: 'Modular racks, no vocals on principle.',
    vibe: { energy: 0.9 },
    followerCount: 88_100,
  },
  {
    id: 'nullfield',
    name: 'Nullfield',
    genreIds: ['techno', 'ambient'],
    bio: 'Techno that remembers it was once ambient.',
    vibe: { energy: 0.6, tempo: 0.6, valence: 0.3 },
    followerCount: 39_700,
  },
  {
    id: 'oona-vasquez-trio',
    name: 'Oona Vasquez Trio',
    genreIds: ['jazz'],
    bio: 'Piano trio. Standards, bent gently.',
    vibe: { energy: 0.4, tempo: 0.45 },
    followerCount: 27_600,
  },
  {
    id: 'blue-hour-quartet',
    name: 'Blue Hour Quartet',
    genreIds: ['jazz', 'classical'],
    bio: 'Chamber jazz for the hour after sunset.',
    vibe: { energy: 0.3, instrumentalness: 0.95 },
    followerCount: 14_200,
  },
  {
    id: 'glacier-mail',
    name: 'Glacier Mail',
    genreIds: ['ambient'],
    bio: 'Field recordings from places with no roads.',
    vibe: { valence: 0.55 },
    followerCount: 33_000,
  },
  {
    id: 'signal-fade',
    name: 'Signal Fade',
    genreIds: ['ambient', 'lo-fi'],
    bio: 'Drones with a pulse.',
    vibe: { energy: 0.25, danceability: 0.25, tempo: 0.25 },
    followerCount: 18_400,
  },
  {
    id: 'imani-rowe',
    name: 'Imani Rowe',
    genreIds: ['rnb'],
    bio: 'Voice like a late text you wanted.',
    vibe: { valence: 0.6 },
    followerCount: 540_000,
  },
  {
    id: 'theo-lacroix',
    name: 'Theo Lacroix',
    genreIds: ['rnb', 'pop'],
    bio: 'Falsetto, synths, heartbreak on the hour.',
    vibe: { energy: 0.6, valence: 0.45 },
    followerCount: 305_000,
  },
  {
    id: 'lux-marlowe',
    name: 'Lux Marlowe',
    genreIds: ['pop'],
    bio: 'Stadium hooks from a studio apartment.',
    vibe: { energy: 0.75, valence: 0.85 },
    followerCount: 1_200_000,
  },
  {
    id: 'honeyglass',
    name: 'Honeyglass',
    genreIds: ['pop', 'alternative'],
    bio: 'Sugar with a crack in it.',
    vibe: { energy: 0.65, acousticness: 0.35 },
    followerCount: 178_000,
  },
  {
    id: 'wren-and-the-orchard',
    name: 'Wren & the Orchard',
    genreIds: ['folk'],
    bio: 'Banjo, cello and songs about leaving.',
    vibe: { valence: 0.45 },
    followerCount: 42_900,
  },
  {
    id: 'callum-fairweather',
    name: 'Callum Fairweather',
    genreIds: ['folk', 'alternative'],
    bio: 'One guitar, big weather.',
    vibe: { energy: 0.45, valence: 0.4 },
    followerCount: 66_700,
  },
  {
    id: 'ironwake',
    name: 'Ironwake',
    genreIds: ['metal'],
    bio: 'Riffs measured in tonnes.',
    vibe: { energy: 0.98, tempo: 0.9 },
    followerCount: 150_000,
  },
  {
    id: 'pale-cathedral',
    name: 'Pale Cathedral',
    genreIds: ['metal', 'classical'],
    bio: 'Doom metal with a string section.',
    vibe: { energy: 0.8, tempo: 0.5, acousticness: 0.25, instrumentalness: 0.5 },
    followerCount: 58_300,
  },
  {
    id: 'elias-morgenstern',
    name: 'Elias Morgenstern',
    genreIds: ['classical'],
    bio: 'Pianist. Nocturnes, mostly.',
    vibe: { energy: 0.3, tempo: 0.3 },
    followerCount: 29_800,
  },
  {
    id: 'aurelia-strings',
    name: 'Aurelia Strings',
    genreIds: ['classical', 'ambient'],
    bio: 'A string ensemble that likes long notes.',
    vibe: { energy: 0.35, tempo: 0.3, valence: 0.55 },
    followerCount: 23_500,
  },
];

const MOODS_BY_GENRE: Record<string, string[]> = {
  'lo-fi': ['Peaceful', 'Easygoing', 'Melancholy'],
  alternative: ['Cool', 'Melancholy', 'Fiery'],
  'hip-hop': ['Empowering', 'Fiery', 'Cool'],
  house: ['Energizing', 'Upbeat', 'Cool'],
  techno: ['Fiery', 'Defiant', 'Energizing'],
  jazz: ['Peaceful', 'Sophisticated', 'Cool'],
  ambient: ['Peaceful', 'Tender', 'Yearning'],
  rnb: ['Romantic', 'Sensual', 'Cool'],
  pop: ['Upbeat', 'Sentimental', 'Excited'],
  folk: ['Peaceful', 'Melancholy', 'Sentimental'],
  metal: ['Aggressive', 'Fiery', 'Gritty'],
  classical: ['Peaceful', 'Romantic', 'Serious'],
};

const ADJECTIVES = [
  'Midnight',
  'Neon',
  'Paper',
  'Golden',
  'Quiet',
  'Velvet',
  'Electric',
  'Hollow',
  'Faded',
  'Wild',
  'Silver',
  'Lunar',
  'Broken',
  'Secret',
  'Slow',
  'Honest',
  'Blue',
  'Static',
  'Distant',
  'Tender',
  'Copper',
  'Heavy',
  'Pale',
  'Northern',
];
const NOUNS = [
  'Rivers',
  'Signals',
  'Lanterns',
  'Weather',
  'Streets',
  'Gardens',
  'Echoes',
  'Horizon',
  'Letters',
  'Engines',
  'Tides',
  'Windows',
  'Avenues',
  'Satellites',
  'Ghosts',
  'Harbor',
  'Fireflies',
  'Mirrors',
  'Orbit',
  'Summer',
  'Static',
  'Pulse',
  'Cathedral',
  'Meadow',
];
const TIMES = ['Dawn', 'Dusk', 'Midnight', 'Noon', '3AM', 'Sunday'];
const TITLE_SHAPES: ReadonlyArray<(rng: Rng) => string> = [
  (rng) => `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`,
  (rng) => rng.pick(NOUNS),
  (rng) => `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`,
  (rng) => `${rng.pick(NOUNS)} at ${rng.pick(TIMES)}`,
  (rng) =>
    `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)} (${rng.pick(['Reprise', 'Live', 'Demo', 'Edit'])})`,
];
const TRACKS_PER_ARTIST = 4;

const PLAYLIST_DEFS: ReadonlyArray<{
  id: Id;
  ownerId: Id;
  name: string;
  description: string;
  genreIds: Id[];
}> = [
  {
    id: 'pl-late-study',
    ownerId: 'komori-tapes',
    name: 'Late Study',
    description: 'Head down, lights low.',
    genreIds: ['lo-fi'],
  },
  {
    id: 'pl-block-party',
    ownerId: 'juno-ward',
    name: 'Block Party',
    description: 'Bring a speaker, bring a friend.',
    genreIds: ['hip-hop', 'house'],
  },
  {
    id: 'pl-porch-light',
    ownerId: 'callum-fairweather',
    name: 'Porch Light',
    description: 'For the hour the bugs come out.',
    genreIds: ['alternative', 'folk'],
  },
  {
    id: 'pl-grid-lines',
    ownerId: 'nullfield',
    name: 'Grid Lines',
    description: 'Straight lines, no vocals.',
    genreIds: ['techno', 'ambient'],
  },
  {
    id: 'pl-soft-launch',
    ownerId: 'imani-rowe',
    name: 'Soft Launch',
    description: 'Glossy, gentle, a little dramatic.',
    genreIds: ['rnb', 'pop'],
  },
  {
    id: 'pl-loud-hours',
    ownerId: 'ironwake',
    name: 'Loud Hours',
    description: 'Neighbours have been warned.',
    genreIds: ['metal'],
  },
];

export function buildDemoCatalog(): Catalog {
  const artists: Artist[] = ARTIST_DEFS.map((def) => {
    const primary = genreById(def.genreIds[0] ?? '');
    if (!primary) throw new Error(`Unknown genre for fixture artist ${def.id}`);
    return {
      id: def.id,
      name: def.name,
      handle: def.id,
      genreIds: [...def.genreIds],
      bio: def.bio,
      vibe: vibe({ ...primary.vibe, ...def.vibe }),
      followerCount: def.followerCount,
      trackCount: TRACKS_PER_ARTIST,
      avatarUrl: null,
      verified: false,
      provider: 'demo',
      externalId: def.id,
    };
  });

  const tracks: Track[] = [];
  for (const artist of artists) {
    const rng = createRng(`track:${artist.id}`);
    const primaryGenreId = artist.genreIds[0] ?? '';
    const titles = new Set<string>();
    for (let n = 1; n <= TRACKS_PER_ARTIST; n++) {
      let title = rng.pick(TITLE_SHAPES)(rng);
      while (titles.has(title)) title = rng.pick(TITLE_SHAPES)(rng);
      titles.add(title);
      const genreIds =
        n % 2 === 0 && artist.genreIds.length > 1 ? [...artist.genreIds] : [primaryGenreId];
      const playCount = rng.int(200, 400_000);
      tracks.push({
        id: `${artist.id}-${n}`,
        title,
        artistId: artist.id,
        artistName: artist.name,
        genreIds,
        mood: rng.pick(MOODS_BY_GENRE[primaryGenreId] ?? ['Cool']),
        tags: [],
        durationMs: rng.int(150, 330) * 1000,
        year: rng.int(2014, 2026),
        artworkUrl: null,
        popularity: Math.min(1, Math.log10(1 + playCount) / 6),
        playCount,
        bpm: null,
        musicalKey: null,
        vibe: jitterVibe(artist.vibe, 0.12, rng.next),
        vibeSource: 'prior',
        source: {
          kind: 'stream',
          provider: 'demo',
          externalId: `${artist.id}-${n}`,
          permalink: null,
        },
      });
    }
  }

  const tracksByGenre = new Map<Id, Track[]>();
  for (const track of tracks) {
    for (const genreId of track.genreIds) {
      const list = tracksByGenre.get(genreId);
      if (list) list.push(track);
      else tracksByGenre.set(genreId, [track]);
    }
  }

  const playlists: Playlist[] = PLAYLIST_DEFS.map((def, index) => {
    const rng = createRng(`playlist:${def.id}`);
    const pool = def.genreIds.flatMap((genreId) => tracksByGenre.get(genreId) ?? []);
    const unique = [...new Map(pool.map((track) => [track.id, track])).values()];
    const picked = rng.shuffle(unique).slice(0, Math.min(10, unique.length));
    const owner = artists.find((artist) => artist.id === def.ownerId);
    const createdAt = SEED_EPOCH + index * 86_400_000;
    return {
      id: def.id,
      ownerId: def.ownerId,
      ownerName: owner?.name ?? null,
      name: def.name,
      description: def.description,
      trackIds: picked.map((track) => track.id),
      artworkUrl: null,
      isPublic: true,
      provider: 'demo',
      externalId: def.id,
      createdAt,
      updatedAt: createdAt,
    };
  });

  return { artists, tracks, playlists };
}

/** Built once per module load; cheap and deterministic. Tests only. */
export const DEMO_CATALOG: Catalog = buildDemoCatalog();
