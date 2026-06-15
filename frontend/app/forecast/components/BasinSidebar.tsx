'use client';

import { useMemo } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme, valueToColor } from '../theme';
import type { Mode } from '../theme';
import { SHOW_ID } from '../config';
import SearchableDropdown from './SearchableDropdown';

export type Basin = 'ping' | 'yom';
export type BasinLevel = 'watershed' | 'subbasin-l1' | 'subbasin-l2';

const BASIN_META: Record<Basin, { label: string; labelTh: string; mbCode: string }> = {
  ping: { label: 'Ping', labelTh: 'ปิง', mbCode: '06' },
  yom:  { label: 'Yom',  labelTh: 'ยม',  mbCode: '08' },
};


type ColorRow = { id: string; value: number };
type DetailRow = { id: string; name?: string; mb_code?: string; [k: string]: any };

export default function BasinSidebar({
  basinLevel, selectedBasin, selectedL1, selectedL2, l2FilterSbCode,
  colorData, l1DetailData, detailData, l2PreviewData, mode,
  onSelectBasin, onSelectL1, onSelectL2, onSelectL2Preview,
  onDrillL1, onDrillL2, onDrillL2FromWatershed, onBack, enableL2,
}: {
  basinLevel: BasinLevel;
  selectedBasin: Basin;
  selectedL1: string | null;
  selectedL2: string | null;
  l2FilterSbCode: string | null;
  colorData: ColorRow[];
  l1DetailData: DetailRow[];
  detailData: DetailRow[];
  l2PreviewData: { id: string; value: number }[];
  mode: Mode;
  onSelectBasin: (id: string) => void;
  onSelectL1: (sbCode: string) => void;
  onSelectL2: (subbasinId: string) => void;
  onSelectL2Preview: (subbasinId: string) => void;
  onDrillL1: () => void;
  onDrillL2: () => void;
  onDrillL2FromWatershed: () => void;
  onBack: () => void;
  enableL2: boolean;
}) {
  const { locale, t } = useLang();
  const colorMap = useMemo(() => new Map(colorData.map(r => [r.id, r.value])), [colorData]);

  const l1Items = useMemo(() => l1DetailData.map(r => ({ id: r.id, name: r.name || r.id })), [l1DetailData]);
  const l2Items = useMemo(() => detailData.map(r => ({ id: r.id })), [detailData]);

  const colorDot = (value: number | undefined) => value !== undefined ? (
    <div style={{ width: 10, height: 10, borderRadius: theme.radius.sm, background: valueToColor(value, mode), border: `1px solid ${theme.color.border}`, flexShrink: 0, display: 'inline-block' }} />
  ) : null;
  const drillBtn = (label: string, placeholder: string, onClick: () => void) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel, textTransform: 'uppercase', marginBottom: 3, paddingLeft: 2 }}>
        {label}
      </div>
      <div
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 8px', border: `1px solid ${theme.color.borderInput}`,
          borderRadius: theme.radius.md, background: theme.color.pageBg,
          cursor: 'pointer', userSelect: 'none', minHeight: 32,
        }}
      >
        <span style={{ color: theme.color.textMuted, flex: 1, fontSize: theme.fontSize.sm }}>{placeholder}</span>
        <span style={{ color: theme.color.textMuted, fontSize: 9 }}>▼</span>
      </div>
    </div>
  );


  return (
    <div style={{ padding: '10px 12px' }}>

      {/* Watershed */}
      <SearchableDropdown
        items={[{ id: BASIN_META[selectedBasin].mbCode, name: BASIN_META[selectedBasin].label, name_th: BASIN_META[selectedBasin].labelTh }]}
        selectedId={BASIN_META[selectedBasin].mbCode}
        onSelect={onSelectBasin}
        placeholder={t.basin.watershed}
        label={t.basin.watershed}
        colorMap={colorMap}
        mode={mode}
        testId="watershed-dropdown"
        getLabel={item => item.name_th && locale === 'th' ? item.name_th : (item.name ?? item.id)}
      />

      {/* Watershed level: drill buttons */}
      {basinLevel === 'watershed' && (
        <>
          {drillBtn(t.basin.subbasinL1, t.basin.selectL1, onDrillL1)}
          {enableL2 && drillBtn(t.basin.subbasinL2, t.basin.selectL2, onDrillL2FromWatershed)}
        </>
      )}

      {/* Sub-basin L1 */}
      {(basinLevel === 'subbasin-l1' || basinLevel === 'subbasin-l2') && (
        <>
          <SearchableDropdown
            items={l1Items}
            selectedId={selectedL1}
            onSelect={onSelectL1}
            onDeselect={selectedL1 ? onBack : undefined}
            placeholder={t.basin.selectL1}
            label={t.basin.subbasinL1}
            colorMap={colorMap}
            mode={mode}
            testId="l1-dropdown"
          />
          {basinLevel === 'subbasin-l1' && selectedL1 && l2PreviewData.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel, textTransform: 'uppercase', marginBottom: 4, paddingLeft: 2, display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.basin.drillL2}</span>
                <span style={{ fontWeight: 400, color: theme.color.textMuted }}>{l2PreviewData.length}</span>
              </div>
              <ul style={{ maxHeight: 140, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md }}>
                {l2PreviewData.map(row => (
                  <li
                    key={row.id}
                    onClick={() => onSelectL2Preview(row.id)}
                    style={{ padding: '5px 10px', cursor: 'pointer', fontSize: theme.fontSize.sm, display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${theme.color.subtleBg}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = theme.color.surfaceBg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    {colorDot(row.value)}
                    <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>#{row.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {enableL2 && basinLevel === 'subbasin-l1' && drillBtn(t.basin.subbasinL2, t.basin.selectL2, onDrillL2)}
        </>
      )}

      {/* Sub-basin L2 */}
      {enableL2 && basinLevel === 'subbasin-l2' && (
        <>
          <SearchableDropdown
            items={l2Items}
            selectedId={selectedL2}
            onSelect={onSelectL2}
            onDeselect={selectedL2 ? onBack : undefined}
            placeholder={t.basin.selectL2}
            label={t.basin.subbasinL2}
            colorMap={colorMap}
            mode={mode}
            testId="l2-dropdown"
            getLabel={item => `#${item.id}`}
          />
        </>
      )}

    </div>
  );
}
