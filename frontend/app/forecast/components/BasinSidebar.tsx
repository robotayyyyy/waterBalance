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
  onSelectBasin: (b: Basin) => void;
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
  const basinName = (b: Basin) => locale === 'th' ? BASIN_META[b].labelTh : BASIN_META[b].label;
  const colorMap = useMemo(() => new Map(colorData.map(r => [r.id, r.value])), [colorData]);

  const l1Items = useMemo(() => l1DetailData.map(r => ({ id: r.id, name: r.name || r.id })), [l1DetailData]);
  const l2Items = useMemo(() => detailData.map(r => ({ id: r.id })), [detailData]);

  const colorDot = (value: number | undefined) => value !== undefined ? (
    <div style={{ width: 10, height: 10, borderRadius: theme.radius.sm, background: valueToColor(value, mode), border: `1px solid ${theme.color.border}`, flexShrink: 0, display: 'inline-block' }} />
  ) : null;

  const drillBtn = (label: string, onClick: () => void) => (
    <div
      onClick={onClick}
      style={{
        padding: '6px 12px', fontSize: theme.fontSize.xs, fontWeight: 600,
        color: theme.color.primary, background: theme.color.primaryLight,
        border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
        cursor: 'pointer', userSelect: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
      }}
    >
      <span>{label}</span>
      <span>→</span>
    </div>
  );

  const backBtn = (
    <button
      data-testid="basin-back-btn"
      onClick={onBack}
      style={{
        border: 'none', background: 'none', cursor: 'pointer',
        color: theme.color.primary, fontSize: theme.fontSize.xs, fontWeight: 600,
        padding: '4px 0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      ← {t.basin.back}
    </button>
  );

  return (
    <div style={{ padding: '10px 12px' }}>

      {/* Watershed */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>
          {t.basin.watershed}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', border: `1px solid ${theme.color.borderInput}`,
          borderRadius: theme.radius.md, background: theme.color.primaryLight,
          fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.color.primaryDark,
        }}>
          {colorDot(colorMap.get(BASIN_META[selectedBasin].mbCode))}
          <span style={{ flex: 1 }}>{basinName(selectedBasin)}</span>
          {SHOW_ID && <span style={{ color: theme.color.textMuted, fontSize: 10 }}>{BASIN_META[selectedBasin].mbCode}</span>}
        </div>
      </div>

      {/* Watershed level: drill buttons */}
      {basinLevel === 'watershed' && (
        <>
          {drillBtn(t.basin.drillL1, onDrillL1)}
          {enableL2 && drillBtn(t.basin.drillL2All, onDrillL2FromWatershed)}
        </>
      )}

      {/* Sub-basin L1 */}
      {(basinLevel === 'subbasin-l1' || basinLevel === 'subbasin-l2') && (
        <>
          {basinLevel === 'subbasin-l1' && backBtn}
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
          {enableL2 && basinLevel === 'subbasin-l1' && drillBtn(t.basin.drillL2, onDrillL2)}
        </>
      )}

      {/* Sub-basin L2 */}
      {enableL2 && basinLevel === 'subbasin-l2' && (
        <>
          {backBtn}
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
