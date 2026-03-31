/**
 * theme.ts — single source of truth for all colors, sizes, and style tokens.
 * Import from here instead of writing raw hex values in components.
 *
 * Sections:
 *   dataColors  — data-visualization scales (drought / runoff / water-balance)
 *   theme       — semantic UI tokens (backgrounds, text, borders, primary, map lines, typography, spacing)
 *   valueToColor — helper that maps a data value → CSS color string
 */

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
  amber700: '#b45309',
  green500: '#10b981',
  red600:   '#dc2626',
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

    // Map highlight border (green double-border on selected region)
    mapHighlight:      p.green500,
    mapHighlightOuter: p.white,

    // Map boundary lines
    mapAdm1Line:  p.slate800,
    mapAdm2Line:  p.slate600,
    mapAdm3Line:  p.gray700,
    mapBasinLine: p.blue700,

    // No-data fill
    noData: dataColors.noData,
  },

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
    dragWidth:   5,
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
