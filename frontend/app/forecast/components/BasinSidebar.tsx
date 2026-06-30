'use client';

import { useMemo } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';
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
  colorData, l1DetailData, detailData, mode,
  onSelectBasin, onSelectL1, onSelectL2,
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
  mode: Mode;
  onSelectBasin: (id: string) => void;
  onSelectL1: (sbCode: string) => void;
  onSelectL2: (subbasinId: string) => void;
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

  // L2 dropdown: visible when L1 selected (at L1 level) or drilled from a specific L1 (at L2 level)
  const showL2Dropdown = enableL2 && (
    (basinLevel === 'subbasin-l1' && selectedL1 !== null) ||
    (basinLevel === 'subbasin-l2' && l2FilterSbCode !== null)
  );

  return (
    <div style={{ padding: '10px 12px' }}>

      {/* B1: Watershed */}
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

      {/* B1: L1 drill-btn (watershed level only) */}
      {basinLevel === 'watershed' && drillBtn(t.basin.subbasinL1, t.basin.selectL1, onDrillL1)}

      {/* B2/B3/B4/B5: L1 dropdown */}
      {basinLevel !== 'watershed' && (
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
      )}

      {/* B3/B4: L2 dropdown */}
      {showL2Dropdown && (
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
      )}

      {/* All micro basin — always visible when enableL2 */}
      {enableL2 && (
        <div
          data-testid="drill-l2-btn"
          onClick={basinLevel === 'watershed' ? onDrillL2FromWatershed : onDrillL2}
          style={{
            padding: '5px 12px', fontSize: theme.fontSize.xs, fontWeight: 600,
            color: theme.color.primary, background: theme.color.primaryLight,
            borderRadius: theme.radius.md, marginTop: 6,
            cursor: 'pointer', userSelect: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>{t.basin.drillL2}</span><span>→</span>
        </div>
      )}

    </div>
  );
}
