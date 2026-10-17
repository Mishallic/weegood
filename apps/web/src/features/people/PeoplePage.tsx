import { pluralize } from '@weegood/core';
import { Link } from 'wouter';
import { useServices } from '../../app/storesContext';
import { Avatar } from '../../components/Avatar';
import { FollowButton } from '../../components/FollowButton';
import { Icon } from '../../components/Icon';

export function PeoplePage() {
  const { catalog, index } = useServices();

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>People</h1>
          <p className="muted">
            Follow listeners whose taste you trust. Their public playlists feed your home.
          </p>
        </div>
      </header>

      <div className="callout">
        <Icon name="info" />
        <span>
          These are demo profiles. Real accounts, and following each other for real, arrive with the
          backend (roadmap M3). Following works exactly as it will then.
        </span>
      </div>

      <div className="grid grid--wide">
        {catalog.users.map((user) => {
          const playlistCount = index.playlistsByOwnerId.get(user.id)?.length ?? 0;
          const genres = user.favoriteGenreIds
            .map((id) => index.genresById.get(id)?.name)
            .filter(Boolean)
            .join(', ');
          return (
            <div key={user.id} className="entity-card">
              <Link
                href={`/u/${user.handle}`}
                aria-label={user.displayName}
                style={{ display: 'flex' }}
              >
                <Avatar name={user.displayName} hue={user.avatarHue} size={56} />
              </Link>
              <div className="entity-card__text">
                <Link href={`/u/${user.handle}`} style={{ fontWeight: 600 }}>
                  {user.displayName} <span className="faint small">@{user.handle}</span>
                </Link>
                <span className="muted small truncate">{user.bio}</span>
                <span className="faint small truncate">
                  {pluralize(playlistCount, 'playlist')} · {genres}
                </span>
              </div>
              <FollowButton kind="user" targetId={user.id} size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
