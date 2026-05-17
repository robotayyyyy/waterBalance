'use client';

import { useLang } from '../../i18n/LangContext';
import { theme, dataColors } from '../theme';

type Mode = 'drought' | 'runoff' | 'waterbalance';

export default function Legend({ mode }: { mode: Mode }) {
  const { t } = useLang();

  const DROUGHT_ITEMS = [
    { label: t.legend.normal,   color: dataColors.drought[0] },
    { label: t.legend.watch,    color: dataColors.drought[1] },
    { label: t.legend.warning,  color: dataColors.drought[2] },
    { label: t.legend.critical, color: dataColors.drought[3] },
  ];

  const RUNOFF_ITEMS = [
    { label: t.legend.normal,  color: dataColors.runoff[0] },
    { label: t.legend.low,     color: dataColors.runoff[1] },
    { label: t.legend.high,    color: dataColors.runoff[2] },
    { label: t.legend.extreme, color: dataColors.runoff[3] },
  ];

  const WATERBALANCE_ITEMS = [
    { label: t.legend.wb0, color: dataColors.waterBalance[0] },
    { label: t.legend.wb1, color: dataColors.waterBalance[1] },
    { label: t.legend.wb2, color: dataColors.waterBalance[2] },
    { label: t.legend.wb3, color: dataColors.waterBalance[3] },
    { label: t.legend.wb4, color: dataColors.waterBalance[4] },
    { label: t.legend.wb5, color: dataColors.waterBalance[5] },
    { label: t.legend.wb6, color: dataColors.waterBalance[6] },
  ];

  const items = mode === 'drought' ? DROUGHT_ITEMS : mode === 'runoff' ? RUNOFF_ITEMS : WATERBALANCE_ITEMS;
  const allItems = [...items, { label: t.legend.nodata, color: dataColors.noData }];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      background: theme.color.pageBg,
      borderTop: `1px solid ${theme.color.border}`,
      overflow: 'hidden',
    }}>
      {allItems.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRight: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{
            width: 12,
            height: 12,
            borderRadius: theme.radius.sm,
            background: item.color,
            flexShrink: 0,
            border: `1px solid ${theme.color.border}`,
            display: 'inline-block',
          }} />
          <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textBody, whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
