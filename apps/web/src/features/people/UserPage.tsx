import { describeVibe, pluralize } from '@weegood/core';
import type { CSSProperties } from 'react';
import { Link, useParams } from 'wouter';
import { useServices } from '../../app/storesContext';
import { Avatar } from '../../components/Avatar';
import { Chip } from '../../components/Chip';
import { FollowButton } from '../../components/FollowButton';
import { NotFound } from '../../components/NotFound';
import { Section } from '../../components/Section';
import { hueFor } from '../../lib/hue';
import { isDefined } from '../../lib/isDefined';

export function UserPage() {
  const { handle = '' } = useParams<{ handle: string }>();
  const { index } = useServices();
  const user = index.usersByHandle.get(handle);
  if (!user) return <NotFound what="person" />;

  const playlists = index.playlistsByOwnerId.get(user.id) ?? [];
  const genres = user.favoriteGenreIds.map((id) => index.genresById.get(id)).filter(isDefined);

  return (
    <div className="page">
      <section className="hero">
        <Avatar name={user.displayName} hue={user.avatarHue} size={140} />
        <div className="hero__body">
          <span className="hero__kicker">@{user.handle}</span>
          <h1 className="hero__title">{user.displayName}</h1>
          <p className="muted">{user.bio}</p>
          <p className="small faint">Listens {describeVibe(user.vibe, 3).join(', ')}</p>
          <div className="chip-row">
            {genres.map((genre) => (
              <Chip key={genre.id} href={`/genre/${genre.id}`} hue={genre.hue}>
                {genre.name}
              </Chip>
            ))}
          </div>
          <div className="hero__actions">
            <FollowButton kind="user" targetId={user.id} />
          </div>
        </div>
      </section>

      <Section
        title="Public playlists"
        subtitle="Following this person brings these into your home feed."
      >
        <div className="grid">
          {playlists.map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              className="tile"
              style={{ '--hue': hueFor(playlist.id) } as CSSProperties}
            >
              <span>{playlist.name}</span>
              <span className="tile__sub">{pluralize(playlist.trackIds.length, 'track')}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
