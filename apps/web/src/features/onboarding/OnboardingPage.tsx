import {
  FEATURED_GENRES,
  GENRES,
  genreById,
  LISTENING_CONTEXTS,
  MOODS,
  describeVibe,
  type Artist,
  type ListeningContext,
  type OnboardingAnswers,
} from '@weegood/core';
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useLocation } from 'wouter';
import { useApp, useServices } from '../../app/storesContext';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useQuery } from '../../hooks/useQuery';
import { hueFor } from '../../lib/hue';

const STEPS = ['welcome', 'genres', 'moods', 'artists', 'context'] as const;
type Step = (typeof STEPS)[number];

const GENRE_MIN = 2;
const GENRE_MAX = 5;
const MOOD_MIN = 1;
const MOOD_MAX = 4;
const ARTIST_CHOICES = 12;

function toggleIn(list: readonly string[], id: string, max: number): string[] {
  if (list.includes(id)) return list.filter((item) => item !== id);
  if (list.length >= max) return [...list];
  return [...list, id];
}

/** Four questions, under a minute (ADR 0009). Artists are real, pulled live for the chosen genres. */
export function OnboardingPage() {
  const { music } = useServices();
  const existing = useApp((state) => state.profile?.onboarding ?? null);
  const hasProfile = useApp((state) => state.profile !== null);
  const knownArtists = useApp((state) => state.artists);
  const completeOnboarding = useApp((state) => state.completeOnboarding);
  const [, navigate] = useLocation();

  const [stepIndex, setStepIndex] = useState(0);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [genreIds, setGenreIds] = useState<string[]>(existing?.genreIds ?? []);
  const [moodIds, setMoodIds] = useState<string[]>(existing?.moodIds ?? []);
  const [artistIds, setArtistIds] = useState<string[]>(existing?.artistIds ?? []);
  const [context, setContext] = useState<ListeningContext>(existing?.context ?? 'everything');
  const [saving, setSaving] = useState(false);
  const step: Step = STEPS[stepIndex] ?? 'welcome';

  const sortedGenres = useMemo(() => [...genreIds].sort(), [genreIds]);
  const artistKey = stepIndex >= 3 ? `onboarding-artists:${sortedGenres.join(',')}` : null;
  const fetchArtists = useCallback(async (): Promise<Artist[]> => {
    const lists = await Promise.all(
      sortedGenres.map((genreId) =>
        music.trending({ genreId, window: 'month', limit: 40 }).catch(() => []),
      ),
    );
    const byArtist = new Map<string, { artist: Artist; hits: number }>();
    for (const list of lists) {
      for (const track of list) {
        if (!track.artistId) continue;
        const known = music.cachedArtist(track.artistId);
        if (!known) continue;
        const entry = byArtist.get(known.id);
        if (entry) entry.hits++;
        else byArtist.set(known.id, { artist: known, hits: 1 });
      }
    }
    return [...byArtist.values()]
      .sort((a, b) => b.hits - a.hits || b.artist.followerCount - a.artist.followerCount)
      .slice(0, ARTIST_CHOICES)
      .map((entry) => entry.artist);
  }, [music, sortedGenres]);
  const artistQuery = useQuery<Artist[]>(artistKey, fetchArtists, { ttlMs: 30 * 60_000 });
  const artistChoices = artistQuery.data ?? [];

  const canContinue =
    step === 'genres'
      ? genreIds.length >= GENRE_MIN
      : step === 'moods'
        ? moodIds.length >= MOOD_MIN
        : true;

  const hint =
    step === 'genres'
      ? `${genreIds.length} of ${GENRE_MAX} picked${genreIds.length < GENRE_MIN ? `, at least ${GENRE_MIN}` : ''}`
      : step === 'moods'
        ? `${moodIds.length} of ${MOOD_MAX} picked`
        : step === 'artists'
          ? `${artistIds.length} picked, optional`
          : '';

  const finish = async () => {
    setSaving(true);
    const answers: OnboardingAnswers = { genreIds, moodIds, artistIds, context };
    const chosen = artistIds
      .map((id) => artistChoices.find((artist) => artist.id === id) ?? knownArtists[id])
      .filter((artist): artist is Artist => artist !== undefined);
    try {
      await completeOnboarding(answers, chosen);
      navigate('/');
    } finally {
      setSaving(false);
    }
  };

  const genreList = showAllGenres ? GENRES : FEATURED_GENRES;

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <div className="brand" style={{ padding: 0 }}>
          <img
            className="brand__mark"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width={28}
            height={28}
          />
          <span>Weegood</span>
        </div>
        <div className="onboarding__progress" aria-hidden="true">
          {STEPS.map((name, i) => (
            <span key={name} className={i <= stepIndex ? 'is-done' : ''} />
          ))}
        </div>

        {step === 'welcome' && (
          <div className="stack">
            <h1>Let&apos;s find your vibe.</h1>
            <p className="muted">
              Four quick questions, under a minute. Weegood streams real, full-length music from
              Audius, an open music network, and recommends from what you actually play, with a
              reason for every pick.
            </p>
            <div className="callout">
              <Icon name="info" />
              <span>
                Your taste profile stays on this device. Weegood has no accounts and sends nothing
                but anonymous music requests to the music network. You can export or reset your
                profile from Settings.
              </span>
            </div>
          </div>
        )}

        {step === 'genres' && (
          <div className="stack">
            <h1>Which genres do you keep coming back to?</h1>
            <p className="muted">
              Pick {GENRE_MIN} to {GENRE_MAX}.
            </p>
            <div className="option-grid">
              {genreList.map((genre) => {
                const pressed = genreIds.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    className="option"
                    style={{ '--hue': genre.hue } as CSSProperties}
                    aria-pressed={pressed}
                    disabled={!pressed && genreIds.length >= GENRE_MAX}
                    onClick={() => setGenreIds((list) => toggleIn(list, genre.id, GENRE_MAX))}
                  >
                    <span className="option__title">{genre.name}</span>
                    <span className="option__desc">{genre.description}</span>
                  </button>
                );
              })}
            </div>
            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowAllGenres((value) => !value)}>
                {showAllGenres ? 'Show fewer genres' : `Show all ${GENRES.length} genres`}
              </Button>
            </div>
          </div>
        )}

        {step === 'moods' && (
          <div className="stack">
            <h1>What are you usually in the mood for?</h1>
            <p className="muted">Pick up to {MOOD_MAX}. This shapes your recommendations most.</p>
            <div className="option-grid">
              {MOODS.map((mood) => {
                const pressed = moodIds.includes(mood.id);
                return (
                  <button
                    key={mood.id}
                    type="button"
                    className="option"
                    style={{ '--hue': hueFor(mood.id) } as CSSProperties}
                    aria-pressed={pressed}
                    disabled={!pressed && moodIds.length >= MOOD_MAX}
                    onClick={() => setMoodIds((list) => toggleIn(list, mood.id, MOOD_MAX))}
                  >
                    <span className="option__title">{mood.name}</span>
                    <span className="option__desc">{mood.description}</span>
                    <span className="option__desc faint">
                      {describeVibe(mood.vibe, 2).join(' · ')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'artists' && (
          <div className="stack">
            <h1>Anyone you already like?</h1>
            <p className="muted">Optional. Artists trending right now in the genres you picked.</p>
            {artistQuery.loading && artistChoices.length === 0 && (
              <p className="muted small">Finding artists on Audius...</p>
            )}
            {artistQuery.error && artistChoices.length === 0 && (
              <div className="callout">
                <Icon name="info" />
                <span>
                  Could not reach Audius. You can skip this step.{' '}
                  <Button size="sm" variant="ghost" onClick={artistQuery.refresh}>
                    Try again
                  </Button>
                </span>
              </div>
            )}
            <div className="option-grid">
              {artistChoices.map((artist) => {
                const pressed = artistIds.includes(artist.id);
                const hue = genreById(artist.genreIds[0] ?? '')?.hue ?? hueFor(artist.id);
                return (
                  <button
                    key={artist.id}
                    type="button"
                    className="option option--artist"
                    style={{ '--hue': hue } as CSSProperties}
                    aria-pressed={pressed}
                    onClick={() =>
                      setArtistIds((list) => toggleIn(list, artist.id, ARTIST_CHOICES))
                    }
                  >
                    <Avatar name={artist.name} hue={hue} src={artist.avatarUrl} size={40} />
                    <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                      <span className="option__title truncate">{artist.name}</span>
                      <span className="option__desc truncate">
                        {artist.genreIds
                          .map((id) => genreById(id)?.name)
                          .filter(Boolean)
                          .join(', ') || 'Audius'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'context' && (
          <div className="stack">
            <h1>When do you listen most?</h1>
            <p className="muted">One answer. It gently tilts your starting point.</p>
            <div className="option-grid">
              {LISTENING_CONTEXTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="option"
                  aria-pressed={context === option.id}
                  onClick={() => setContext(option.id)}
                >
                  <span className="option__title">{option.name}</span>
                  <span className="option__desc">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="onboarding__footer">
          {stepIndex > 0 ? (
            <Button variant="ghost" icon="back" onClick={() => setStepIndex((i) => i - 1)}>
              Back
            </Button>
          ) : hasProfile ? (
            <Button variant="ghost" onClick={() => navigate('/')}>
              Cancel
            </Button>
          ) : (
            <span />
          )}
          <span className="muted small">{hint}</span>
          {stepIndex < STEPS.length - 1 ? (
            <Button
              variant="primary"
              disabled={!canContinue}
              onClick={() => setStepIndex((i) => i + 1)}
            >
              {step === 'welcome'
                ? "Let's go"
                : step === 'artists' && artistIds.length === 0
                  ? 'Skip'
                  : 'Continue'}
            </Button>
          ) : (
            <Button variant="primary" disabled={saving} onClick={() => void finish()}>
              {saving ? 'Saving...' : 'Show me music'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
