import type { Model } from '../hooks/useMapInit';

export function selectDefaultDate(
  dates: string[],
  model: Model,
  subMode: 'aggregate' | 'daily' = 'aggregate',
): string {
  if (!dates.length) return '';
  const last = dates[dates.length - 1];
  const today = new Date().toISOString().slice(0, 10);

  // Monthly dates: only when 6months aggregate — match by month prefix
  if (model === '6months' && subMode === 'aggregate') {
    const currentMonth = today.slice(0, 7);
    return dates.find(d => d.startsWith(currentMonth)) ?? last;
  }

  // All other cases (7days any, 6months daily): match exact today
  return dates.includes(today) ? today : last;
}
