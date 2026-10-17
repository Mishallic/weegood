import { pluralize } from '@weegood/core';
import type { CSSProperties } from 'react';
import { Link } from 'wouter';
import { useServices } from '../../app/storesContext';
import { ArtistCard } from '../../components/ArtistCard';
import { Section } from '../../components/Section';

export function BrowsePage() {
  const { catalog, index } = useServices();
  const artists = [...catalog.artists].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>Browse</h1>
          <p className="muted">Every genre and artist in the demo catalog. Follow what you like.</p>
        </div>
      </header>

      <Section title="Genres">
        <div className="grid">
          {catalog.genres.map((genre) => (
            <Link
              key={genre.id}
              href={`/genre/${genre.id}`}
              className="tile"
              style={{ '--hue': genre.hue } as CSSProperties}
            >
              <span>{genre.name}</span>
              <span className="tile__sub">
                {pluralize(index.tracksByGenreId.get(genre.id)?.length ?? 0, 'track')}
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Artists">
        <div className="grid grid--wide">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      </Section>
    </div>
  );
}
