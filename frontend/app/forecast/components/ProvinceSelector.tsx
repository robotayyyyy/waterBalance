'use client';
import { useState, useMemo, useEffect } from 'react';

type Province = { id: string; name: string };
type GeoItem = { id: string; name: string; [key: string]: any };

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
        padding: '5px 12px', fontSize: 11, fontWeight: 600, color: '#64748b',
        textTransform: 'uppercase', background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 4, cursor: 'pointer', userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ color: '#94a3b8', fontSize: 9 }}>{isCollapsed ? '▶' : '▼'}</span>
        <span>{label}</span>
      </div>
      {selectedName && onDeselect ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedName}
            <span style={{ color: '#93c5fd', fontWeight: 400, marginLeft: 3 }}>{selectedId}</span>
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDeselect(); }}
            title={`Deselect ${label.toLowerCase()}`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: '4px 6px', flexShrink: 0 }}
          >×</button>
        </div>
      ) : (
        <span style={{ fontWeight: 400, color: '#94a3b8' }}>
          {count < total ? `${count} / ${total}` : total}
        </span>
      )}
    </div>
  );
}

function SearchableList({
  items, selectedId, onSelect, placeholder, highlightColor, highlightText,
}: {
  items: GeoItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder: string;
  highlightColor: string;
  highlightText: string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || i.id.includes(q));
  }, [items, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1',
            borderRadius: 4, fontSize: 12, boxSizing: 'border-box',
            outline: 'none', color: '#1e293b', background: '#fff',
          }}
        />
      </div>
      <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
        {filtered.map(item => (
          <li
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
              cursor: 'pointer', fontSize: 12,
              background: selectedId === item.id ? highlightColor : 'transparent',
              color: selectedId === item.id ? highlightText : '#475569',
              fontWeight: selectedId === item.id ? 600 : 400,
            }}
          >
            {item.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>{item.id}</span>
          </li>
        ))}
        {filtered.length === 0 && (
          <li style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
            No results
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
  const selectedProvinceName = provinces.find(p => p.id === selectedProvince)?.name ?? '';
  const selectedAmphoeName = amphoeList.find(a => a.id === selectedAmphoe)?.name ?? '';
  const selectedTambonName = tambonList.find(t => t.id === selectedTambon)?.name ?? '';

  const [provinceCollapsed, setProvinceCollapsed] = useState(false);
  const [amphoeCollapsed, setAmphoeCollapsed] = useState(false);
  const [tambonCollapsed, setTambonCollapsed] = useState(false);

  // Auto-collapse province on select, auto-expand on deselect
  useEffect(() => {
    setProvinceCollapsed(!!selectedProvince);
  }, [selectedProvince]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Province */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: provinceCollapsed ? 'none' : 1, minHeight: 0, borderBottom: '1px solid #e2e8f0' }}>
        <SectionHeader
          label="Province" count={provinces.length} total={provinces.length}
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
            placeholder="Search province…"
            highlightColor="#eff6ff"
            highlightText="#1d4ed8"
          />
        )}
      </div>

      {/* Amphoe — shown when province selected */}
      {selectedProvince && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: amphoeCollapsed ? 'none' : 1, minHeight: 0, borderBottom: '1px solid #e2e8f0' }}>
          <SectionHeader
            label="Amphoe" count={amphoeList.length} total={amphoeList.length}
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
              placeholder="Search amphoe…"
              highlightColor="#eff6ff"
              highlightText="#1d4ed8"
            />
          )}
        </div>
      )}

      {/* Tambon — shown when amphoe selected */}
      {selectedAmphoe && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: tambonCollapsed ? 'none' : 1, minHeight: 0 }}>
          <SectionHeader
            label="Tambon" count={tambonList.length} total={tambonList.length}
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
              placeholder="Search tambon…"
              highlightColor="#fefce8"
              highlightText="#b45309"
            />
          )}
        </div>
      )}

    </div>
  );
}
