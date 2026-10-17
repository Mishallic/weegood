import { formatCompactNumber, type Artist } from '@weegood/core';
import { Link } from 'wouter';
import { useServices } from '../app/storesContext';
import { hueFor } from '../lib/hue';
import { Cover } from './Cover';
import { FollowButton } from './FollowButton';

interface ArtistCardProps {
  artist: Artist;
  reason?: string | undefined;
}

export function ArtistCard({ artist, reason }: ArtistCardProps) {
  const { index } = useServices();
  const primaryGenre = index.genresById.get(artist.genreIds[0] ?? '');
  const genres = artist.genreIds
    .map((id) => index.genresById.get(id)?.name)
    .filter(Boolean)
    .join(', ');
  return (
    <div className="entity-card">
      <Link href={`/artist/${artist.id}`} aria-label={artist.name} style={{ display: 'flex' }}>
        <Cover title={artist.name} hue={primaryGenre?.hue ?? hueFor(artist.id)} size={56} />
      </Link>
      <div className="entity-card__text">
        <Link href={`/artist/${artist.id}`} className="truncate" style={{ fontWeight: 600 }}>
          {artist.name}
        </Link>
        <span className="muted small truncate">
          {genres} · {formatCompactNumber(artist.followerCount)} followers
        </span>
        {reason && <span className="track-card__reason truncate">{reason}</span>}
      </div>
      <FollowButton kind="artist" targetId={artist.id} size="sm" />
    </div>
  );
}
