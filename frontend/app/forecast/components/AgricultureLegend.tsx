'use client';

import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';
import { AGRI_CROPS, AGRI_CROPS_BY_BASIN } from '../agriculture';

// Crop legend for the agriculture overlay — shows the crops present in the current basin,
// coloured to match the map fills (agriculture.ts). Localized crop names (en/th).
export default function AgricultureLegend({ watershed }: { watershed: 'ping' | 'yom' }) {
  const { locale } = useLang();
  const crops = AGRI_CROPS_BY_BASIN[watershed].map(code => AGRI_CROPS[code]).filter(Boolean);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexShrink: 0,
      background: theme.color.pageBg, borderTop: `1px solid ${theme.color.border}`,
      flexWrap: 'wrap',
    }}>
      {crops.map(c => (
        <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', flexShrink: 0 }}>
          <span style={{
            width: 12, height: 12, borderRadius: theme.radius.sm, background: c.color,
            flexShrink: 0, border: `1px solid ${theme.color.border}`, display: 'inline-block',
          }} />
          <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textBody, whiteSpace: 'nowrap' }}>
            {locale === 'th' ? c.th : c.en}
          </span>
        </div>
      ))}
    </div>
  );
}
