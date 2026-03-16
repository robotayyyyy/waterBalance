'use client';
import { useState, useMemo } from 'react';

type Province = { id: string; name: string };
type GeoItem = { id: string; name: string; [key: string]: any };

function SectionHeader({ label, count, total, selectedName, selectedId, onDeselect }: {
  label: string;
  count: number;
  total: number;
  selectedName?: string;
  selectedId?: string;
  onDeselect?: () => void;
}) {
  return (
    <div style={{
      padding: '5px 12px', fontSize: 11, fontWeight: 600, color: '#64748b',
      textTransform: 'uppercase', background: '#f8fafc',
      borderBottom: '1px solid #e2e8f0', flexShrink: 0,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 4,
    }}>
      <span style={{ flexShrink: 0 }}>{label}</span>
      {selectedName && onDeselect ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedName}
            <span style={{ color: '#93c5fd', fontWeight: 400, marginLeft: 3 }}>{selectedId}</span>
          </span>
          <button
            onClick={onDeselect}
            title={`Deselect ${label.toLowerCase()}`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: '1px 2px', flexShrink: 0 }}
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
              padding: '5px 12px', borderBottom: '1px solid #f1f5f9',
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
  provinces, selectedProvince, selectedAmphoe, selectedTambol,
  onSelect, onSelectAmphoe, onDeselectAmphoe, onSelectTambol, onDeselectTambol,
  amphoeList, tambolList,
}: {
  provinces: Province[];
  selectedProvince: string;
  selectedAmphoe: string;
  selectedTambol: string;
  onSelect: (id: string) => void;
  onSelectAmphoe: (id: string) => void;
  onDeselectAmphoe: () => void;
  onSelectTambol: (id: string) => void;
  onDeselectTambol: () => void;
  amphoeList: GeoItem[];
  tambolList: GeoItem[];
}) {
  const selectedProvinceName = provinces.find(p => p.id === selectedProvince)?.name ?? '';
  const selectedAmphoeName = amphoeList.find(a => a.id === selectedAmphoe)?.name ?? '';
  const selectedTambolName = tambolList.find(t => t.id === selectedTambol)?.name ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Province — collapsed chip when selected, full searchable list when not */}
      {selectedProvince ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
          background: '#eff6ff',
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 1 }}>
              Province
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>
              {selectedProvinceName}
              <span style={{ color: '#93c5fd', fontWeight: 400, marginLeft: 4, fontSize: 11 }}>{selectedProvince}</span>
            </div>
          </div>
          <button
            onClick={() => onSelect('')}
            title="Change province"
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: '#93c5fd', fontSize: 16, lineHeight: 1, padding: '2px 4px',
              borderRadius: 4,
            }}
          >×</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <SectionHeader label="Province" count={provinces.length} total={provinces.length} />
          <SearchableList
            items={provinces}
            selectedId={selectedProvince}
            onSelect={onSelect}
            placeholder="Search province…"
            highlightColor="#eff6ff"
            highlightText="#1d4ed8"
          />
        </div>
      )}

      {/* Amphoe — shown when province selected */}
      {selectedProvince && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderBottom: selectedAmphoe ? '1px solid #e2e8f0' : 'none' }}>
          <SectionHeader
            label="Amphoe" count={amphoeList.length} total={amphoeList.length}
            selectedName={selectedAmphoeName || undefined}
            selectedId={selectedAmphoe || undefined}
            onDeselect={selectedAmphoe ? onDeselectAmphoe : undefined}
          />
          <SearchableList
            items={amphoeList}
            selectedId={selectedAmphoe}
            onSelect={onSelectAmphoe}
            placeholder="Search amphoe…"
            highlightColor="#eff6ff"
            highlightText="#1d4ed8"
          />
        </div>
      )}

      {/* Tambol — shown when amphoe selected */}
      {selectedAmphoe && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <SectionHeader
            label="Tambol" count={tambolList.length} total={tambolList.length}
            selectedName={selectedTambolName || undefined}
            selectedId={selectedTambol || undefined}
            onDeselect={selectedTambol ? onDeselectTambol : undefined}
          />
          <SearchableList
            items={tambolList}
            selectedId={selectedTambol}
            onSelect={onSelectTambol}
            placeholder="Search tambol…"
            highlightColor="#fefce8"
            highlightText="#b45309"
          />
        </div>
      )}

    </div>
  );
}
