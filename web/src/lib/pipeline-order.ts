export type DropPlace = 'before' | 'after';

export function reorderLeadList<T extends { id: string }>(
  list: T[],
  dragId: string,
  targetId: string,
  place: DropPlace,
): T[] {
  const copy = [...list];
  const from = copy.findIndex((x) => x.id === dragId);
  let to = copy.findIndex((x) => x.id === targetId);
  if (from < 0 || to < 0 || from === to) return copy;
  if (place === 'after') to += 1;
  const [item] = copy.splice(from, 1);
  if (from < to) to -= 1;
  copy.splice(to, 0, item);
  return copy;
}

export function moveLeadToEnd<T extends { id: string }>(list: T[], dragId: string): T[] {
  const copy = [...list];
  const from = copy.findIndex((x) => x.id === dragId);
  if (from < 0) return copy;
  const [item] = copy.splice(from, 1);
  copy.push(item);
  return copy;
}
