'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme, dataColors, wbLevelToBucket, rainfallToIndex } from '../theme';
import type { Mode } from '../theme';
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
  wb_level: number;
  drought_index: number;
  runoff_index: number;
};

type SortKey = 'name' | 'rainfall' | 'watersupply' | 'reservoir' | 'water_demand' | 'wb_level' | 'drought_index' | 'runoff_index';
type SortDir = 'asc' | 'desc';

function fmt(v: string | number, dec = 2) {
  const n = Number(v);
  return isNaN(n) ? '-' : n.toLocaleString(undefined, { maximumFractionDigits: dec });
}

// Colors that need white text (dark backgrounds)
const DARK_BG = new Set([
  dataColors.drought[3], dataColors.runoff[3],
  dataColors.waterBalance[4], dataColors.waterBalance[5], dataColors.waterBalance[6],
  dataColors.rainfall[4], dataColors.rainfall[5], dataColors.rainfall[6],
]);

function IndexBadge({ index, colorScale, label, testId }: {
  index: number;
  colorScale: Record<number, string>;
  label: string;
  testId?: string;
}) {
  const bg = colorScale[index] ?? dataColors.noData;
  const textColor = DARK_BG.has(bg) ? theme.color.textOnDark : theme.color.textPrimary;
  return (
    <span
      data-testid={testId}
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: theme.radius.md,
        background: bg,
        color: textColor,
        fontSize: theme.fontSize.xs,
        fontWeight: 600,
        border: `1px solid rgba(0,0,0,0.18)`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function exportCsv(rows: Row[], levelLabel: string, headers: string[], mode: Mode, showRainfall: boolean) {
  const rowData = (r: Row) => {
    if (mode === 'drought')
      return showRainfall
        ? [`"${r.name}"`, r.drought_index, r.wb_level, r.runoff_index, r.water_demand, r.watersupply, r.rainfall, r.reservoir]
        : [`"${r.name}"`, r.drought_index, r.wb_level, r.runoff_index, r.water_demand, r.watersupply, r.reservoir];
    if (mode === 'runoff')
      return showRainfall
        ? [`"${r.name}"`, r.runoff_index, r.wb_level, r.drought_index, r.water_demand, r.watersupply, r.rainfall, r.reservoir]
        : [`"${r.name}"`, r.runoff_index, r.wb_level, r.drought_index, r.water_demand, r.watersupply, r.reservoir];
    if (mode === 'rainfall')
      return [`"${r.name}"`, rainfallToIndex(r.rainfall), r.rainfall, r.water_demand, r.watersupply, r.reservoir];
    return showRainfall
      ? [`"${r.name}"`, r.wb_level, r.drought_index, r.runoff_index, r.water_demand, r.watersupply, r.rainfall, r.reservoir]
      : [`"${r.name}"`, r.wb_level, r.drought_index, r.runoff_index, r.water_demand, r.watersupply, r.reservoir];
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
  'name', 'wb_level', 'water_demand', 'watersupply', 'rainfall', 'reservoir',
];
const COL_SORT_KEYS_DROUGHT: (SortKey | null)[] = [
  'name', 'drought_index', 'water_demand', 'watersupply', 'rainfall', 'reservoir',
];
const COL_SORT_KEYS_RUNOFF: (SortKey | null)[] = [
  'name', 'runoff_index', 'water_demand', 'watersupply', 'rainfall', 'reservoir',
];
// Rainfall mode: sort by rainfall mm (monotone proxy for rainfall index)
const COL_SORT_KEYS_RAINFALL: (SortKey | null)[] = [
  'name', 'rainfall', 'rainfall', 'water_demand', 'watersupply', 'reservoir',
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

export default function SideTable({ rows, activeLevel, selectedId, onRowClick, watershed, viewMode, basinLevel, model, mode, hideToolbar, showRainfall = true }: {
  rows: Row[];
  activeLevel: string;
  selectedId?: string;
  onRowClick?: (id: string) => void;
  watershed: 'ping' | 'yom';
  viewMode: 'admin' | 'basin';
  basinLevel: string;
  model: '7days' | '6months';
  mode: Mode;
  hideToolbar?: boolean;
  showRainfall?: boolean;
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
  const wbLabels: Record<number, string> = {
    0: t.legend.wb0, 1: t.legend.wb1, 2: t.legend.wb2,
    3: t.legend.wb3, 4: t.legend.wb4, 5: t.legend.wb5, 6: t.legend.wb6,
  };
  const rainfallLabels: Record<number, string> = {
    0: t.rainfall.r0, 1: t.rainfall.r1, 2: t.rainfall.r2,
    3: t.rainfall.r3, 4: t.rainfall.r4, 5: t.rainfall.r5, 6: t.rainfall.r6,
  };

  const defaultSort = (m: Mode): { key: SortKey; dir: SortDir } =>
    m === 'waterbalance' ? { key: 'wb_level',      dir: 'desc' }
    : m === 'runoff'     ? { key: 'runoff_index',   dir: 'desc' }
    : m === 'rainfall'   ? { key: 'rainfall',        dir: 'desc' }
    :                      { key: 'drought_index',   dir: 'desc' };

  const [sortKey, setSortKey] = useState<SortKey>(() => defaultSort(mode).key);
  const [sortDir, setSortDir] = useState<SortDir>(() => defaultSort(mode).dir);

  useEffect(() => {
    const d = defaultSort(mode);
    setSortKey(d.key);
    setSortDir(d.dir);
  }, [mode]);

  const levelLabel = viewMode === 'basin'
    ? (basinLevel === 'watershed' ? t.table.watershed : basinLevel === 'subbasin-l1' ? t.table.subbasinL1 : t.table.subbasinL2)
    : (activeLevel === 'province' ? t.table.province : activeLevel === 'amphoe' ? t.table.amphoe : t.table.tambon);
  const rainfallLabel = model === '7days' ? t.table.rainfall7days : t.table.rainfall6months;

  const headers = mode === 'drought'
    ? [levelLabel, t.table.drought,       t.table.waterdemand, t.table.watersupply, ...(showRainfall ? [rainfallLabel] : []), t.table.reservoir]
    : mode === 'runoff'
    ? [levelLabel, t.table.runoff,        t.table.waterdemand, t.table.watersupply, ...(showRainfall ? [rainfallLabel] : []), t.table.reservoir]
    : mode === 'rainfall'
    ? [levelLabel, t.table.rainfallIndex, rainfallLabel,       t.table.waterdemand, t.table.watersupply,  t.table.reservoir]
    : [levelLabel, t.table.waterbalance,  t.table.waterdemand, t.table.watersupply, ...(showRainfall ? [rainfallLabel] : []), t.table.reservoir];

  const colSortKeysBase =
    mode === 'drought'  ? COL_SORT_KEYS_DROUGHT  :
    mode === 'runoff'   ? COL_SORT_KEYS_RUNOFF   :
    mode === 'rainfall' ? COL_SORT_KEYS_RAINFALL  :
                          COL_SORT_KEYS;
  // Drop the rainfall sort key (index 4) from non-rainfall modes when showRainfall is false
  const colSortKeys = (!showRainfall && mode !== 'rainfall')
    ? [...colSortKeysBase.slice(0, 4), ...colSortKeysBase.slice(5)]
    : colSortKeysBase;

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
          data-testid="export-csv-btn"
          onClick={() => exportCsv(sortedRows, levelLabel, headers, mode, showRainfall)}
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
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table data-testid="side-table" style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: theme.fontSize.sm }}>
          <thead>
            <tr>
              {headers.map((h, i) => {
                const key = colSortKeys[i];
                const active = key && sortKey === key;
                return (
                  <th
                    key={`${h}-${i}`}
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
                data-testid={`table-row-${r.id}`}
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

                {/* Primary index column */}
                {mode === 'drought' ? (
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <IndexBadge index={r.drought_index} colorScale={dataColors.drought} label={droughtLabels[r.drought_index] ?? String(r.drought_index)} />
                  </td>
                ) : mode === 'runoff' ? (
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <IndexBadge index={r.runoff_index} colorScale={dataColors.runoff} label={runoffLabels[r.runoff_index] ?? String(r.runoff_index)} />
                  </td>
                ) : mode === 'rainfall' ? (
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <IndexBadge
                      index={rainfallToIndex(r.rainfall)}
                      colorScale={dataColors.rainfall}
                      label={rainfallLabels[rainfallToIndex(r.rainfall)] ?? String(rainfallToIndex(r.rainfall))}
                      testId="rainfall-index-badge"
                    />
                  </td>
                ) : (
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <IndexBadge index={wbLevelToBucket(r.wb_level)} colorScale={dataColors.waterBalance} label={wbLabels[wbLevelToBucket(r.wb_level)] ?? '-'} />
                  </td>
                )}

                {/* Rainfall mm col — only in rainfall mode */}
                {mode === 'rainfall' && (
                  <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.rainfall)}</td>
                )}

                <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.water_demand)}</td>
                <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.watersupply)}</td>

                {/* Rainfall mm col — in non-rainfall modes, only when showRainfall */}
                {mode !== 'rainfall' && showRainfall && (
                  <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.rainfall)}</td>
                )}

                <td style={{ padding: '6px 10px', color: theme.color.textBody, whiteSpace: 'nowrap' }}>{fmt(r.reservoir)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
