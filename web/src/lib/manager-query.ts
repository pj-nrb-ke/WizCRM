export type ManagerFilter = {
  teamId?: string;
  ownerId?: string;
  title?: string;
};

export function readManagerFilter(search: URLSearchParams): ManagerFilter {
  return {
    teamId: search.get('teamId') ?? undefined,
    ownerId: search.get('ownerId') ?? undefined,
    title: search.get('title') ?? undefined,
  };
}

export function leadsQueryPath(
  filter: ManagerFilter,
  extra?: { stage?: string; tag?: string },
): string {
  const qs = new URLSearchParams();
  if (filter.teamId) qs.set('teamId', filter.teamId);
  if (filter.ownerId) qs.set('ownerId', filter.ownerId);
  if (extra?.stage) qs.set('stage', extra.stage);
  if (extra?.tag) qs.set('tag', extra.tag);
  const q = qs.toString();
  return q ? `/leads?${q}` : '/leads';
}

export function pipelineQueryPath(filter: ManagerFilter): string {
  const qs = new URLSearchParams();
  if (filter.teamId) qs.set('teamId', filter.teamId);
  if (filter.ownerId) qs.set('ownerId', filter.ownerId);
  const q = qs.toString();
  return q ? `/leads/pipeline?${q}` : '/leads/pipeline';
}

export function reportsQueryPath(
  filter: ManagerFilter,
  extra?: { dateFrom?: string; dateTo?: string },
): string {
  const qs = new URLSearchParams();
  if (filter.teamId) qs.set('teamId', filter.teamId);
  if (extra?.dateFrom) qs.set('dateFrom', extra.dateFrom);
  if (extra?.dateTo) qs.set('dateTo', extra.dateTo);
  const q = qs.toString();
  return q ? `/reports/summary?${q}` : '/reports/summary';
}

export function filterSearchParams(filter: ManagerFilter): string {
  const qs = new URLSearchParams();
  if (filter.teamId) qs.set('teamId', filter.teamId);
  if (filter.ownerId) qs.set('ownerId', filter.ownerId);
  if (filter.title) qs.set('title', filter.title);
  const s = qs.toString();
  return s ? `?${s}` : '';
}
