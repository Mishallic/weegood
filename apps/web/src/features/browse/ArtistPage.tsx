import { describeVibe, formatCompactNumber, vibeSimilarity } from '@weegood/core';
import { useMemo } from 'react';
import { useParams } from 'wouter';
import { usePlayer, useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Cover } from '../../components/Cover';
import { FollowButton } from '../../components/FollowButton';
import { NotFound } from '../../components/NotFound';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';
import { hueFor } from '../../lib/hue';
import { isDefined } from '../../lib/isDefined';

export function ArtistPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { catalog, index } = useServices();
  const playQueue = usePlayer((state) => state.playQueue);
  const artist = index.artistsById.get(id);
  const tracks = index.tracksByArtistId.get(id) ?? [];

  const similar = useMemo(() => {
    if (!artist) return [];
    return catalog.artists
      .filter((other) => other.id !== artist.id)
      .sort((a, b) => vibeSimilarity(artist.vibe, b.vibe) - vibeSimilarity(artist.vibe, a.vibe))
      .slice(0, 6);
  }, [catalog, artist]);

  if (!artist) return <NotFound what="artist" />;

  const genres = artist.genreIds.map((genreId) => index.genresById.get(genreId)).filter(isDefined);
  const hue = genres[0]?.hue ?? hueFor(artist.id);

  return (
    <div className="page">
      <section className="hero">
        <Cover title={artist.name} hue={hue} size={140} />
        <div className="hero__body">
          <span className="hero__kicker">Artist</span>
          <h1 className="hero__title">{artist.name}</h1>
          <p className="muted">{artist.bio}</p>
          <p className="small faint">
            {formatCompactNumber(artist.followerCount)} followers ·{' '}
            {describeVibe(artist.vibe, 3).join(' · ')}
          </p>
          <div className="chip-row">
            {genres.map((genre) => (
              <Chip key={genre.id} href={`/genre/${genre.id}`} hue={genre.hue}>
                {genre.name}
              </Chip>
            ))}
          </div>
          <div className="hero__actions">
            <Button
              variant="primary"
              icon="play"
              onClick={() =>
                void playQueue(
                  tracks.map((track) => track.id),
                  0,
                  artist.name,
                )
              }
              disabled={tracks.length === 0}
            >
              Play
            </Button>
            <FollowButton kind="artist" targetId={artist.id} />
          </div>
        </div>
      </section>

      <Section title="Tracks">
        <TrackList tracks={tracks} contextLabel={artist.name} />
      </Section>

      <Section title="Fans also like" subtitle="The closest vibes in the catalog.">
        <div className="grid grid--wide">
          {similar.map((other) => (
            <ArtistCard key={other.id} artist={other} />
          ))}
        </div>
      </Section>
    </div>
  );
}
