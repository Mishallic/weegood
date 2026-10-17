import type { Artist, Genre, Id, Playlist, Track, User } from '../domain/types';
import { centroid, jitterVibe, vibe, type VibeVector } from '../domain/vibe';
import { createRng, type Rng } from '../util/prng';
import type { Catalog } from './catalogIndex';

/**
 * The demo catalog (ADR 0006). Genres and artists are authored by hand so their vibes are
 * meaningful; tracks, titles and demo playlists are generated deterministically from a seed so the
 * catalog is identical on every device and in every test, with no data files to ship.
 *
 * Everything here is fictional. Any resemblance to real artists is accidental.
 */

const SEED_EPOCH = Date.UTC(2026, 0, 1);

interface GenreDef {
  id: Id;
  name: string;
  description: string;
  hue: number;
  vibe: Partial<VibeVector>;
  /** Track length range in seconds. */
  duration: [number, number];
}

const GENRE_DEFS: readonly GenreDef[] = [
  {
    id: 'lofi',
    name: 'Lo-fi',
    description: 'Dusty beats, tape hiss and rainy-window calm.',
    hue: 265,
    vibe: {
      energy: 0.3,
      valence: 0.55,
      danceability: 0.45,
      acousticness: 0.55,
      instrumentalness: 0.85,
      tempo: 0.3,
    },
    duration: [120, 240],
  },
  {
    id: 'indie-rock',
    name: 'Indie Rock',
    description: 'Guitars with feelings, choruses you shout in the car.',
    hue: 15,
    vibe: {
      energy: 0.65,
      valence: 0.55,
      danceability: 0.5,
      acousticness: 0.4,
      instrumentalness: 0.15,
      tempo: 0.6,
    },
    duration: [180, 300],
  },
  {
    id: 'hip-hop',
    name: 'Hip-Hop',
    description: 'Bars, bounce and bass you feel in your chest.',
    hue: 40,
    vibe: {
      energy: 0.7,
      valence: 0.55,
      danceability: 0.8,
      acousticness: 0.15,
      instrumentalness: 0.1,
      tempo: 0.5,
    },
    duration: [150, 270],
  },
  {
    id: 'house',
    name: 'House',
    description: 'Four on the floor, hands in the air, sunrise optional.',
    hue: 195,
    vibe: {
      energy: 0.75,
      valence: 0.75,
      danceability: 0.9,
      acousticness: 0.1,
      instrumentalness: 0.6,
      tempo: 0.7,
    },
    duration: [240, 420],
  },
  {
    id: 'techno',
    name: 'Techno',
    description: 'Hypnotic, industrial, relentless. Built for warehouses.',
    hue: 225,
    vibe: {
      energy: 0.85,
      valence: 0.35,
      danceability: 0.8,
      acousticness: 0.05,
      instrumentalness: 0.9,
      tempo: 0.75,
    },
    duration: [300, 480],
  },
  {
    id: 'jazz',
    name: 'Jazz',
    description: 'Improvised, swinging, smoky. Late nights since the twenties.',
    hue: 45,
    vibe: {
      energy: 0.45,
      valence: 0.55,
      danceability: 0.45,
      acousticness: 0.85,
      instrumentalness: 0.75,
      tempo: 0.5,
    },
    duration: [200, 420],
  },
  {
    id: 'ambient',
    name: 'Ambient',
    description: 'Slow weather for the mind. Texture over rhythm.',
    hue: 175,
    vibe: {
      energy: 0.15,
      valence: 0.5,
      danceability: 0.1,
      acousticness: 0.4,
      instrumentalness: 0.95,
      tempo: 0.15,
    },
    duration: [240, 540],
  },
  {
    id: 'rnb',
    name: 'R&B',
    description: 'Smooth, soulful, a little bit after midnight.',
    hue: 320,
    vibe: {
      energy: 0.5,
      valence: 0.55,
      danceability: 0.7,
      acousticness: 0.3,
      instrumentalness: 0.05,
      tempo: 0.45,
    },
    duration: [180, 270],
  },
  {
    id: 'pop',
    name: 'Pop',
    description: 'Hooks, gloss and a chorus in under forty seconds.',
    hue: 340,
    vibe: {
      energy: 0.7,
      valence: 0.8,
      danceability: 0.75,
      acousticness: 0.2,
      instrumentalness: 0.05,
      tempo: 0.6,
    },
    duration: [160, 230],
  },
  {
    id: 'folk',
    name: 'Folk',
    description: 'Wooden instruments, honest words, a porch somewhere.',
    hue: 90,
    vibe: {
      energy: 0.35,
      valence: 0.5,
      danceability: 0.3,
      acousticness: 0.95,
      instrumentalness: 0.15,
      tempo: 0.4,
    },
    duration: [180, 320],
  },
  {
    id: 'metal',
    name: 'Metal',
    description: 'Heavy, fast, cathartic. Riffs as architecture.',
    hue: 0,
    vibe: {
      energy: 0.95,
      valence: 0.3,
      danceability: 0.35,
      acousticness: 0.05,
      instrumentalness: 0.3,
      tempo: 0.85,
    },
    duration: [200, 360],
  },
  {
    id: 'classical',
    name: 'Classical',
    description: 'Centuries of structure and feeling, no vocals required.',
    hue: 55,
    vibe: {
      energy: 0.4,
      valence: 0.5,
      danceability: 0.15,
      acousticness: 0.95,
      instrumentalness: 0.95,
      tempo: 0.4,
    },
    duration: [180, 600],
  },
];

interface ArtistDef {
  id: Id;
  name: string;
  genreIds: Id[];
  bio: string;
  /** Offsets from the primary genre's vibe. */
  vibe: Partial<VibeVector>;
  followerCount: number;
}

const ARTIST_DEFS: readonly ArtistDef[] = [
  {
    id: 'paper-lanterns',
    name: 'Paper Lanterns',
    genreIds: ['lofi'],
    bio: 'Bedroom producer from Lisbon turning rainy afternoons into loops.',
    vibe: { valence: 0.65 },
    followerCount: 48_200,
  },
  {
    id: 'komori-tapes',
    name: 'Komori Tapes',
    genreIds: ['lofi', 'jazz'],
    bio: 'Cassette samples, upright bass, one lamp.',
    vibe: { acousticness: 0.7, tempo: 0.25 },
    followerCount: 21_900,
  },
  {
    id: 'the-saltmarsh',
    name: 'The Saltmarsh',
    genreIds: ['indie-rock'],
    bio: 'Four friends from a coastal town with one van and many choruses.',
    vibe: { energy: 0.7, valence: 0.6 },
    followerCount: 133_000,
  },
  {
    id: 'velvet-antlers',
    name: 'Velvet Antlers',
    genreIds: ['indie-rock', 'folk'],
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
    bio: 'Paris via Detroit. Piano stabs and sunrise sets.',
    vibe: { valence: 0.85 },
    followerCount: 212_000,
  },
  {
    id: 'sunroom-collective',
    name: 'Sunroom Collective',
    genreIds: ['house', 'rnb'],
    bio: 'Live band house with real horns and a real bassist.',
    vibe: { acousticness: 0.3, instrumentalness: 0.4 },
    followerCount: 54_800,
  },
  {
    id: 'kessler-grid',
    name: 'Kessler Grid',
    genreIds: ['techno'],
    bio: 'Berlin basements, modular racks, no vocals on principle.',
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
    bio: 'Piano trio. Standards, bent gently out of shape.',
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
    genreIds: ['ambient', 'lofi'],
    bio: 'Drones with a pulse.',
    vibe: { energy: 0.25, danceability: 0.25, tempo: 0.25 },
    followerCount: 18_400,
  },
  {
    id: 'imani-rowe',
    name: 'Imani Rowe',
    genreIds: ['rnb'],
    bio: 'Voice like a late text you actually wanted.',
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
    bio: 'Stadium hooks written in a studio apartment.',
    vibe: { energy: 0.75, valence: 0.85 },
    followerCount: 1_200_000,
  },
  {
    id: 'honeyglass',
    name: 'Honeyglass',
    genreIds: ['pop', 'indie-rock'],
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
    genreIds: ['folk', 'indie-rock'],
    bio: 'Scottish songwriter, one guitar, big weather.',
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
    bio: 'Pianist. Nocturnes, mostly, and a few of his own.',
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

interface UserDef {
  id: Id;
  handle: string;
  displayName: string;
  bio: string;
  hue: number;
  genreIds: Id[];
  playlists: Array<{ id: Id; name: string; description: string; genreIds?: Id[] }>;
}

const USER_DEFS: readonly UserDef[] = [
  {
    id: 'u-nadia',
    handle: 'nadia.k',
    displayName: 'Nadia K.',
    bio: 'Lo-fi, jazz and long nights with a textbook.',
    hue: 280,
    genreIds: ['lofi', 'jazz'],
    playlists: [
      {
        id: 'pl-nadia-study',
        name: 'Late Study',
        description: 'Head down, lights low.',
        genreIds: ['lofi'],
      },
      {
        id: 'pl-nadia-jazz',
        name: 'Sunday Jazz Kitchen',
        description: 'Coffee, eggs, swing.',
        genreIds: ['jazz'],
      },
    ],
  },
  {
    id: 'u-marcus',
    handle: 'marcus.beats',
    displayName: 'Marcus',
    bio: 'Block parties and basement sets.',
    hue: 25,
    genreIds: ['hip-hop', 'house'],
    playlists: [
      {
        id: 'pl-marcus-block',
        name: 'Block Party',
        description: 'Bring a speaker, bring a friend.',
      },
    ],
  },
  {
    id: 'u-juno',
    handle: 'juno.fm',
    displayName: 'Juno',
    bio: 'Porch songs and car-window choruses.',
    hue: 120,
    genreIds: ['indie-rock', 'folk'],
    playlists: [
      { id: 'pl-juno-porch', name: 'Porch Light', description: 'For the hour the bugs come out.' },
    ],
  },
  {
    id: 'u-kessler',
    handle: 'kessler_',
    displayName: 'Kessler',
    bio: 'Warehouse at 4am, headphones at 4pm.',
    hue: 210,
    genreIds: ['techno', 'ambient'],
    playlists: [
      { id: 'pl-kessler-grid', name: 'Grid Lines', description: 'Straight lines, no vocals.' },
    ],
  },
  {
    id: 'u-imani',
    handle: 'imani.wav',
    displayName: 'Imani',
    bio: 'Soft launches and softer vocals.',
    hue: 330,
    genreIds: ['rnb', 'pop'],
    playlists: [
      {
        id: 'pl-imani-soft',
        name: 'Soft Launch',
        description: 'Glossy, gentle, a little dramatic.',
      },
    ],
  },
  {
    id: 'u-ollie',
    handle: 'ollie.riffs',
    displayName: 'Ollie',
    bio: 'Riffs as a lifestyle. Also, cellos.',
    hue: 0,
    genreIds: ['metal', 'classical'],
    playlists: [
      {
        id: 'pl-ollie-loud',
        name: 'Loud Hours',
        description: 'Neighbours have been warned.',
        genreIds: ['metal'],
      },
      {
        id: 'pl-ollie-quiet',
        name: 'Quiet Hours',
        description: 'Neighbours have been apologised to.',
        genreIds: ['classical'],
      },
    ],
  },
];

export function buildDemoCatalog(): Catalog {
  const genres: Genre[] = GENRE_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    hue: def.hue,
    vibe: vibe(def.vibe),
  }));
  const genreById = new Map(genres.map((genre) => [genre.id, genre]));
  const durationByGenre = new Map(GENRE_DEFS.map((def) => [def.id, def.duration]));

  const artists: Artist[] = ARTIST_DEFS.map((def) => {
    const primary = genreById.get(def.genreIds[0] ?? '');
    if (!primary) throw new Error(`Unknown genre for artist ${def.id}`);
    return {
      id: def.id,
      name: def.name,
      genreIds: [...def.genreIds],
      bio: def.bio,
      vibe: vibe({ ...primary.vibe, ...def.vibe }),
      followerCount: def.followerCount,
    };
  });

  const tracks: Track[] = [];
  for (const artist of artists) {
    const rng = createRng(`track:${artist.id}`);
    const primaryGenreId = artist.genreIds[0] ?? '';
    const [minSeconds, maxSeconds] = durationByGenre.get(primaryGenreId) ?? [150, 330];
    const titles = new Set<string>();
    for (let n = 1; n <= TRACKS_PER_ARTIST; n++) {
      let title = rng.pick(TITLE_SHAPES)(rng);
      while (titles.has(title)) title = rng.pick(TITLE_SHAPES)(rng);
      titles.add(title);
      // Secondary genre on every other track so multi-genre artists actually span both.
      const genreIds =
        n % 2 === 0 && artist.genreIds.length > 1 ? [...artist.genreIds] : [primaryGenreId];
      tracks.push({
        id: `${artist.id}-${n}`,
        title,
        artistId: artist.id,
        artistName: artist.name,
        genreIds,
        durationMs: rng.int(minSeconds, maxSeconds) * 1000,
        year: rng.int(2014, 2026),
        vibe: jitterVibe(artist.vibe, 0.12, rng.next),
        source: { kind: 'catalog' },
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

  const users: User[] = [];
  const playlists: Playlist[] = [];
  for (const def of USER_DEFS) {
    const rng = createRng(`user:${def.id}`);
    const userTracks: Track[] = [];
    def.playlists.forEach((playlistDef, index) => {
      const pool = (playlistDef.genreIds ?? def.genreIds).flatMap(
        (genreId) => tracksByGenre.get(genreId) ?? [],
      );
      const unique = [...new Map(pool.map((track) => [track.id, track])).values()];
      const picked = rng.shuffle(unique).slice(0, rng.int(8, Math.min(10, unique.length)));
      userTracks.push(...picked);
      const createdAt = SEED_EPOCH + index * 86_400_000 + rng.int(0, 86_400_000);
      playlists.push({
        id: playlistDef.id,
        ownerId: def.id,
        name: playlistDef.name,
        description: playlistDef.description,
        trackIds: picked.map((track) => track.id),
        isPublic: true,
        createdAt,
        updatedAt: createdAt,
      });
    });
    users.push({
      id: def.id,
      handle: def.handle,
      displayName: def.displayName,
      bio: def.bio,
      avatarHue: def.hue,
      favoriteGenreIds: [...def.genreIds],
      vibe: centroid(userTracks.map((track) => ({ vibe: track.vibe }))),
    });
  }

  return { genres, artists, tracks, users, playlists };
}

/** Built once per module load; cheap (about a hundred tracks) and deterministic. */
export const DEMO_CATALOG: Catalog = buildDemoCatalog();
