import { Link } from 'wouter';
import { EmptyState } from './EmptyState';

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="page">
      <EmptyState
        icon="explore"
        title={`That ${what} is not here`}
        description="It may have been removed, or the link is off."
        action={
          <Link href="/" className="btn">
            Back home
          </Link>
        }
      />
    </div>
  );
}
