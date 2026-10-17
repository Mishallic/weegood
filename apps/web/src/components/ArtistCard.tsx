import { formatCompactNumber, genreById, type Artist } from '@weegood/core';
import { Link } from 'wouter';
import { hueFor } from '../lib/hue';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';
import { Icon } from './Icon';

interface ArtistCardProps {
  artist: Artist;
  reason?: string | undefined;
}

export function ArtistCard({ artist, reason }: ArtistCardProps) {
  const genres = artist.genreIds
    .map((id) => genreById(id)?.name)
    .filter(Boolean)
    .join(', ');
  const hue = genreById(artist.genreIds[0] ?? '')?.hue ?? hueFor(artist.id);
  const href = `/artist/${encodeURIComponent(artist.id)}`;
  return (
    <div className="entity-card">
      <Link href={href} aria-label={artist.name} style={{ display: 'flex' }}>
        <Avatar name={artist.name} hue={hue} src={artist.avatarUrl} size={56} />
      </Link>
      <div className="entity-card__text">
        <Link href={href} className="truncate row" style={{ fontWeight: 600, gap: 4 }}>
          <span className="truncate">{artist.name}</span>
          {artist.verified && (
            <span style={{ color: 'var(--accent)', display: 'inline-flex' }} title="Verified">
              <Icon name="check" size={14} />
            </span>
          )}
        </Link>
        <span className="muted small truncate">
          {genres ? `${genres} · ` : ''}
          {formatCompactNumber(artist.followerCount)} followers
        </span>
        {reason && <span className="track-card__reason truncate">{reason}</span>}
      </div>
      <FollowButton kind="artist" targetId={artist.id} artist={artist} size="sm" />
    </div>
  );
}
