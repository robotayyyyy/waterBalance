'use client';

import { useMemo, useState, useEffect } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme, dataColors, valueToColor } from '../theme';
import type { Mode } from '../theme';

export type Basin = 'ping' | 'yom';
export type BasinLevel = 'watershed' | 'subbasin-l1' | 'subbasin-l2';

const BASIN_META: Record<Basin, { label: string; labelTh: string; mbCode: string }> = {
  ping: { label: 'Ping', labelTh: 'ปิง', mbCode: '06' },
  yom:  { label: 'Yom',  labelTh: 'ยม',  mbCode: '08' },
};

type ColorRow = { id: string; value: number };
type DetailRow = { id: string; name?: string; mb_code?: string; [k: string]: any };

function SectionHeader({ label, count, selectedName, selectedId, onDeselect, isCollapsed, onToggle }: {
  label: string;
  count?: number | null;
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
            {selectedId && <span style={{ color: theme.color.primaryMid, fontWeight: 400, marginLeft: 3 }}>{selectedId}</span>}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDeselect(); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: theme.color.textMuted, fontSize: theme.fontSize.icon, lineHeight: 1, padding: '4px 6px', flexShrink: 0 }}
          >×</button>
        </div>
      ) : (
        <span style={{ fontWeight: 400, color: theme.color.textMuted }}>{count ?? ''}</span>
      )}
    </div>
  );
}

export default function BasinSidebar({
  basinLevel, selectedBasin, selectedL1, selectedL2, l2FilterSbCode,
  colorData, l1DetailData, detailData, l2PreviewData, mode,
  onSelectBasin, onSelectL1, onSelectL2, onSelectL2Preview,
  onDrillL1, onDrillL2, onBack, enableL2,
}: {
  basinLevel: BasinLevel;
  selectedBasin: Basin | null;
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
  onBack: () => void;
  enableL2: boolean;
}) {
  const { locale } = useLang();
  const basinName = (b: Basin) => locale === 'th' ? BASIN_META[b].labelTh : BASIN_META[b].label;

  const colorMap = useMemo(() => new Map(colorData.map(r => [r.id, r.value])), [colorData]);

  const [watershedCollapsed, setWatershedCollapsed] = useState(false);
  const [l1Collapsed, setL1Collapsed] = useState(false);
  const [l2Collapsed, setL2Collapsed] = useState(false);

  useEffect(() => {
    setWatershedCollapsed(basinLevel !== 'watershed');
  }, [basinLevel]);
  useEffect(() => {
    // Auto-expand watershed section when a basin is selected (in case user collapsed it)
    if (selectedBasin && basinLevel === 'watershed') setWatershedCollapsed(false);
  }, [selectedBasin, basinLevel]);
  useEffect(() => { setL1Collapsed(basinLevel !== 'subbasin-l1'); }, [basinLevel]);
  useEffect(() => { setL2Collapsed(basinLevel !== 'subbasin-l2'); }, [basinLevel]);

  const showL1 = basinLevel === 'subbasin-l1' || basinLevel === 'subbasin-l2';
  const showL2 = basinLevel === 'subbasin-l2';
  console.log('[BasinSidebar] render', { basinLevel, selectedL1, l2PreviewData: l2PreviewData.length });

  const listItemStyle = (isSelected: boolean) => ({
    padding: '8px 12px', borderBottom: `1px solid ${theme.color.subtleBg}`,
    cursor: 'pointer', fontSize: theme.fontSize.sm,
    background: isSelected ? theme.color.primaryLight : 'transparent',
    color: isSelected ? theme.color.primaryDark : theme.color.textBody,
    fontWeight: isSelected ? 600 : 400,
    display: 'flex', alignItems: 'center', gap: 8,
  } as React.CSSProperties);

  const colorDot = (value: number | undefined) => value !== undefined ? (
    <div style={{ width: 10, height: 10, borderRadius: theme.radius.sm, background: valueToColor(value, mode), border: `1px solid ${theme.color.border}`, flexShrink: 0 }} />
  ) : null;

  const drillFooter = (label: string, onClick: () => void) => (
    <div
      onClick={onClick}
      style={{
        padding: '5px 12px', fontSize: theme.fontSize.xs, fontWeight: 600,
        color: theme.color.primary, background: theme.color.primaryLight,
        borderTop: `1px solid ${theme.color.border}`, flexShrink: 0,
        cursor: 'pointer', userSelect: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <span>{label}</span>
      <span>→</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Watershed section */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        flex: watershedCollapsed ? 'none' : (basinLevel === 'watershed' ? 1 : 'none'),
        minHeight: 0, borderBottom: `1px solid ${theme.color.border}`,
      }}>
        <SectionHeader
          label="Watershed"
          count={!selectedBasin ? 2 : null}
          selectedName={selectedBasin ? basinName(selectedBasin) : undefined}
          selectedId={selectedBasin ? BASIN_META[selectedBasin].mbCode : undefined}
          onDeselect={selectedBasin ? onBack : undefined}
          isCollapsed={watershedCollapsed}
          onToggle={() => setWatershedCollapsed(c => !c)}
        />
        {!watershedCollapsed && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
              {(['ping', 'yom'] as Basin[]).map(b => {
                const meta = BASIN_META[b];
                const droughtVal = colorMap.get(meta.mbCode);
                return (
                  <li key={b} onClick={() => onSelectBasin(b)} style={listItemStyle(selectedBasin === b)}>
                    {colorDot(droughtVal)}
                    <span style={{ flex: 1 }}>{basinName(b)}</span>
                    <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>{meta.mbCode}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Sub-basin L1 section */}
      {showL1 && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          flex: l1Collapsed ? 'none' : (basinLevel === 'subbasin-l1' ? 1 : 'none'),
          minHeight: 0, borderBottom: `1px solid ${theme.color.border}`,
        }}>
          <SectionHeader
            label="Sub-basin L1"
            count={basinLevel === 'subbasin-l1' && !selectedL1 ? l1DetailData.length : null}
            selectedName={selectedL1 ? (l1DetailData.find(r => r.id === selectedL1)?.name || selectedL1) : undefined}
            selectedId={selectedL1 ?? undefined}
            onDeselect={onBack}
            isCollapsed={l1Collapsed}
            onToggle={() => setL1Collapsed(c => !c)}
          />
          {!l1Collapsed && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <ul style={{ flex: (basinLevel === 'subbasin-l1' && selectedL1 && l2PreviewData.length > 0) ? '0 1 50%' : 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
                {l1DetailData.map(row => {
                  const droughtVal = colorMap.get(row.id);
                  return (
                    <li key={row.id} onClick={() => onSelectL1(row.id)} style={listItemStyle(selectedL1 === row.id)}>
                      {colorDot(droughtVal)}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name || row.id}
                      </span>
                      <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>{row.id}</span>
                    </li>
                  );
                })}
              </ul>
              {enableL2 && basinLevel === 'subbasin-l1' && selectedL1 && l2PreviewData.length > 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderTop: `1px solid ${theme.color.border}` }}>
                  <div style={{ padding: '4px 12px', fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel, textTransform: 'uppercase', background: theme.color.subtleBg, flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sub-basins L2</span>
                    <span style={{ fontWeight: 400, color: theme.color.textMuted }}>{l2PreviewData.length}</span>
                  </div>
                  <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
                    {l2PreviewData.map(row => {
                      const val = row.value;
                      return (
                        <li key={row.id} onClick={() => onSelectL2Preview(row.id)} style={listItemStyle(false)}>
                          {colorDot(val)}
                          <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>#{row.id}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                enableL2 && basinLevel === 'subbasin-l1' && drillFooter('Sub-basins L2', onDrillL2)
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-basin L2 section */}
      {enableL2 && showL2 && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          flex: l2Collapsed ? 'none' : 1,
          minHeight: 0,
        }}>
          <SectionHeader
            label="Sub-basin L2"
            count={!selectedL2 ? detailData.length : null}
            selectedName={
              selectedL2
                ? `#${selectedL2}`
                : l2FilterSbCode
                  ? (l1DetailData.find(r => r.id === l2FilterSbCode)?.name || l2FilterSbCode)
                  : selectedBasin ? basinName(selectedBasin) : undefined
            }
            selectedId={selectedL2 ?? l2FilterSbCode ?? undefined}
            onDeselect={onBack}
            isCollapsed={l2Collapsed}
            onToggle={() => setL2Collapsed(c => !c)}
          />
          {!l2Collapsed && (
            <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0, minHeight: 0 }}>
              {detailData.map(row => {
                const droughtVal = colorMap.get(row.id);
                return (
                  <li key={row.id} onClick={() => onSelectL2(row.id)} style={listItemStyle(selectedL2 === row.id)}>
                    {colorDot(droughtVal)}
                    <span style={{ color: theme.color.textMuted, fontSize: theme.fontSize.xs }}>#{row.id}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

    </div>
  );
}
