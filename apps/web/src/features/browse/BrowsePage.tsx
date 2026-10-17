import { FEATURED_GENRES, GENRES, type Recommendation, type Track } from '@weegood/core';
import { useCallback, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { useApp, useServices } from '../../app/storesContext';
import { AsyncState } from '../../components/AsyncState';
import { Button } from '../../components/Button';
import { Section } from '../../components/Section';
import { TrackCards } from '../../components/TrackCards';
import { useQuery } from '../../hooks/useQuery';

function toItems(tracks: readonly Track[] | undefined, reason: string): Recommendation[] {
  return (tracks ?? []).map((track) => ({ track, score: track.popularity, reasons: [reason] }));
}

export function BrowsePage() {
  const { music } = useServices();
  const rememberTracks = useApp((state) => state.rememberTracks);
  const [showAll, setShowAll] = useState(false);

  const fetchTrending = useCallback(async () => {
    const tracks = await music.trending({ window: 'week', limit: 30 });
    rememberTracks(tracks);
    return tracks;
  }, [music, rememberTracks]);
  const fetchUnderground = useCallback(async () => {
    const tracks = await music.underground(30);
    rememberTracks(tracks);
    return tracks;
  }, [music, rememberTracks]);

  const trending = useQuery<Track[]>('browse:trending', fetchTrending);
  const underground = useQuery<Track[]>('browse:underground', fetchUnderground);

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>Browse</h1>
          <p className="muted">Every genre on Audius, plus what is moving this week.</p>
        </div>
      </header>

      <Section title="Genres">
        <div className="grid">
          {(showAll ? GENRES : FEATURED_GENRES).map((genre) => (
            <Link
              key={genre.id}
              href={`/genre/${genre.id}`}
              className="tile"
              style={{ '--hue': genre.hue } as CSSProperties}
            >
              <span>{genre.name}</span>
              <span className="tile__sub">{genre.description}</span>
            </Link>
          ))}
        </div>
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show featured genres' : `Show all ${GENRES.length} genres`}
          </Button>
        </div>
      </Section>

      <Section title="Trending this week" subtitle="Across all genres, most played first.">
        <AsyncState
          loading={trending.loading}
          error={trending.error}
          empty={!trending.data?.length}
          onRetry={trending.refresh}
        >
          <TrackCards
            items={toItems(trending.data, 'Trending this week')}
            contextLabel="Trending this week"
          />
        </AsyncState>
      </Section>

      <Section title="Rising underground" subtitle="Fresh uploads picking up steam.">
        <AsyncState
          loading={underground.loading}
          error={underground.error}
          empty={!underground.data?.length}
          onRetry={underground.refresh}
        >
          <TrackCards
            items={toItems(underground.data, 'Rising')}
            contextLabel="Rising underground"
          />
        </AsyncState>
      </Section>
    </div>
  );
}
