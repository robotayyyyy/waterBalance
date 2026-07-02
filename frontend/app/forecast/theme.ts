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
  green500:  '#10b981',
  cyan400:   '#22d3ee',
  orange500: '#f97316',
  violet500: '#8b5cf6',
  red600:   '#dc2626',
  river:    '#1e8de3',
  navy:     '#1a2e4a',
  blue800:  '#1565c0',
  blue900:  '#0d47a1',
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
    0: p.white,       // wb_level = 0
    1: '#fdffab',     // > 0 – 10
    2: '#e7d463',     // > 10 – 20
    3: '#eaa93e',     // > 20 – 30
    4: '#ab6e37',     // > 30 – 40
    5: '#de3324',     // > 40 – 50
    6: '#79170e',     // > 50
  } as Record<number, string>,

  rainfall: {
    0: '#bad2fb',  // >0–10   a little
    1: '#bfeabc',  // >10–20  medium
    2: '#93c354',  // >20–35  medium
    3: '#e7d463',  // >35–50  heavy
    4: '#da944b',  // >50–70  heavy
    5: '#ab6e37',  // >70–90  heavy
    6: '#bf4438',  // >90     very heavy
  } as Record<number, string>,

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
    mapBg: p.slate200,

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
    primary:        p.blue500,
    primaryLight:   p.blue50,
    primaryMid:     p.blue300,
    primaryDark:    p.blue700,
    primaryDeeper:  p.blue800,   // proto buttons / footer gradient start
    primaryDeepest: p.blue900,   // proto footer gradient end

    // Secondary selection — tambon level
    secondary:      p.amber700,
    secondaryLight: p.amber50,

    // Brand heading color (darker navy than slate800)
    brandDark: p.navy,

    // No-data fill
    noData: dataColors.noData,
  },

  mapFillOpacity: 0.8,
  mapFillOpacityReduced: 0.3, // when hill/river overlay is active

  // Map boundary lines — edit color/width/opacity here for all levels
  mapLine: {
    l1:             { color: p.slate700, width: 1.0, opacity: 0.9, dash: [6, 3] } as LineStyle,  // province / watershed
    l2:             { color: p.slate600, width: 1.0, opacity: 0.8 }              as LineStyle,  // amphoe / subbasin-l1
    l3:             { color: p.slate500, width: 0.6, opacity: 0.8 }              as LineStyle,  // tambon / subbasin-l2
    highlightOuter: { color: p.white,    width: 3.5, opacity: 1.0 }              as LineStyle,  // selection outer ring
    highlightInner: { color: p.orange500, width: 1.5, opacity: 0.8 }             as LineStyle,  // selection inner ring (default; overridden per mode)

    overlayProvince:       { color: p.slate600, width: 1.8, opacity: 1.0, dash: [4, 3] } as LineStyle, // province overlay inner line
    overlayProvinceCasing: { color: p.white,    width: 3.8, opacity: 0.9 }              as LineStyle, // province overlay white casing
    overlayAmphoe:         { color: p.slate500, width: 0.8, opacity: 1.0, dash: [3, 3] } as LineStyle, // amphoe overlay inner line
    overlayAmphoeCasing:   { color: p.white,    width: 2.5, opacity: 0.85 }             as LineStyle, // amphoe overlay white casing
    river:           { color: p.river, opacity: 0.5, penWidthStops: [0, 0.4, 5, 2.8] }, // river overlay (width interpolated from PenWidth)
  },

  // Highlight inner color per data mode
  highlightColor: {
    runoff:       p.orange500,
    drought:      p.green500,
    waterbalance: p.cyan400,
    rainfall:     p.blue500,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
export type Mode = 'drought' | 'runoff' | 'waterbalance' | 'rainfall';

/** wb_level in DB is already a bucket index 0-6 */
export function wbLevelToBucket(v: number): number {
  return Math.min(6, Math.max(0, Math.round(v)));
}

/** Discretize raw rainfall mm into index 0–6 */
export function rainfallToIndex(mm: number | string): number {
  const v = Number(mm);
  if (isNaN(v) || v <= 0)  return 0;
  if (v <= 10)  return 0;
  if (v <= 20)  return 1;
  if (v <= 35)  return 2;
  if (v <= 50)  return 3;
  if (v <= 70)  return 4;
  if (v <= 90)  return 5;
  return 6;
}

export function valueToColor(value: number, mode: Mode): string {
  if (mode === 'drought')      return dataColors.drought[value]                       ?? dataColors.noData;
  if (mode === 'runoff')       return dataColors.runoff[value]                        ?? dataColors.noData;
  if (mode === 'waterbalance') return dataColors.waterBalance[wbLevelToBucket(value)] ?? dataColors.noData;
  if (mode === 'rainfall')     return dataColors.rainfall[value]                      ?? dataColors.noData;
  return dataColors.noData;
}

/** All numeric fields returned by the color endpoint. Frontend selects by mode. */
export type ColorRow = {
  id: string;
  drought_index: number;
  runoff_index: number;
  wb_level: number;
  rainfall: number;
  water_balance: number;
};

/** Extract the display value from a ColorRow for a given mode. */
export function modeValue(row: ColorRow, mode: Mode): number {
  if (mode === 'drought')  return row.drought_index;
  if (mode === 'runoff')   return row.runoff_index;
  if (mode === 'rainfall') return rainfallToIndex(row.rainfall);
  return Number(row.wb_level);
}
