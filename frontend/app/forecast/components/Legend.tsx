'use client';

import { useState, useEffect } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme, dataColors } from '../theme';

type Mode = 'drought' | 'runoff' | 'waterbalance';

export default function Legend({ mode }: { mode: Mode }) {
  const { t } = useLang();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 768) setOpen(false);
  }, []);

  const DROUGHT_SCALE = [
    { value: 0, label: t.legend.normal,   color: dataColors.drought[0] },
    { value: 1, label: t.legend.watch,    color: dataColors.drought[1] },
    { value: 2, label: t.legend.warning,  color: dataColors.drought[2] },
    { value: 3, label: t.legend.critical, color: dataColors.drought[3] },
  ];

  const RUNOFF_SCALE = [
    { value: 0, label: t.legend.normal,  color: dataColors.runoff[0] },
    { value: 1, label: t.legend.low,     color: dataColors.runoff[1] },
    { value: 2, label: t.legend.high,    color: dataColors.runoff[2] },
    { value: 3, label: t.legend.extreme, color: dataColors.runoff[3] },
  ];

  const WATERBALANCE_SCALE = [
    { label: t.legend.surplus, color: dataColors.waterBalance.positive },
    { label: t.legend.deficit, color: dataColors.waterBalance.negative },
  ];

  const MODE_TITLES: Record<Mode, string> = {
    drought:      t.legend.drought,
    runoff:       t.legend.runoff,
    waterbalance: t.legend.waterbalance,
  };

  const items = mode === 'drought' ? DROUGHT_SCALE : mode === 'runoff' ? RUNOFF_SCALE : WATERBALANCE_SCALE;
  const allDots = [...items, { color: dataColors.noData }];

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      background: theme.color.pageBg, borderRadius: theme.radius.lg,
      boxShadow: '0 1px 4px rgba(0,0,0,.15)', zIndex: 10,
      overflow: 'hidden',
    }}>
      {/* Collapsed: dot strip */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 8px', border: 'none', background: 'transparent',
            cursor: 'pointer',
          }}
          title="Show legend"
        >
          {allDots.map((item, i) => (
            <span key={i} style={{ width: 10, height: 10, borderRadius: theme.radius.sm, background: item.color, flexShrink: 0, border: `1px solid ${theme.color.border}`, display: 'inline-block' }} />
          ))}
        </button>
      )}

      {/* Expanded: full legend */}
      {open && (
        <div style={{ padding: '10px 14px', minWidth: 150 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: theme.fontSize.xs, fontWeight: 600, color: theme.color.textLabel, textTransform: 'uppercase' }}>
              {MODE_TITLES[mode]}
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: theme.color.textMuted, fontSize: theme.fontSize.md, lineHeight: 1, padding: '0 0 0 8px' }}
              title="Minimize legend"
            >−</button>
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 14, height: 14, borderRadius: theme.radius.sm, background: item.color, flexShrink: 0, border: `1px solid ${theme.color.border}` }} />
              <span style={{ fontSize: theme.fontSize.sm, color: theme.color.textBody }}>
                {'value' in item ? `${item.value} · ` : ''}{item.label}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <div style={{ width: 14, height: 14, borderRadius: theme.radius.sm, background: dataColors.noData, flexShrink: 0, border: `1px solid ${theme.color.border}` }} />
            <span style={{ fontSize: theme.fontSize.sm, color: theme.color.textBody }}>{t.legend.nodata}</span>
          </div>
        </div>
      )}
    </div>
  );
}
