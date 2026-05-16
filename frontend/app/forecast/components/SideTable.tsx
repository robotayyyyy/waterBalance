'use client';

import { useState, useMemo } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme, dataColors } from '../theme';
import { SHOW_ID } from '../config';

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

const wbColor = (v: string | number) =>
  Number(v) >= 0 ? dataColors.waterBalance.positive : dataColors.waterBalance.negative;

function fmt(v: string | number, dec = 2) {
  const n = Number(v);
  return isNaN(n) ? '-' : n.toLocaleString(undefined, { maximumFractionDigits: dec });
}

// Colors that need white text (dark backgrounds)
const DARK_BG = new Set(['#fe0000', '#005be7']);

function IndexBadge({ index, colorScale, label }: {
  index: number;
  colorScale: Record<number, string>;
  label: string;
}) {
  const bg = colorScale[index] ?? dataColors.noData;
  const textColor = DARK_BG.has(bg) ? '#ffffff' : theme.color.textPrimary;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: theme.radius.md,
      background: bg,
      color: textColor,
      fontSize: theme.fontSize.xs,
      fontWeight: 600,
      border: `1px solid rgba(0,0,0,0.18)`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function exportCsv(rows: Row[], levelLabel: string, headers: string[], mode: 'drought' | 'runoff' | 'waterbalance') {
  const rowData = (r: Row) => {
    if (mode === 'drought')
      return [`"${r.name}"`, r.drought_index, r.water_balance, r.rainfall, r.watersupply, r.reservoir, r.water_demand];
    if (mode === 'runoff')
      return [`"${r.name}"`, r.runoff_index, r.water_balance, r.rainfall, r.watersupply, r.reservoir, r.water_demand];
    return [`"${r.name}"`, r.water_balance, r.drought_index, r.runoff_index, r.rainfall, r.watersupply, r.reservoir, r.water_demand];
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => rowData(r).join(',')),
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

const COL_SORT_KEYS: (SortKey | null)[] = [
  'name', 'water_balance', 'drought_index', 'runoff_index', 'rainfall', 'watersupply', 'reservoir', 'water_demand',
];
const COL_SORT_KEYS_DROUGHT: (SortKey | null)[] = [
  'name', 'drought_index', 'water_balance', 'rainfall', 'watersupply', 'reservoir', 'water_demand',
];
const COL_SORT_KEYS_RUNOFF: (SortKey | null)[] = [
  'name', 'runoff_index', 'water_balance', 'rainfall', 'watersupply', 'reservoir', 'water_demand',
];

function swatZipUrl(watershed: 'ping' | 'yom', viewMode: 'admin' | 'basin', adminLevel: string, basinLevel: string): string {
  const code = watershed === 'ping' ? '06' : '08';
  if (viewMode === 'admin') {
    if (adminLevel === 'tambon')  return `/downloads/01Tambol_Basin${code}.zip`;
    if (adminLevel === 'amphoe')  return `/downloads/02Amphoe_Basin${code}.zip`;
    return `/downloads/03Province_Basin${code}.zip`;
  }
  if (basinLevel === 'subbasin-l2') return `/downloads/Basin${code}_Sbswat.zip`;
  if (basinLevel === 'subbasin-l1') return `/downloads/Basin${code}_Sbonwr.zip`;
  return `/downloads/Basin${code}_bonwr.zip`;
}

export default function SideTable({ rows, activeLevel, selectedId, onRowClick, watershed, viewMode, basinLevel, model, mode, hideToolbar }: {
  rows: Row[];
  activeLevel: string;
  selectedId?: string;
  onRowClick?: (id: string) => void;
  watershed: 'ping' | 'yom';
  viewMode: 'admin' | 'basin';
  basinLevel: string;
  model: '7days' | '6months';
  mode: 'drought' | 'runoff' | 'waterbalance';
  hideToolbar?: boolean;
}) {
  const { locale, t } = useLang();
  const displayName = (r: Row) => locale === 'th' && r.name_th ? r.name_th : r.name;

  const droughtLabels: Record<number, string> = {
    0: t.legend.normal,
    1: t.legend.watch,
    2: t.legend.warning,
    3: t.legend.critical,
  };
  const runoffLabels: Record<number, string> = {
    0: t.legend.normal,
    1: t.legend.low,
    2: t.legend.high,
    3: t.legend.extreme,
  };

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const levelLabel = viewMode === 'basin'
    ? (basinLevel === 'watershed' ? t.table.watershed : basinLevel === 'subbasin-l1' ? t.table.subbasinL1 : t.table.subbasinL2)
    : (activeLevel === 'province' ? t.table.province : activeLevel === 'amphoe' ? t.table.amphoe : t.table.tambon);
  const rainfallLabel = model === '7days' ? t.table.rainfall7days : t.table.rainfall6months;
  const headers = mode === 'drought'
    ? [levelLabel, t.table.drought, t.table.waterbalance, rainfallLabel, t.table.watersupply, t.table.reservoir, t.table.waterdemand]
    : mode === 'runoff'
    ? [levelLabel, t.table.runoff, t.table.waterbalance, rainfallLabel, t.table.watersupply, t.table.reservoir, t.table.waterdemand]
    : [levelLabel, t.table.waterbalance, t.table.drought, t.table.runoff, rainfallLabel, t.table.watersupply, t.table.reservoir, t.table.waterdemand];

  const colSortKeys = mode === 'drought' ? COL_SORT_KEYS_DROUGHT : mode === 'runoff' ? COL_SORT_KEYS_RUNOFF : COL_SORT_KEYS;

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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.color.textMuted, fontSize: theme.fontSize.base, background: theme.color.pageBg }}>
        {t.table.empty}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: theme.color.pageBg }}>

      {/* Toolbar */}
      {!hideToolbar && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '4px 10px', borderBottom: `1px solid ${theme.color.border}`, flexShrink: 0, background: theme.color.toolbarBg }}>
        <button
          onClick={() => exportCsv(sortedRows, levelLabel, headers, mode)}
          style={{ padding: '3px 10px', border: `1px solid ${theme.color.borderInput}`, borderRadius: theme.radius.md, background: theme.color.pageBg, color: theme.color.textBody, fontSize: theme.fontSize.xs, cursor: 'pointer', fontWeight: 500 }}
        >
          {t.table.export}
        </button>
        <a
          href={swatZipUrl(watershed, viewMode, activeLevel, basinLevel)}
          download
          style={{ padding: '3px 10px', border: `1px solid ${theme.color.borderInput}`, borderRadius: theme.radius.md, background: theme.color.pageBg, color: theme.color.textBody, fontSize: theme.fontSize.xs, cursor: 'pointer', fontWeight: 500, textDecoration: 'none' }}
        >
          {t.table.downloadSwat}
        </a>
      </div>}

      {/* Table */}
      <div
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}
      >
        <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: theme.fontSize.sm }}>
          <thead>
            <tr>
              {headers.map((h, i) => {
                const key = colSortKeys[i];
                const active = key && sortKey === key;
                return (
                  <th
                    key={h}
                    onClick={() => handleSort(key)}
                    style={{
                      padding: '6px 10px',
                      background: active ? theme.color.subtleBg : theme.color.surfaceBg,
                      borderBottom: `1px solid ${theme.color.border}`,
                      textAlign: 'left', fontSize: theme.fontSize.xs, fontWeight: 600,
                      color: active ? theme.color.darkBtnBg : theme.color.textLabel,
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
              <tr
                key={r.id}
                onClick={() => onRowClick?.(r.id)}
                style={{
                  borderBottom: `1px solid ${theme.color.subtleBg}`,
                  background: r.id === selectedId ? theme.color.primaryLight : 'transparent',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
              >
                <td style={{ padding: '6px 10px', color: theme.color.textPrimary, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: r.id === selectedId ? theme.color.primaryLight : theme.color.pageBg, zIndex: 1, borderRight: `1px solid ${theme.color.border}` }}>
                  {displayName(r)} {SHOW_ID && <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>{r.id}</span>}
                </td>
                {mode === 'drought' ? (
                  <>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <IndexBadge index={r.drought_index} colorScale={dataColors.drought} label={droughtLabels[r.drought_index] ?? String(r.drought_index)} />
                    </td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 11, height: 11, borderRadius: '50%', background: wbColor(r.water_balance), flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: wbColor(r.water_balance) }}>{fmt(r.water_balance)}</span>
                      </span>
                    </td>
                  </>
                ) : mode === 'runoff' ? (
                  <>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <IndexBadge index={r.runoff_index} colorScale={dataColors.runoff} label={runoffLabels[r.runoff_index] ?? String(r.runoff_index)} />
                    </td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 11, height: 11, borderRadius: '50%', background: wbColor(r.water_balance), flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: wbColor(r.water_balance) }}>{fmt(r.water_balance)}</span>
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 11, height: 11, borderRadius: '50%', background: wbColor(r.water_balance), flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: wbColor(r.water_balance) }}>{fmt(r.water_balance)}</span>
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <IndexBadge index={r.drought_index} colorScale={dataColors.drought} label={droughtLabels[r.drought_index] ?? String(r.drought_index)} />
                    </td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <IndexBadge index={r.runoff_index} colorScale={dataColors.runoff} label={runoffLabels[r.runoff_index] ?? String(r.runoff_index)} />
                    </td>
                  </>
                )}
                <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.rainfall)}</td>
                <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.watersupply)}</td>
                <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.reservoir)}</td>
                <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.water_demand)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
