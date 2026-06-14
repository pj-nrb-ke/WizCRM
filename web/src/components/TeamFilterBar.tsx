import { Link, useSearchParams } from 'react-router-dom';
import { readManagerFilter } from '../lib/manager-query';

type Props = {
  basePath: string;
};

export function TeamFilterBar({ basePath }: Props) {
  const [search] = useSearchParams();
  const filter = readManagerFilter(search);
  const hasFilter = Boolean(filter.teamId || filter.ownerId);

  if (!hasFilter) return null;

  return (
    <div className="filter-bar">
      <Link to="/manager">All teams</Link>
      <span className="muted"> / </span>
      <strong>{filter.title ?? 'Filtered'}</strong>
      <Link className="filter-clear" to={basePath}>
        Clear filter
      </Link>
    </div>
  );
}
