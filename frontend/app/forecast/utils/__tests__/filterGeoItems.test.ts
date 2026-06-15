import { describe, it, expect } from 'vitest';
import { filterGeoItems } from '../filterGeoItems';

const items = [
  { id: '50', name: 'Chiang Mai', name_th: 'เชียงใหม่' },
  { id: '51', name: 'Lamphun', name_th: 'ลำพูน' },
  { id: '52', name: 'Lampang', name_th: 'ลำปาง' },
  { id: '53', name: 'Uttaradit', name_th: 'อุตรดิตถ์' },
];

describe('filterGeoItems', () => {
  it('returns all items when query is empty', () => {
    expect(filterGeoItems(items, '')).toHaveLength(4);
  });

  it('returns all items when query is whitespace', () => {
    expect(filterGeoItems(items, '   ')).toHaveLength(4);
  });

  it('filters by English name (case insensitive)', () => {
    expect(filterGeoItems(items, 'chiang')).toEqual([items[0]]);
    expect(filterGeoItems(items, 'CHIANG')).toEqual([items[0]]);
  });

  it('filters by Thai name', () => {
    expect(filterGeoItems(items, 'ลำ')).toEqual([items[1], items[2]]);
  });

  it('filters by ID', () => {
    expect(filterGeoItems(items, '53')).toEqual([items[3]]);
  });

  it('matches partial English name', () => {
    expect(filterGeoItems(items, 'lamp')).toEqual([items[1], items[2]]);
  });

  it('returns empty array when no match', () => {
    expect(filterGeoItems(items, 'zzz')).toHaveLength(0);
  });

  it('works with items that have no name_th', () => {
    const noThai = [{ id: '99', name: 'Test Province' }];
    expect(filterGeoItems(noThai, 'test')).toHaveLength(1);
    expect(filterGeoItems(noThai, 'ไทย')).toHaveLength(0);
  });
});
