import type { Model } from '../hooks/useMapInit';

export function selectDefaultDate(
  dates: string[],
  model: Model,
  subMode: 'aggregate' | 'daily' = 'aggregate',
): string {
  if (!dates.length) return '';
  const last = dates[dates.length - 1];
  const today = new Date().toISOString().slice(0, 10);

  // Monthly dates: only when 6months aggregate — match by calendar month prefix
  if (model === '6months' && subMode === 'aggregate') {
    const currentMonth = today.slice(0, 7);
    return dates.find(d => d.startsWith(currentMonth)) ?? last;
  }

  // All other cases (7days any, 6months daily): match exact today
  return dates.includes(today) ? today : last;
}

// Localized date formatters — Date objects are formatted directly (local time) to match the
// date dropdown labels in ProtoLayout, and to avoid a UTC round-trip that could shift the +6-day
// range end across a timezone boundary.
function fmtDayObj(dt: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
}

/**
 * Label for the table's Date column, computed from the selected date + model/subMode:
 *   6months + aggregate → month + year        ("December 2025")   — same as the dropdown
 *   any     + daily     → single day          ("24 Dec 2025")     — same as the dropdown
 *   7days   + aggregate → 7-day range start..+6 ("24 Dec 2025 - 30 Dec 2025")
 * Localized via `locale`; empty date → "—".
 */
export function formatTableDate(
  date: string,
  model: Model,
  subMode: 'aggregate' | 'daily',
  locale: string,
): string {
  if (!date) return '—';
  const start = new Date(date + 'T00:00:00');
  if (subMode === 'daily') return fmtDayObj(start, locale);
  if (model === '6months') {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(start);
  }
  // 7days aggregate = weekly: start date through start + 6 days
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${fmtDayObj(start, locale)} - ${fmtDayObj(end, locale)}`;
}
