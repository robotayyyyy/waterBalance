'use client';
import { useState, useMemo, useEffect } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';

type Province = { id: string; name: string; name_th?: string };
type GeoItem = { id: string; name: string; name_th?: string; [key: string]: any };

function SectionHeader({ label, count, total, selectedName, selectedId, onDeselect, isCollapsed, onToggle }: {
  label: string;
  count: number;
  total: number;
  selectedName?: string;
  selectedId?: string;
  onDeselect?: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '5px 12px', fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel,
        textTransform: 'uppercase', background: theme.color.surfaceBg,
        borderBottom: `1px solid ${theme.color.border}`, flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 4, cursor: 'pointer', userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ color: theme.color.textMuted, fontSize: 9 }}>{isCollapsed ? '▶' : '▼'}</span>
        <span>{label}</span>
      </div>
      {selectedName && onDeselect ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ color: theme.color.primaryDark, fontWeight: 600, fontSize: theme.fontSize.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedName}
            <span style={{ color: theme.color.primaryMid, fontWeight: 400, marginLeft: 3 }}>{selectedId}</span>
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDeselect(); }}
            title={`Deselect ${label.toLowerCase()}`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: theme.color.textMuted, fontSize: theme.fontSize.icon, lineHeight: 1, padding: '4px 6px', flexShrink: 0 }}
          >×</button>
        </div>
      ) : (
        <span style={{ fontWeight: 400, color: theme.color.textMuted }}>
          {count < total ? `${count} / ${total}` : total}
        </span>
      )}
    </div>
  );
}

function SearchableList({
  items, selectedId, onSelect, placeholder, highlightBg, highlightText, noResults,
}: {
  items: GeoItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder: string;
  highlightBg: string;
  highlightText: string;
  noResults: string;
}) {
  const { locale } = useLang();
  const [query, setQuery] = useState('');

  const displayName = (item: GeoItem) => locale === 'th' && item.name_th ? item.name_th : item.name;

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.name_th && i.name_th.toLowerCase().includes(q)) ||
      i.id.includes(q)
    );
  }, [items, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: '6px 8px', borderBottom: `1px solid ${theme.color.border}`, flexShrink: 0 }}>
        <input
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
      <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
        {filtered.map(item => (
          <li
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              padding: '8px 12px', borderBottom: `1px solid ${theme.color.subtleBg}`,
              cursor: 'pointer', fontSize: theme.fontSize.sm,
              background: selectedId === item.id ? highlightBg : 'transparent',
              color: selectedId === item.id ? highlightText : theme.color.textBody,
              fontWeight: selectedId === item.id ? 600 : 400,
            }}
          >
            {displayName(item)} <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>{item.id}</span>
          </li>
        ))}
        {filtered.length === 0 && (
          <li style={{ padding: '8px 12px', color: theme.color.textMuted, fontSize: theme.fontSize.sm, fontStyle: 'italic' }}>
            {noResults}
          </li>
        )}
      </ul>
    </div>
  );
}

export default function ProvinceSelector({
  provinces, selectedProvince, selectedAmphoe, selectedTambon,
  onSelect, onSelectAmphoe, onDeselectAmphoe, onSelectTambon, onDeselectTambon,
  amphoeList, tambonList,
}: {
  provinces: Province[];
  selectedProvince: string;
  selectedAmphoe: string;
  selectedTambon: string;
  onSelect: (id: string) => void;
  onSelectAmphoe: (id: string) => void;
  onDeselectAmphoe: () => void;
  onSelectTambon: (id: string) => void;
  onDeselectTambon: () => void;
  amphoeList: GeoItem[];
  tambonList: GeoItem[];
}) {
  const { locale, t } = useLang();
  const localName = (item: GeoItem | Province | undefined) =>
    item ? (locale === 'th' && item.name_th ? item.name_th : item.name) : '';
  const selectedProvinceName = localName(provinces.find(p => p.id === selectedProvince));
  const selectedAmphoeName = localName(amphoeList.find(a => a.id === selectedAmphoe));
  const selectedTambonName = localName(tambonList.find(t => t.id === selectedTambon));

  const [provinceCollapsed, setProvinceCollapsed] = useState(false);
  const [amphoeCollapsed, setAmphoeCollapsed] = useState(false);
  const [tambonCollapsed, setTambonCollapsed] = useState(false);

  useEffect(() => { setProvinceCollapsed(!!selectedProvince); }, [selectedProvince]);
  useEffect(() => { if (selectedProvince) setAmphoeCollapsed(false); }, [selectedProvince]);
  useEffect(() => { if (!selectedAmphoe) setAmphoeCollapsed(false); }, [selectedAmphoe]);
  useEffect(() => { if (selectedAmphoe) setTambonCollapsed(false); }, [selectedAmphoe]);
  useEffect(() => { if (!selectedTambon) setTambonCollapsed(false); }, [selectedTambon]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Province */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: provinceCollapsed ? 'none' : 1, minHeight: 0, borderBottom: `1px solid ${theme.color.border}` }}>
        <SectionHeader
          label={t.selector.province} count={provinces.length} total={provinces.length}
          selectedName={selectedProvinceName || undefined}
          selectedId={selectedProvince || undefined}
          onDeselect={selectedProvince ? () => onSelect('') : undefined}
          isCollapsed={provinceCollapsed}
          onToggle={() => setProvinceCollapsed(c => !c)}
        />
        {!provinceCollapsed && (
          <SearchableList
            items={provinces}
            selectedId={selectedProvince}
            onSelect={onSelect}
            placeholder={t.selector.searchProvince}
            highlightBg={theme.color.primaryLight}
            highlightText={theme.color.primaryDark}
            noResults={t.selector.noResults}
          />
        )}
      </div>

      {/* Amphoe */}
      {selectedProvince && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: amphoeCollapsed ? 'none' : 1, minHeight: 0, borderBottom: `1px solid ${theme.color.border}` }}>
          <SectionHeader
            label={t.selector.amphoe} count={amphoeList.length} total={amphoeList.length}
            selectedName={selectedAmphoeName || undefined}
            selectedId={selectedAmphoe || undefined}
            onDeselect={selectedAmphoe ? onDeselectAmphoe : undefined}
            isCollapsed={amphoeCollapsed}
            onToggle={() => setAmphoeCollapsed(c => !c)}
          />
          {!amphoeCollapsed && (
            <SearchableList
              items={amphoeList}
              selectedId={selectedAmphoe}
              onSelect={onSelectAmphoe}
              placeholder={t.selector.searchAmphoe}
              highlightBg={theme.color.primaryLight}
              highlightText={theme.color.primaryDark}
              noResults={t.selector.noResults}
            />
          )}
        </div>
      )}

      {/* Tambon */}
      {selectedAmphoe && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: tambonCollapsed ? 'none' : 1, minHeight: 0 }}>
          <SectionHeader
            label={t.selector.tambon} count={tambonList.length} total={tambonList.length}
            selectedName={selectedTambonName || undefined}
            selectedId={selectedTambon || undefined}
            onDeselect={selectedTambon ? onDeselectTambon : undefined}
            isCollapsed={tambonCollapsed}
            onToggle={() => setTambonCollapsed(c => !c)}
          />
          {!tambonCollapsed && (
            <SearchableList
              items={tambonList}
              selectedId={selectedTambon}
              onSelect={onSelectTambon}
              placeholder={t.selector.searchTambon}
              highlightBg={theme.color.secondaryLight}
              highlightText={theme.color.secondary}
              noResults={t.selector.noResults}
            />
          )}
        </div>
      )}

    </div>
  );
}
