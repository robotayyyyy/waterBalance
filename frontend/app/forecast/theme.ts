/**
 * theme.ts — single source of truth for all colors, sizes, and style tokens.
 * Import from here instead of writing raw hex values in components.
 *
 * Sections:
 *   dataColors  — data-visualization scales (drought / runoff / water-balance)
 *   theme       — semantic UI tokens (backgrounds, text, borders, primary, map lines, typography, spacing)
 *   valueToColor — helper that maps a data value → CSS color string
 */

type LineStyle = { color: string; width: number; opacity: number; dash?: number[] };

// ─── Raw palette (private) ────────────────────────────────────────────────────
const p = {
  white:    '#ffffff',
  slate50:  '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  gray50:   '#fafafa',
  gray700:  '#333333',
  blue50:   '#eff6ff',
  blue300:  '#93c5fd',
  blue500:  '#3b82f6',
  blue600:  '#2563eb',
  blue700:  '#1d4ed8',
  amber50:  '#fefce8',
  amber400: '#fbbf24',
  amber700: '#b45309',
  green500: '#10b981',
  violet500: '#8b5cf6',
  red600:   '#dc2626',
  river:   '#1e8de3',
};

// ─── Data visualization ───────────────────────────────────────────────────────
export const dataColors = {
  drought: {
    0: p.white,
    1: '#feff73',
    2: '#ffaa01',
    3: '#fe0000',
  } as Record<number, string>,

  runoff: {
    0: p.white,
    1: '#bee8ff',
    2: '#01c5ff',
    3: '#005be7',
  } as Record<number, string>,

  waterBalance: {
    positive: p.blue600,
    negative: p.red600,
  },

  noData: '#cccccc',
};

// ─── Semantic UI tokens ───────────────────────────────────────────────────────
export const theme = {
  color: {
    // Surfaces
    pageBg:    p.white,
    surfaceBg: p.slate50,   // section headers, nav buttons
    subtleBg:  p.slate100,  // row hover, sticky header
    toolbarBg: p.gray50,    // toolbar rows
    headerBg:  p.slate800,  // app top bar
    darkBtnBg: p.slate700,  // inactive header buttons (dark bar)

    // Text
    textPrimary: p.slate800,
    textBody:    p.slate600,
    textLabel:   p.slate500,
    textMuted:   p.slate400,
    textOnDark:  p.white,

    // Borders
    border:      p.slate200,
    borderInput: p.slate300,

    // Primary action (blue)
    primary:      p.blue500,
    primaryLight: p.blue50,
    primaryMid:   p.blue300,
    primaryDark:  p.blue700,

    // Secondary selection — tambon level
    secondary:      p.amber700,
    secondaryLight: p.amber50,

    // No-data fill
    noData: dataColors.noData,
  },

  mapFillOpacity: 0.3,

  // Map boundary lines — edit color/width/opacity here for all levels
  mapLine: {
    l1:             { color: p.slate700, width: 1.0, opacity: 0.9, dash: [6, 3] } as LineStyle,  // province / watershed
    l2:             { color: p.slate600, width: 1.0, opacity: 0.8 }              as LineStyle,  // amphoe / subbasin-l1
    l3:             { color: p.slate500, width: 0.6, opacity: 0.8 }              as LineStyle,  // tambon / subbasin-l2
    highlightOuter: { color: p.white,    width: 3.5, opacity: 1.0 }              as LineStyle,  // selection outer ring
    highlightInner: { color: p.green500, width: 1.5, opacity: 0.8 }              as LineStyle,  // selection inner ring (default; overridden per mode)

    overlayProvince: { color: p.slate400, width: 2.0, opacity: 1.0, dash: [2, 2] } as LineStyle, // province overlay toggle
    overlayAmphoe:   { color: p.slate400, width: 1.0, opacity: 1.0, dash: [2, 2] } as LineStyle, // amphoe overlay toggle
    river:           { color: p.river, opacity: 0.5, penWidthStops: [0, 0.4, 5, 2.8] }, // river overlay (width interpolated from PenWidth)
  },

  // Highlight inner color per data mode
  highlightColor: {
    runoff:       p.green500,
    drought:      p.violet500,
    waterbalance: p.amber400,
  } as Record<string, string>,

  fontSize: {
    xs:   11,  // labels, IDs, section headers
    sm:   12,  // body text, list items, buttons
    base: 13,  // default app text
    md:   14,  // icon buttons (legend close, nav arrows)
    lg:   15,  // app title
    icon: 18,  // deselect × button
    nav:  20,  // hamburger menu
  },

  radius: {
    sm: 2,   // color indicator dots
    md: 4,   // buttons, inputs
    lg: 6,   // panels, tooltips
  },

  button: {
    height:   34,
    paddingX: 12,
    paddingY: 6,
  },

  sidebar: {
    width:          220,
    collapsedWidth: 32,
  },

  table: {
    maxWidth:    720,
    toggleWidth: 27,
    dragWidth:   12,
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────
export type Mode = 'drought' | 'runoff' | 'waterbalance';

export function valueToColor(value: number, mode: Mode): string {
  if (mode === 'drought')      return dataColors.drought[value]      ?? dataColors.noData;
  if (mode === 'runoff')       return dataColors.runoff[value]        ?? dataColors.noData;
  if (mode === 'waterbalance') return value >= 0
    ? dataColors.waterBalance.positive
    : dataColors.waterBalance.negative;
  return dataColors.noData;
}
