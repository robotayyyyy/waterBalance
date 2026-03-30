'use client';

import { useMemo, useState } from 'react';

export type Basin = 'ping' | 'yom';
export type BasinLevel = 'watershed' | 'subbasin-l1' | 'subbasin-l2';

const DROUGHT_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#feff73', 2: '#ffaa01', 3: '#fe0000' };

const BASIN_META: Record<Basin, { label: string; labelTh: string; color: string }> = {
  ping: { label: 'Ping',  labelTh: 'ปิง',  color: '#3b82f6' },
  yom:  { label: 'Yom',   labelTh: 'ยม',   color: '#8b5cf6' },
};

type ColorRow = { id: string; value: number };
type DetailRow = { id: string; name?: string; mb_code?: string; drought_index?: number; [k: string]: any };

export default function BasinSidebar({
  basinLevel,
  selectedBasin,
  selectedL1,
  colorData,
  detailData,
  onSelectBasin,
  onSelectL1,
  onDrillL1,
  onDrillL2,
  onBack,
}: {
  basinLevel: BasinLevel;
  selectedBasin: Basin | null;
  selectedL1: string | null;
  colorData: ColorRow[];
  detailData: DetailRow[];
  onSelectBasin: (b: Basin) => void;
  onSelectL1: (sbCode: string) => void;
  onDrillL1: () => void;
  onDrillL2: () => void;
  onBack: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const colorMap = useMemo(() => new Map(colorData.map(r => [r.id, r.value])), [colorData]);

  const header = (
    <div style={{ padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {basinLevel !== 'watershed' && (
        <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16, padding: '0 4px' }}>←</button>
      )}
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {basinLevel === 'watershed' ? 'Watershed' : basinLevel === 'subbasin-l1' ? 'Sub-basin L1' : 'Sub-basin L2'}
      </span>
      {selectedBasin && basinLevel !== 'watershed' && (
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: BASIN_META[selectedBasin].color }}>
          {BASIN_META[selectedBasin].label}
        </span>
      )}
      <button onClick={() => setCollapsed(c => !c)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11 }}>
        {collapsed ? '▶' : '▼'}
      </button>
    </div>
  );

  if (collapsed) return <div style={{ flex: 1, overflow: 'hidden' }}>{header}</div>;

  // Watershed level: show both basins as selectable cards
  if (basinLevel === 'watershed') {
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(['ping', 'yom'] as Basin[]).map(b => {
            const meta = BASIN_META[b];
            const droughtVal = colorMap.get(b === 'ping' ? '06' : '08');
            const isSelected = selectedBasin === b;
            return (
              <div
                key={b}
                onClick={() => onSelectBasin(b)}
                style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${isSelected ? meta.color : '#e2e8f0'}`,
                  background: isSelected ? `${meta.color}15` : '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{meta.labelTh}</div>
                </div>
                {droughtVal !== undefined && (
                  <div style={{ width: 18, height: 18, borderRadius: 3, background: DROUGHT_COLORS[droughtVal] ?? '#ccc', border: '1px solid #e2e8f0', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
          {selectedBasin && (
            <button
              onClick={onDrillL1}
              style={{ marginTop: 4, padding: '7px', border: 'none', borderRadius: 6, background: BASIN_META[selectedBasin].color, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              View Sub-basins L1 →
            </button>
          )}
        </div>
      </div>
    );
  }

  // Sub-basin L1: list of SB_CODE zones
  if (basinLevel === 'subbasin-l1') {
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {detailData.map(row => {
            const droughtVal = colorMap.get(row.id);
            const isSelected = selectedL1 === row.id;
            return (
              <div
                key={row.id}
                onClick={() => onSelectL1(row.id)}
                style={{
                  padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                  background: isSelected ? '#eff6ff' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {droughtVal !== undefined && (
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: DROUGHT_COLORS[droughtVal] ?? '#ccc', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#1e293b', fontWeight: isSelected ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.name || row.id}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{row.id}</div>
                </div>
              </div>
            );
          })}
          <div style={{ padding: 8, flexShrink: 0 }}>
            <button
              onClick={onDrillL2}
              style={{ width: '100%', padding: '7px', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              View Sub-basins L2 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sub-basin L2: list of Sbswat numbers
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {header}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {detailData.map(row => {
          const droughtVal = colorMap.get(row.id);
          return (
            <div
              key={row.id}
              style={{ padding: '5px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {droughtVal !== undefined && (
                <div style={{ width: 10, height: 10, borderRadius: 2, background: DROUGHT_COLORS[droughtVal] ?? '#ccc', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 12, color: '#475569' }}>Sub-basin #{row.id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
