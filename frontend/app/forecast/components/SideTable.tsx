'use client';

import { useState, useMemo } from 'react';
import { useLang } from '../../i18n/LangContext';

type Row = {
  id: string;
  name: string;
  name_th?: string;
  rainfall: string | number;
  watersupply: string | number;
  reservoir: string | number;
  water_demand: string | number;
  water_balance: string | number;
  drought_index: number;
  runoff_index: number;
};

type SortKey = 'name' | 'rainfall' | 'watersupply' | 'reservoir' | 'water_demand' | 'water_balance' | 'drought_index' | 'runoff_index';
type SortDir = 'asc' | 'desc';

const DROUGHT_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#feff73', 2: '#ffaa01', 3: '#fe0000' };
const RUNOFF_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#bee8ff', 2: '#01c5ff', 3: '#005be7' };
const wbColor = (v: string | number) => Number(v) >= 0 ? '#2563eb' : '#dc2626';

function fmt(v: string | number, dec = 2) {
  const n = Number(v);
  return isNaN(n) ? '-' : n.toLocaleString(undefined, { maximumFractionDigits: dec });
}

function exportCsv(rows: Row[], levelLabel: string, headers: string[]) {
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      `"${r.name}"`, r.id, r.rainfall, r.watersupply, r.reservoir, r.water_demand, r.water_balance, r.drought_index, r.runoff_index,
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `water-forecast-${levelLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SORT_ARROW: Record<SortDir, string> = { asc: ' ▲', desc: ' ▼' };

// Maps header index → sort key (index 1 = ID column, not sortable)
const COL_SORT_KEYS: (SortKey | null)[] = [
  'name', null, 'rainfall', 'watersupply', 'reservoir', 'water_demand', 'water_balance', 'drought_index', 'runoff_index',
];

export default function SideTable({ rows, activeLevel }: { rows: Row[]; activeLevel: string }) {
  const { locale, t } = useLang();
  const displayName = (r: Row) => locale === 'th' && r.name_th ? r.name_th : r.name;

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const levelLabel = activeLevel === 'province' ? t.table.province : activeLevel === 'amphoe' ? t.table.amphoe : t.table.tambon;
  const headers = [levelLabel, 'ID', t.table.rainfall, t.table.watersupply, t.table.reservoir, t.table.waterdemand, t.table.waterbalance, t.table.drought, t.table.runoff];

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sortKey === 'name') {
        av = displayName(a).toLowerCase();
        bv = displayName(b).toLowerCase();
      } else {
        av = Number(a[sortKey]);
        bv = Number(b[sortKey]);
        if (isNaN(av as number)) av = -Infinity;
        if (isNaN(bv as number)) bv = -Infinity;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir, locale]);

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (rows.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, background: '#fff' }}>
        {t.table.empty}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 10px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: '#fafafa' }}>
        <button
          onClick={() => exportCsv(sortedRows, levelLabel, headers)}
          style={{ padding: '3px 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#475569', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
        >
          {t.table.export}
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {headers.map((h, i) => {
                const key = COL_SORT_KEYS[i];
                const active = key && sortKey === key;
                return (
                  <th
                    key={h}
                    onClick={() => handleSort(key)}
                    style={{
                      padding: '6px 10px', background: active ? '#f1f5f9' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      textAlign: 'left', fontSize: 11, fontWeight: 600,
                      color: active ? '#334155' : '#64748b',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                      position: 'sticky', top: 0, zIndex: i === 0 ? 3 : 1,
                      cursor: key ? 'pointer' : 'default',
                      userSelect: 'none',
                      ...(i === 0 ? { left: 0, zIndex: 3 } : {}),
                    }}
                  >
                    {h}{active ? SORT_ARROW[sortDir] : key ? ' ⇅' : ''}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 10px', color: '#1e293b', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff', zIndex: 1, borderRight: '1px solid #e2e8f0' }}>
                  {displayName(r)} <span style={{ color: '#94a3b8', fontSize: 11 }}>{r.id}</span>
                </td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{r.id}</td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmt(r.rainfall)}</td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmt(r.watersupply)}</td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmt(r.reservoir)}</td>
                <td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmt(r.water_demand)}</td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: wbColor(r.water_balance), flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, color: wbColor(r.water_balance) }}>{fmt(r.water_balance)}</span>
                  </span>
                </td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: DROUGHT_COLORS[r.drought_index] ?? '#cccccc', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{r.drought_index}</span>
                  </span>
                </td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: RUNOFF_COLORS[r.runoff_index] ?? '#cccccc', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{r.runoff_index}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
