import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectDefaultDate } from '../dateUtils';

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
