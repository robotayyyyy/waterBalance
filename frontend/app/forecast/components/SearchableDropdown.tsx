'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme, valueToColor } from '../theme';
import type { Mode } from '../theme';
import { SHOW_ID } from '../config';
import { filterGeoItems, type GeoItem } from '../utils/filterGeoItems';

export default function SearchableDropdown({
  items, selectedId, onSelect, onDeselect, placeholder, label,
  colorMap, mode, testId, getLabel,
}: {
  items: GeoItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect?: () => void;
  placeholder: string;
  label: string;
  colorMap?: Map<string, number>;
  mode?: Mode;
  testId: string;
  getLabel?: (item: GeoItem) => string;
}) {
  const { locale, t } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const defaultLabel = (item: GeoItem) =>
    locale === 'th' && item.name_th ? item.name_th : (item.name || item.id);
  const displayLabel = getLabel ?? defaultLabel;

  const selectedItem = items.find(i => i.id === selectedId);
  const filtered = useMemo(() => filterGeoItems(items, query), [items, query]);

  const slug = testId.replace('-dropdown', '');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel, textTransform: 'uppercase', marginBottom: 3, paddingLeft: 2 }}>
        {label}
      </div>
      <div
        data-testid={testId}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 8px', border: `1px solid ${theme.color.borderInput}`,
          borderRadius: theme.radius.md, background: theme.color.pageBg,
          cursor: 'pointer', userSelect: 'none', minHeight: 32,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedItem ? theme.color.textPrimary : theme.color.textMuted }}>
          {selectedItem ? displayLabel(selectedItem) : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {selectedItem && onDeselect && (
            <button
              data-testid={`${slug}-deselect`}
              onClick={e => { e.stopPropagation(); onDeselect(); }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: theme.color.textMuted, fontSize: theme.fontSize.icon, lineHeight: 1, padding: '0 4px' }}
            >×</button>
          )}
          <span style={{ color: theme.color.textMuted, fontSize: 9 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
          background: theme.color.pageBg, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          marginTop: 2, overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 8px', borderBottom: `1px solid ${theme.color.border}` }}>
            <input
              data-testid={`${slug}-search`}
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%', padding: '5px 8px', border: `1px solid ${theme.color.borderInput}`,
                borderRadius: theme.radius.md, fontSize: theme.fontSize.sm, boxSizing: 'border-box',
                outline: 'none', color: theme.color.textPrimary, background: theme.color.pageBg,
              }}
            />
          </div>
          <ul
            data-testid={`${testId}-list`}
            style={{ maxHeight: 220, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}
          >
            {filtered.length === 0 && (
              <li style={{ padding: '8px 12px', color: theme.color.textMuted, fontSize: theme.fontSize.sm }}>
                {t.selector.noResults}
              </li>
            )}
            {filtered.map(item => {
              const colorVal = colorMap?.get(item.id);
              const isSelected = item.id === selectedId;
              return (
                <li
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  style={{
                    padding: '6px 12px', cursor: 'pointer', fontSize: theme.fontSize.sm,
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: isSelected ? theme.color.primaryLight : undefined,
                    color: isSelected ? theme.color.primaryDark : theme.color.textPrimary,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = theme.color.surfaceBg; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
                >
                  {colorVal !== undefined && mode && (
                    <span style={{ width: 10, height: 10, borderRadius: theme.radius.sm, flexShrink: 0, background: valueToColor(colorVal, mode) }} />
                  )}
                  <span style={{ flex: 1 }}>{displayLabel(item)}</span>
                  {SHOW_ID && !getLabel && <span style={{ color: theme.color.textMuted, fontSize: 10 }}>{item.id}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
