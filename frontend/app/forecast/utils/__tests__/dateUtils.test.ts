import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectDefaultDate, formatTableDate } from '../dateUtils';

const FAKE_NOW = new Date('2026-06-14T12:00:00Z');

describe('selectDefaultDate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('7days model', () => {
    it('returns today when today exists in dates', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15', '2026-06-16'];
      expect(selectDefaultDate(dates, '7days')).toBe('2026-06-14');
    });

    it('falls back to latest when today is not in dates', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-06-10', '2026-06-11', '2026-06-12'];
      expect(selectDefaultDate(dates, '7days')).toBe('2026-06-12');
    });

    it('returns empty string for empty array', () => {
      vi.setSystemTime(FAKE_NOW);
      expect(selectDefaultDate([], '7days')).toBe('');
    });
  });

  describe('6months aggregate (monthly dates)', () => {
    it('returns current month date when it exists as YYYY-MM-01', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01'];
      expect(selectDefaultDate(dates, '6months', 'aggregate')).toBe('2026-06-01');
    });

    it('falls back to latest when current month not in dates', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-04-01', '2026-05-01'];
      expect(selectDefaultDate(dates, '6months', 'aggregate')).toBe('2026-05-01');
    });

    it('returns empty string for empty array', () => {
      vi.setSystemTime(FAKE_NOW);
      expect(selectDefaultDate([], '6months', 'aggregate')).toBe('');
    });

    it('matches by prefix even when today is mid-month', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-05-01', '2026-06-01', '2026-07-01'];
      expect(selectDefaultDate(dates, '6months', 'aggregate')).toBe('2026-06-01');
    });

    it('defaults to aggregate when subMode omitted', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-05-01', '2026-06-01', '2026-07-01'];
      expect(selectDefaultDate(dates, '6months')).toBe('2026-06-01');
    });
  });

  describe('6months daily (daily dates within 6-month range)', () => {
    it('returns today when today exists in daily dates', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-06-01', '2026-06-02', '2026-06-13', '2026-06-14', '2026-06-15'];
      expect(selectDefaultDate(dates, '6months', 'daily')).toBe('2026-06-14');
    });

    it('does not return first-of-month when today exists', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-06-01', '2026-06-02', '2026-06-14', '2026-06-20'];
      expect(selectDefaultDate(dates, '6months', 'daily')).not.toBe('2026-06-01');
      expect(selectDefaultDate(dates, '6months', 'daily')).toBe('2026-06-14');
    });

    it('falls back to latest when today not in daily dates', () => {
      vi.setSystemTime(FAKE_NOW);
      const dates = ['2026-06-01', '2026-06-02', '2026-06-10'];
      expect(selectDefaultDate(dates, '6months', 'daily')).toBe('2026-06-10');
    });

    it('returns empty string for empty array', () => {
      vi.setSystemTime(FAKE_NOW);
      expect(selectDefaultDate([], '6months', 'daily')).toBe('');
    });
  });
});

describe('formatTableDate', () => {
  const D = '2025-12-24';

  it('6months + aggregate → month + year (no day)', () => {
    const s = formatTableDate(D, '6months', 'aggregate', 'en-US');
    expect(s).toContain('December');
    expect(s).toContain('2025');
    expect(s).not.toContain('24');
  });

  it('6months + daily → single day', () => {
    const s = formatTableDate(D, '6months', 'daily', 'en-US');
    expect(s).toContain('Dec');
    expect(s).toContain('24');
    expect(s).toContain('2025');
    expect(s).not.toContain(' - ');
  });

  it('7days + daily → single day (same as daily)', () => {
    const s = formatTableDate(D, '7days', 'daily', 'en-US');
    expect(s).toContain('24');
    expect(s).not.toContain(' - ');
  });

  it('7days + aggregate → 7-day range (start .. start+6)', () => {
    const s = formatTableDate(D, '7days', 'aggregate', 'en-US');
    expect(s).toContain(' - ');
    expect(s).toContain('24'); // start: 24 Dec
    expect(s).toContain('30'); // end:   30 Dec (24 + 6)
  });

  it('7days + aggregate range crosses a month/year boundary correctly', () => {
    // 28 Dec 2025 + 6 = 3 Jan 2026
    const s = formatTableDate('2025-12-28', '7days', 'aggregate', 'en-US');
    expect(s).toContain('28');
    expect(s).toContain('Dec');
    expect(s).toContain('2025');
    expect(s).toContain('Jan');
    expect(s).toContain('2026');
  });

  it('empty date → em dash', () => {
    expect(formatTableDate('', '6months', 'aggregate', 'en-US')).toBe('—');
  });

  it('localizes by locale (th differs from en)', () => {
    const en = formatTableDate(D, '6months', 'aggregate', 'en-US');
    const th = formatTableDate(D, '6months', 'aggregate', 'th-TH');
    expect(th).not.toBe(en);
  });
});
