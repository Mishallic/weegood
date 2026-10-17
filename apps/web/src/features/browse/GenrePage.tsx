import { describeVibe, NEUTRAL_VIBE, vibeSimilarity } from '@weegood/core';
import { useMemo } from 'react';
import { useParams } from 'wouter';
import { useApp, usePlayer, useServices } from '../../app/storesContext';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Cover } from '../../components/Cover';
import { FollowButton } from '../../components/FollowButton';
import { NotFound } from '../../components/NotFound';
import { Section } from '../../components/Section';
import { TrackList } from '../../components/TrackList';

export function GenrePage() {
  const { id = '' } = useParams<{ id: string }>();
  const { catalog, index } = useServices();
  const profileVibe = useApp((state) => state.profile?.vibe ?? NEUTRAL_VIBE);
  const playQueue = usePlayer((state) => state.playQueue);
  const genre = index.genresById.get(id);

  const tracks = useMemo(() => {
    const list = index.tracksByGenreId.get(id) ?? [];
    return [...list].sort(
      (a, b) => vibeSimilarity(profileVibe, b.vibe) - vibeSimilarity(profileVibe, a.vibe),
    );
  }, [index, id, profileVibe]);

  if (!genre) return <NotFound what="genre" />;

  const artists = catalog.artists.filter((artist) => artist.genreIds.includes(genre.id));

  return (
    <div className="page">
      <section className="hero">
        <Cover title={genre.name} hue={genre.hue} size={140} />
        <div className="hero__body">
          <span className="hero__kicker">Genre</span>
          <h1 className="hero__title">{genre.name}</h1>
          <p className="muted">{genre.description}</p>
          <p className="small faint">{describeVibe(genre.vibe, 3).join(' · ')}</p>
          <div className="hero__actions">
            <Button
              variant="primary"
              icon="play"
              onClick={() =>
                void playQueue(
                  tracks.map((track) => track.id),
                  0,
                  genre.name,
                )
              }
              disabled={tracks.length === 0}
            >
              Play
            </Button>
            <FollowButton kind="genre" targetId={genre.id} />
          </div>
        </div>
      </section>

      <Section title="Artists">
        <div className="chip-row">
          {artists.map((artist) => (
            <Chip key={artist.id} href={`/artist/${artist.id}`}>
              {artist.name}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Tracks" subtitle="Ordered by how close each one is to your vibe.">
        <TrackList tracks={tracks} contextLabel={genre.name} />
      </Section>
    </div>
  );
}
