// PNG export of the map + header + scale bar + legend, composited on a 2D canvas.
//
// Capture strategy: the "render hook" — we do NOT use `preserveDrawingBuffer` (which would slow the
// live map forever). Instead we arm a one-shot `map.once('render', …)`, force a single frame with
// `triggerRepaint()`, and read the pixels inside that callback (before WebGL wipes the buffer).
//
// ── TEMPLATE ─────────────────────────────────────────────────────────────────────────────────────
// `drawTemplate()` below is the ONLY function to edit when the client wants a different layout
// (borders, margins, header position, scale placement, legend columns…). Everything else — capture,
// scale math, legend data — is plumbing and should not need to change.

import type { Map as MlMap } from 'maplibre-gl';
import { theme, dataColors, type Mode } from '../theme';
import type { Model } from '../hooks/useMapInit';
import type { Translations, Locale } from '../../i18n/translations';
import { AGRI_CROPS, AGRI_CROPS_BY_BASIN } from '../agriculture';
import { formatTableDate } from './dateUtils';

type LegendItem = { color: string; label: string };
type Scale = { barPx: number; label: string };   // barPx is in DEVICE pixels

export type ExportMapOptions = {
  map: MlMap;
  mode: Mode;
  model: Model;
  subMode: 'aggregate' | 'daily';
  watershed: 'ping' | 'yom';
  date: string;
  locale: Locale;
  t: Translations;
  enabledCrops?: Set<string>;
  filename?: string;
};

// ── Public entry point ────────────────────────────────────────────────────────────────────────────
export async function exportMapPng(opts: ExportMapOptions): Promise<void> {
  const { map, mode, model, subMode, watershed, date, locale, t, enabledCrops, filename } = opts;

  const mapImg = await captureMap(map);                  // render-hook grab of the live canvas
  const canvasEl = map.getCanvas();
  const k = (canvasEl.width / canvasEl.clientWidth) || 1; // device-pixel ratio (px scale factor)

  const header = {
    title: t.exportMap.title,
    subtitle: `${t.watershed[watershed]} · ${t.mode[mode]} · ${formatTableDate(date, model, subMode, locale)}`,
  };
  const legend = legendItemsFor(mode, t);
  const crops = enabledCrops && enabledCrops.size > 0 ? cropLegendItems(watershed, enabledCrops, locale) : [];
  const scale = computeScale(map, k);

  const out = document.createElement('canvas');
  drawTemplate(out, { mapImg, k, header, legend, crops, scale, attribution: 'Protomaps © OpenStreetMap' });

  const a = document.createElement('a');
  a.href = out.toDataURL('image/png');
  a.download = filename ?? `water-map-${watershed}-${date || 'export'}-${mode}-${locale}.png`;
  a.click();
}

// ── Capture: grab the live map canvas on the next frame, then wrap it in an <img> ──────────────────
function captureMap(map: MlMap): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    map.once('render', () => {
      try {
        const url = map.getCanvas().toDataURL('image/png');
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('map image failed to load'));
        img.src = url;
      } catch (err) {
        // Most likely a tainted-canvas SecurityError (a cross-origin tile/glyph without CORS).
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    map.triggerRepaint();
  });
}

// ── Scale: mirror MapLibre's ScaleControl — meters per N screen-pixels → nearest "nice" number ─────
function computeScale(map: MlMap, k: number): Scale {
  const maxWidthCss = 110;                                  // target max bar length in CSS px
  const y = map.getCanvas().clientHeight / 2;
  const left = map.unproject([0, y]);
  const right = map.unproject([maxWidthCss, y]);
  const maxMeters = left.distanceTo(right);                 // real-world meters over maxWidthCss px
  const nice = getRoundNum(maxMeters);
  const barCssPx = maxWidthCss * (nice / maxMeters);
  return {
    barPx: barCssPx * k,                                     // to device px so it matches the bitmap
    label: nice >= 1000 ? `${nice / 1000} km` : `${nice} m`,
  };
}

function getRoundNum(num: number): number {
  const pow10 = Math.pow(10, `${Math.floor(num)}`.length - 1);
  let d = num / pow10;
  d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
  return pow10 * d;
}

// ── Legend data (mirrors Legend.tsx / AgricultureLegend.tsx) ───────────────────────────────────────
function legendItemsFor(mode: Mode, t: Translations): LegendItem[] {
  const items: LegendItem[] =
    mode === 'drought' ? [
      { color: dataColors.drought[0], label: t.legend.normal },
      { color: dataColors.drought[1], label: t.legend.watch },
      { color: dataColors.drought[2], label: t.legend.warning },
      { color: dataColors.drought[3], label: t.legend.critical },
    ] : mode === 'runoff' ? [
      { color: dataColors.runoff[0], label: t.legend.normal },
      { color: dataColors.runoff[1], label: t.legend.low },
      { color: dataColors.runoff[2], label: t.legend.high },
      { color: dataColors.runoff[3], label: t.legend.extreme },
    ] : mode === 'rainfall' ? [
      { color: dataColors.rainfall[0], label: t.rainfall.r0 },
      { color: dataColors.rainfall[1], label: t.rainfall.r1 },
      { color: dataColors.rainfall[2], label: t.rainfall.r2 },
      { color: dataColors.rainfall[3], label: t.rainfall.r3 },
      { color: dataColors.rainfall[4], label: t.rainfall.r4 },
      { color: dataColors.rainfall[5], label: t.rainfall.r5 },
      { color: dataColors.rainfall[6], label: t.rainfall.r6 },
    ] : [
      { color: dataColors.waterBalance[0], label: t.legend.wb0 },
      { color: dataColors.waterBalance[1], label: t.legend.wb1 },
      { color: dataColors.waterBalance[2], label: t.legend.wb2 },
      { color: dataColors.waterBalance[3], label: t.legend.wb3 },
      { color: dataColors.waterBalance[4], label: t.legend.wb4 },
      { color: dataColors.waterBalance[5], label: t.legend.wb5 },
      { color: dataColors.waterBalance[6], label: t.legend.wb6 },
    ];
  return [...items, { color: dataColors.noData, label: t.legend.nodata }];
}

function cropLegendItems(watershed: 'ping' | 'yom', enabled: Set<string>, locale: Locale): LegendItem[] {
  return AGRI_CROPS_BY_BASIN[watershed]
    .filter(code => enabled.has(code))
    .map(code => AGRI_CROPS[code])
    .filter(Boolean)
    .map(c => ({ color: c.color, label: locale === 'th' ? c.th : c.en }));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
//  TEMPLATE — edit this to restyle the exported image. All sizes are multiplied by `k` (device-pixel
//  ratio) so the output stays crisp on hi-DPI screens and the scale bar keeps its real-world length.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
type TemplateInput = {
  mapImg: HTMLImageElement;
  k: number;
  header: { title: string; subtitle: string };
  legend: LegendItem[];
  crops: LegendItem[];
  scale: Scale;
  attribution: string;
};

function drawTemplate(canvas: HTMLCanvasElement, input: TemplateInput): void {
  const { mapImg, k, header, legend, crops, scale, attribution } = input;
  const pad = 18 * k;
  const mapW = mapImg.width;
  const mapH = mapImg.height;
  const W = mapW + pad * 2;

  const ctx = canvas.getContext('2d')!;
  canvas.width = W; // sets width (also clears); height set once we know the legend size

  // Header geometry
  const titleSize = 20 * k;
  const subSize = 13 * k;
  const headerH = pad + titleSize + 10 * k + subSize + pad * 0.6;

  // Legend below the map — measure first (draw=false) so we can size the canvas.
  const groups = crops.length ? [legend, crops] : [legend];
  const legendTop = headerH + mapH + 12 * k;
  const legendH = renderLegend(ctx, groups, pad, legendTop, mapW, k, false);

  const H = legendTop + legendH + pad * 0.6;
  canvas.height = H; // clears; width preserved

  // Background
  ctx.fillStyle = theme.color.pageBg;
  ctx.fillRect(0, 0, W, H);

  // Header text
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = theme.color.textPrimary;
  ctx.font = `bold ${titleSize}px sans-serif`;
  ctx.fillText(header.title, pad, pad + titleSize);
  ctx.fillStyle = theme.color.textBody;
  ctx.font = `${subSize}px sans-serif`;
  ctx.fillText(header.subtitle, pad, pad + titleSize + 10 * k + subSize);

  // Map image + border frame
  const mapX = pad;
  const mapY = headerH;
  ctx.drawImage(mapImg, mapX, mapY, mapW, mapH);
  ctx.strokeStyle = theme.color.border;
  ctx.lineWidth = 1 * k;
  ctx.strokeRect(mapX + 0.5 * k, mapY + 0.5 * k, mapW - 1 * k, mapH - 1 * k);

  // Scale bar (bottom-left, over the map) and attribution (bottom-right, over the map)
  drawScaleBar(ctx, mapX + 14 * k, mapY + mapH - 12 * k, scale, k);
  drawAttribution(ctx, mapX + mapW - 8 * k, mapY + mapH - 8 * k, attribution, k);

  // Legend
  renderLegend(ctx, groups, pad, legendTop, mapW, k, true);
}

// Lay out legend swatches left-to-right, wrapping within `maxW`; each group starts a new row.
// Returns the total height. Set draw=false to measure only.
function renderLegend(
  ctx: CanvasRenderingContext2D,
  groups: LegendItem[][],
  x0: number, yTop: number, maxW: number, k: number, draw: boolean,
): number {
  const sw = 13 * k;        // swatch size
  const gap = 6 * k;        // swatch → label gap
  const rightPad = 18 * k;  // gap between items
  const rowH = 24 * k;
  ctx.font = `${12 * k}px sans-serif`;
  ctx.textBaseline = 'middle';

  let row = 0;
  for (const group of groups) {
    if (!group.length) continue;
    let x = x0;
    let firstInRow = true;
    for (const item of group) {
      const w = sw + gap + ctx.measureText(item.label).width + rightPad;
      if (!firstInRow && x + w > x0 + maxW) { row++; x = x0; }
      if (draw) {
        const cy = yTop + row * rowH + rowH / 2;
        roundRect(ctx, x, cy - sw / 2, sw, sw, 2 * k);
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.strokeStyle = theme.color.border;
        ctx.lineWidth = 1 * k;
        ctx.stroke();
        ctx.fillStyle = theme.color.textBody;
        ctx.fillText(item.label, x + sw + gap, cy);
      }
      x += w;
      firstInRow = false;
    }
    row++; // next group on its own row
  }
  return row * rowH;
}

function drawScaleBar(ctx: CanvasRenderingContext2D, x: number, yBottom: number, scale: Scale, k: number): void {
  ctx.font = `${11 * k}px sans-serif`;
  const tw = ctx.measureText(scale.label).width;
  const boxW = Math.max(scale.barPx, tw) + 16 * k;
  const boxH = 30 * k;
  const boxX = x - 8 * k;
  const boxY = yBottom - boxH;

  roundRect(ctx, boxX, boxY, boxW, boxH, 4 * k);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.fillText(scale.label, x, boxY + 5 * k);

  const barY = boxY + boxH - 11 * k;
  const barH = 5 * k;
  ctx.fillRect(x, barY, scale.barPx, barH);                      // bar
  ctx.fillRect(x, barY - 3 * k, 1.5 * k, barH + 3 * k);          // left tick
  ctx.fillRect(x + scale.barPx - 1.5 * k, barY - 3 * k, 1.5 * k, barH + 3 * k); // right tick
}

function drawAttribution(ctx: CanvasRenderingContext2D, rightX: number, bottomY: number, text: string, k: number): void {
  ctx.font = `${10 * k}px sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = 6 * k;
  const h = 16 * k;
  const boxW = tw + padX * 2;
  const x = rightX - boxW;
  const y = bottomY - h;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(x, y, boxW, h);
  ctx.fillStyle = theme.color.textMuted;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
