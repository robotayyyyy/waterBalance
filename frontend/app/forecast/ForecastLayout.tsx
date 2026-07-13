'use client';

import { useEffect, useRef, useState, useCallback, useReducer, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './forecast.css';

import BasinSidebar from './components/BasinSidebar';
import ProvinceSelector from './components/ProvinceSelector';
import OverlayToggle from './components/OverlayToggle';
import TablePanel from './components/TablePanel';
import SideTable from './components/SideTable';
import Legend from './components/Legend';
import AgricultureLegend from './components/AgricultureLegend';
import { AGRI_CROPS_BY_BASIN } from './agriculture';
import { useLang } from '../i18n/LangContext';
import { useMapInit, INIT_VIEW } from './hooks/useMapInit';
import { theme, valueToColor, wbLevelToBucket, rainfallToIndex, modeValue } from './theme';
import type { ColorRow } from './theme';
import type { Model, Mode, Level, BasinLevel } from './hooks/useMapInit';
import { useSelectionHandlers } from './hooks/useSelectionHandlers';
import { basinReducer, initialBasinState } from './basin/basinState';
import { adminReducer, initialAdminState } from './admin/adminState';
import { ENABLE_RAINFALL_GUARD } from './config';
import { selectDefaultDate } from './utils/dateUtils';
import { exportMapPng } from './utils/exportMapImage';
import type { Translations } from '../i18n/translations';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const P = {
  sidebarBg:     theme.color.pageBg,
  sidebarBorder: theme.color.border,
  sectionBg:     theme.color.subtleBg,
  topBarBg:      theme.color.pageBg,
  topBarBorder:  theme.color.border,
  btnBlue:       theme.color.primaryDeeper,
  footerFrom:    theme.color.primaryDeeper,
  footerTo:      theme.color.primaryDeepest,
};

// ─── Reusable blue dropdown ───────────────────────────────────────────────────
function ProtoDropdown({ label, options, onSelect, align = 'left', fullWidth = false, testId }: {
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onSelect: (v: string) => void;
  align?: 'left' | 'right';
  fullWidth?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', width: fullWidth ? '100%' : undefined }}>
      <button
        data-testid={testId}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 6, padding: '6px 10px', background: P.btnBlue, color: theme.color.textOnDark,
          border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
          width: fullWidth ? '100%' : undefined, whiteSpace: 'nowrap',
        }}
      >
        <span>{label}</span><span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%',
          [align === 'right' ? 'right' : 'left']: 0,
          zIndex: 300,
          background: theme.color.pageBg,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.md,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: 240, overflowY: 'auto', minWidth: 160,
        }}>
          {options.map(o => (
            <button
              key={o.value}
              data-testid={testId ? `${testId}-option-${o.value}` : undefined}
              disabled={o.disabled}
              onClick={() => { if (!o.disabled) { onSelect(o.value); setOpen(false); } }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 14px', border: 'none', background: 'transparent',
                fontSize: theme.fontSize.sm,
                color: o.disabled ? theme.color.textMuted : theme.color.textBody,
                whiteSpace: 'nowrap',
                cursor: o.disabled ? 'not-allowed' : 'pointer',
                opacity: o.disabled ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (!o.disabled) e.currentTarget.style.background = theme.color.primaryLight; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Icon button for sidebar exports ─────────────────────────────────────────
function IconBtn({ title, icon, onClick, href, testId }: {
  title: string; icon: string;
  onClick?: () => void; href?: string; testId?: string;
}) {
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: theme.radius.md, cursor: 'pointer',
    background: theme.color.surfaceBg, border: `1px solid ${theme.color.border}`,
    textDecoration: 'none', flexShrink: 0, padding: 4,
  };
  const img = <img src={icon} alt={title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;  // eslint-disable-line @next/next/no-img-element
  if (href) return <a href={href} download title={title} style={style} data-testid={testId}>{img}</a>;
  return <button title={title} onClick={onClick} style={{ ...style, font: 'inherit' }} data-testid={testId}>{img}</button>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function tooltipLabel(value: number, mode: Mode, t: Translations): string {
  if (mode === 'drought') {
    const m: Record<number, string> = { 0: t.legend.normal, 1: t.legend.watch, 2: t.legend.warning, 3: t.legend.critical };
    return `${value} · ${m[value] ?? String(value)}`;
  }
  if (mode === 'runoff') {
    const m: Record<number, string> = { 0: t.legend.normal, 1: t.legend.low, 2: t.legend.high, 3: t.legend.extreme };
    return `${value} · ${m[value] ?? String(value)}`;
  }
  if (mode === 'rainfall') {
    const m: Record<number, string> = { 0: t.rainfall.r0, 1: t.rainfall.r1, 2: t.rainfall.r2, 3: t.rainfall.r3, 4: t.rainfall.r4, 5: t.rainfall.r5, 6: t.rainfall.r6 };
    return `${value} · ${m[value] ?? String(value)}`;
  }
  const labels: Record<number, string> = {
    0: t.legend.wb0, 1: t.legend.wb1, 2: t.legend.wb2, 3: t.legend.wb3,
    4: t.legend.wb4, 5: t.legend.wb5, 6: t.legend.wb6,
  };
  return `${Number(value).toFixed(1)} · ${labels[wbLevelToBucket(value)]}`;
}

function swatZipUrl(watershed: 'ping' | 'yom', viewMode: 'admin' | 'basin', adminLevel: string, basinLevel: string) {
  if (viewMode === 'admin') {
    if (adminLevel === 'tambon') return `/downloads/tambon-${watershed}.zip`;
    if (adminLevel === 'amphoe') return `/downloads/amphoe-${watershed}.zip`;
    return `/downloads/province-${watershed}.zip`;
  }
  if (basinLevel === 'subbasin-l2') return `/downloads/microbasin-${watershed}.zip`;
  if (basinLevel === 'subbasin-l1') return `/downloads/subbasin-${watershed}.zip`;
  return `/downloads/watershed-${watershed}.zip`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ForecastLayout({ watershed }: { watershed: 'ping' | 'yom' }) {
  const { locale, t, setLocale } = useLang();
  const router = useRouter();
  const mbCode = watershed === 'ping' ? '06' : '08';

  const fmtMonth = (d: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(d + 'T00:00:00'));
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T00:00:00'));
  const fmtDate = (d: string) => d ? (subMode === 'daily' ? fmtDay(d) : model === '6months' ? fmtMonth(d) : fmtDay(d)) : '—';

  const [model, setModel]                       = useState<Model>('6months');
  const [subMode, setSubMode]                   = useState<'aggregate' | 'daily'>('aggregate');
  const [mode,  setMode]                        = useState<Mode>('runoff');
  const [adminState, adminDispatch] = useReducer(adminReducer, initialAdminState);
  const { activeLevel, selectedProvince, selectedAmphoe, selectedTambon } = adminState;
  const [availableDates,   setAvailableDates]   = useState<string[]>([]);
  const [selectedDate,     setSelectedDate]     = useState('');
  const [colorData,         setColorData]         = useState<ColorRow[]>([]);
  const [provinceColorData, setProvinceColorData] = useState<ColorRow[]>([]);
  const [amphoeColorData,   setAmphoeColorData]   = useState<ColorRow[]>([]);
  const [tambonColorData,   setTambonColorData]   = useState<ColorRow[]>([]);
  const [detailData,       setDetailData]       = useState<any[]>([]);
  const [amphoeList,       setAmphoeList]       = useState<any[]>([]);
  const [tambonList,       setTambonList]       = useState<any[]>([]);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode,         setViewMode]         = useState<'admin' | 'basin'>('basin');
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; name: string; name_th: string; value: number | null;
  } | null>(null);

  const [basinState, dispatch]      = useReducer(basinReducer, initialBasinState);
  const { basinLevel, selectedL1, selectedL2, l2FilterSbCode } = basinState;

  const [basinColorData,     setBasinColorData]     = useState<ColorRow[]>([]);
  const [basinDetailData,    setBasinDetailData]    = useState<any[]>([]);
  const [basinL1DetailData,  setBasinL1DetailData]  = useState<any[]>([]);

  const [overlayProvince,    setOverlayProvince]    = useState(true);
  const [overlayAmphoe,      setOverlayAmphoe]      = useState(false);
  const [overlayRivers,      setOverlayRivers]      = useState(false);
  const [overlayHillshade,   setOverlayHillshade]   = useState(false);
  const [overlayBasemap,     setOverlayBasemap]     = useState(true);
  const [overlayReservoirS,  setOverlayReservoirS]  = useState(false);
  const [overlayReservoirM,  setOverlayReservoirM]  = useState(false);
  const [overlayReservoirL,  setOverlayReservoirL]  = useState(false);
  // Layers drawer open/closed. The panel is a flex sibling of the map (Option C) — it pushes the map
  // narrower rather than floating over it, so its scroll never triggers the WebGL black-box artifact.
  const [layersOpen,         setLayersOpen]         = useState(false);
  // Agriculture overlay = set of enabled crop LU_CODEs (empty = off). Master toggle = all/none.
  const [enabledCrops,       setEnabledCrops]       = useState<Set<string>>(new Set());
  const agricultureOn = enabledCrops.size > 0;
  const toggleAgriculture = () => setEnabledCrops(prev => prev.size > 0 ? new Set() : new Set(AGRI_CROPS_BY_BASIN[watershed]));
  const toggleCrop = (code: string) => setEnabledCrops(prev => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });

  const initialized      = useRef(false);
  const basinProvinceIds = useRef<Set<string>>(new Set());
  const l2SbLookup       = useRef<Record<string, Record<string, string>>>({});
  const l1BboxRef        = useRef<Record<string, Record<string, [number, number, number, number]>>>({});

  useEffect(() => {
    Promise.all([
      fetch('/ping-l2-sb-lookup.json').then(r => r.json()),
      fetch('/yom-l2-sb-lookup.json').then(r => r.json()),
      fetch('/ping-l1-bbox.json').then(r => r.json()),
      fetch('/yom-l1-bbox.json').then(r => r.json()),
    ]).then(([pl, yl, pb, yb]) => {
      l2SbLookup.current = { ping: pl, yom: yl };
      l1BboxRef.current  = { ping: pb, yom: yb };
    });
  }, []);

  const {
    mapRef, mapContainer, bboxRef, amphoeBboxRef, geoRef, mapReady, provinces,
    applyColors, applyBasinColors,
    setAdminLayersVisible, setBasinLayersVisible,
    setL1Highlight, setL2Highlight, setL2SbFilter, setWatershedHighlight,
    setHighlightColor, setOverlayVisible, setDataFillOpacity, getFillOpacity, setAgricultureCropFilter,
  } = useMapInit({ selectedProvince, selectedAmphoe, activeLevel, watershed });

  // When the Layers drawer opens/closes the map's flex track changes width — tell MapLibre to resize
  // its canvas to the new box (rAF so the layout has committed first).
  useEffect(() => {
    const id = requestAnimationFrame(() => mapRef.current?.resize());
    return () => cancelAnimationFrame(id);
  }, [layersOpen, mapRef]);

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (date: string, lvl: Level, md: Mode, provId: string, mdl: Model, sub: 'aggregate' | 'daily' = 'aggregate') => {
    if (!date) return;
    if (lvl === 'amphoe') setAmphoeColorData([]);
    const params = new URLSearchParams({ date, model: mdl, mb_code: mbCode });
    if (provId && lvl !== 'province') params.set('province_id', provId);
    if (sub === 'daily') params.set('sub', 'daily');
    const detailParams = new URLSearchParams({ date, model: mdl, mb_code: mbCode });
    if (provId && lvl !== 'province') detailParams.set('province_id', provId);
    if (sub === 'daily') detailParams.set('sub', 'daily');
    const [color, detail] = await Promise.all([
      fetch(`${API}/forecast/${lvl}?${params}`).then(r => r.json()).catch(() => []),
      fetch(`${API}/forecast/${lvl}/detail?${detailParams}`).then(r => r.json()).catch(() => []),
    ]);
    const colorArr = Array.isArray(color) ? color : [];
    if (lvl === 'province' && colorArr.length > 0)
      basinProvinceIds.current = new Set(colorArr.map((r: { id: string }) => r.id));
    setColorData(colorArr);
    if (lvl === 'province') { setProvinceColorData(colorArr); console.log('[WF] fetchData province → provinceColorData set', colorArr.length, 'items'); }
    if (lvl === 'amphoe')   { setAmphoeColorData(colorArr);   console.log('[WF] fetchData amphoe   → amphoeColorData set',   colorArr.length, 'items'); }
    if (lvl === 'tambon')   { setTambonColorData(colorArr); console.log('[WF] fetchData tambon   → tambonColorData set', colorArr.length, 'items'); }
    const detailArr = Array.isArray(detail) ? detail : [];
    if (geoRef.current) {
      // The detail API returns only one language in `name`. Take BOTH names from the static geo
      // (authoritative EN + TH) so the CSV "… EN" / "… TH" columns are each correct; fall back to the
      // API name only for ids the geo doesn't have.
      const geoList = lvl === 'province' ? geoRef.current.provinces : lvl === 'amphoe' ? geoRef.current.amphoes : geoRef.current.tambons;
      const geoMap = new Map(geoList.map(g => [g.id, g] as const));
      detailArr.forEach(r => {
        const g = geoMap.get(r.id);
        r.name    = g?.name    ?? r.name;
        r.name_th = g?.name_th ?? r.name;
      });
    }
    setDetailData(detailArr);
    applyColors(colorArr, lvl, md);
  }, [mbCode, applyColors]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBasinData = useCallback(async (date: string, lvl: BasinLevel, md: Mode, mdl: Model, mb: string, sub: 'aggregate' | 'daily' = 'aggregate') => {
    if (!date) return;
    const params = new URLSearchParams({ date, model: mdl, mb_code: mb });
    if (sub === 'daily') params.set('sub', 'daily');
    const detailParams = new URLSearchParams({ date, model: mdl, mb_code: mb });
    if (sub === 'daily') detailParams.set('sub', 'daily');
    const [color, detail] = await Promise.all([
      fetch(`${API}/basin/${lvl}?${params}`).then(r => r.json()).catch(() => []),
      fetch(`${API}/basin/${lvl}/detail?${detailParams}`).then(r => r.json()).catch(() => []),
    ]);
    const colorArr = Array.isArray(color) ? color : [];
    const detailArr = Array.isArray(detail) ? detail : [];
    setBasinColorData(colorArr); setBasinDetailData(detailArr);
    if (lvl === 'subbasin-l1') setBasinL1DetailData(detailArr);
    if (lvl === 'watershed')   setBasinL1DetailData([]);
    applyBasinColors(colorArr, watershed, lvl, md);
  }, [watershed, applyBasinColors]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch tambon colors only (no detail, no map update) — pre-populates tambon dropdown on amphoe select
  const prefetchTambonColors = useCallback(async (date: string, md: Mode, provId: string, mdl: Model) => {
    if (!date || !provId) return;
    setTambonColorData([]);
    const params = new URLSearchParams({ date, model: mdl, mb_code: mbCode, province_id: provId });
    const color = await fetch(`${API}/forecast/tambon?${params}`).then(r => r.json());
    const colorArr = Array.isArray(color) ? color : [];
    setTambonColorData(colorArr);
    console.log('[WF] prefetchTambonColors → tambonColorData set', colorArr.length, 'items');
  }, [mbCode]);

  // ── Admin selection handlers ────────────────────────────────────────────────
  // Wrap fetchData so handlers always carry the current subMode without needing to know about it.
  const fetchDataWithSub = useCallback(
    (date: string, lvl: Level, md: Mode, provId: string, mdl: Model) =>
      fetchData(date, lvl, md, provId, mdl, subMode),
    [fetchData, subMode],
  );

  const {
    updateSidebarLists,
    handleProvinceSelect, handleAmphoeSelect, handleAmphoeDeselect,
    handleTambonDeselect, handleDrillToTambon, handleDrillToAllTambon, handleDrillToAllAmphoe, handleTambonSelect,
  } = useSelectionHandlers({
    mapRef, bboxRef, amphoeBboxRef, geoRef,
    selectedDate, mode, model, selectedProvince, selectedAmphoe, selectedTambon,
    entryFromAllTambon: adminState.entryFromAllTambon,
    entryFromAllAmphoe: adminState.entryFromAllAmphoe,
    dispatch: adminDispatch,
    setAmphoeList, setTambonList, fetchData: fetchDataWithSub, prefetchTambonColors, watershed, getFillOpacity,
  });

  // Filter sidebar lists to basin members only (API returns only basin subset; geo JSON has all)
  const filteredAmphoeList = useMemo(() => {
    if (amphoeColorData.length === 0) return [];
    const ids = new Set(amphoeColorData.map(r => r.id));
    return amphoeList.filter(a => ids.has(a.id));
  }, [amphoeList, amphoeColorData]);

  const filteredTambonList = useMemo(() => {
    if (tambonColorData.length === 0) return [];
    const ids = new Set(tambonColorData.map(r => r.id));
    return tambonList.filter(t => ids.has(t.id));
  }, [tambonList, tambonColorData]);

  const handleAdminRowClick = useCallback((id: string) => {
    if (activeLevel === 'province')     { if (id !== selectedProvince) handleProvinceSelect(id); }
    else if (activeLevel === 'amphoe')  { if (id !== selectedAmphoe)   handleAmphoeSelect(id); }
    else                                { if (id !== selectedTambon)   handleTambonSelect(id); }
  }, [activeLevel, selectedProvince, selectedAmphoe, selectedTambon,
      handleProvinceSelect, handleAmphoeSelect, handleTambonSelect]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || provinces.length === 0 || initialized.current) return;
    initialized.current = true;
    fetch(`${API}/basin/dates?model=${model}&mb_code=${mbCode}`)
      .then(r => r.json()).then((dates: unknown) => {
        if (!Array.isArray(dates) || !dates.length) return;
        const defaultDate = selectDefaultDate(dates, model, subMode);
        setAvailableDates(dates); setSelectedDate(defaultDate);
        setAdminLayersVisible(false);
        fetchBasinData(defaultDate, 'subbasin-l1', mode, model, mbCode, subMode);
      });
  }, [mapReady, provinces, updateSidebarLists]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReady || viewMode !== 'basin') return;
    setBasinLayersVisible(watershed, basinLevel);
    setWatershedHighlight(basinLevel === 'watershed' ? mbCode : null);
    setL1Highlight(watershed, basinLevel === 'subbasin-l1' ? selectedL1 : null);
    setL2Highlight(watershed, basinLevel === 'subbasin-l2' ? selectedL2 : null);
    setL2SbFilter(watershed, basinLevel === 'subbasin-l2' ? l2FilterSbCode : null);
  }, [basinLevel, selectedL1, selectedL2, l2FilterSbCode, mapReady, viewMode,
      setBasinLayersVisible, setWatershedHighlight, setL1Highlight, setL2Highlight, setL2SbFilter]); // eslint-disable-line react-deps

  useEffect(() => {
    setHighlightColor(mode);
    if (!initialized.current || !selectedDate) return;
    if (viewMode === 'basin') fetchBasinData(selectedDate, basinLevel, mode, model, mbCode, subMode);
    else { const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(selectedDate, activeLevel, mode, p, model, subMode); }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rainfall guard: enforce rainfall mode validity after any relevant state change.
  // Invalid state: rainfall mode + past date + not at microbasin level.
  // Resolution: reset to current date (stay in rainfall) → if unavailable, switch to waterbalance with default date.
  useEffect(() => {
    if (!ENABLE_RAINFALL_GUARD) return;
    if (mode !== 'rainfall') return;
    if (viewMode === 'basin' && basinLevel === 'subbasin-l2') return;
    if (!initialized.current || !selectedDate) return;

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const prevMonth = (() => { const d = new Date(today); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
    const floor14d = (() => { const d = new Date(today); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })();
    const floor6m = availableDates.some(d => d.slice(0, 7) === currentMonth) ? currentMonth : prevMonth;
    const floor7d = availableDates.some(d => d === today) ? today : floor14d;

    const past = model === '6months'
      ? selectedDate.slice(0, 7) < floor6m
      : selectedDate < floor7d;
    if (!past) return;

    const resetDate = selectDefaultDate(availableDates, model, subMode);
    const resetIsCurrent = !!resetDate && (
      model === '6months' ? resetDate.slice(0, 7) >= floor6m : resetDate >= floor7d
    );

    if (resetIsCurrent) {
      setSelectedDate(resetDate);
      if (viewMode === 'basin') fetchBasinData(resetDate, basinLevel, mode, model, mbCode, subMode);
      else { const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(resetDate, activeLevel, mode, p, model, subMode); }
    } else {
      const defaultDate = selectDefaultDate(availableDates, model, subMode);
      if (defaultDate && defaultDate !== selectedDate) setSelectedDate(defaultDate);
      setMode('waterbalance' as Mode);
    }
  }, [mode, selectedDate, viewMode, basinLevel, model, subMode, availableDates]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOverlayVisible('adm1-overlay', overlayProvince);
    setOverlayVisible('adm2-overlay', overlayAmphoe);
    setOverlayVisible('ping-rivers', overlayRivers && watershed === 'ping');
    setOverlayVisible('yom-rivers',  overlayRivers && watershed === 'yom');
    setOverlayVisible('hillshading', overlayHillshade);
    setOverlayVisible('basemap-cover', !overlayBasemap);
    setOverlayVisible('ping-reservoir-small',  overlayReservoirS && watershed === 'ping');
    setOverlayVisible('ping-reservoir-medium', overlayReservoirM && watershed === 'ping');
    setOverlayVisible('ping-reservoir-large',  overlayReservoirL && watershed === 'ping');
    setOverlayVisible('yom-reservoir-small',   overlayReservoirS && watershed === 'yom');
    setOverlayVisible('yom-reservoir-medium',  overlayReservoirM && watershed === 'yom');
    setOverlayVisible('yom-reservoir-large',   overlayReservoirL && watershed === 'yom');
    setOverlayVisible('ping-agriculture', agricultureOn && watershed === 'ping');
    setOverlayVisible('yom-agriculture',  agricultureOn && watershed === 'yom');
    setAgricultureCropFilter(watershed, [...enabledCrops]);
    setDataFillOpacity(overlayRivers || overlayHillshade || overlayReservoirS || overlayReservoirM || overlayReservoirL || agricultureOn);
  }, [overlayProvince, overlayAmphoe, overlayRivers, overlayHillshade, overlayBasemap, overlayReservoirS, overlayReservoirM, overlayReservoirL, enabledCrops, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Model / view-mode toggles ───────────────────────────────────────────────
  const handleModelChange = async (m: Model) => {
    setModel(m); setSubMode('aggregate'); setAvailableDates([]); setSelectedDate('');
    if (viewMode === 'basin') {
      const dates = await fetch(`${API}/basin/dates?model=${m}&mb_code=${mbCode}`).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const defaultDate = selectDefaultDate(vd, m, 'aggregate');
      setAvailableDates(vd);
      if (defaultDate) { setSelectedDate(defaultDate); fetchBasinData(defaultDate, basinLevel, mode, m, mbCode, 'aggregate'); }
    } else {
      const dates = await fetch(`${API}/forecast/dates?model=${m}&mb_code=${mbCode}`).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const defaultDate = selectDefaultDate(vd, m, 'aggregate');
      setAvailableDates(vd);
      if (defaultDate) { setSelectedDate(defaultDate); const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(defaultDate, activeLevel, mode, p, m, 'aggregate'); }
    }
  };

  const handleSubModeChange = async (sub: 'aggregate' | 'daily') => {
    setSubMode(sub); setAvailableDates([]); setSelectedDate('');
    if (viewMode === 'basin') {
      const url = sub === 'daily'
        ? `${API}/basin/dates?model=${model}&mb_code=${mbCode}&sub=daily`
        : `${API}/basin/dates?model=${model}&mb_code=${mbCode}`;
      const dates = await fetch(url).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const defaultDate = selectDefaultDate(vd, model, sub);
      setAvailableDates(vd);
      if (defaultDate) { setSelectedDate(defaultDate); fetchBasinData(defaultDate, basinLevel, mode, model, mbCode, sub); }
    } else {
      const url = sub === 'daily'
        ? `${API}/forecast/dates?model=${model}&mb_code=${mbCode}&sub=daily`
        : `${API}/forecast/dates?model=${model}&mb_code=${mbCode}`;
      const dates = await fetch(url).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const defaultDate = selectDefaultDate(vd, model, sub);
      setAvailableDates(vd);
      if (defaultDate) { setSelectedDate(defaultDate); const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(defaultDate, activeLevel, mode, p, model, sub); }
    }
  };

  const handleViewModeChange = async (m: 'admin' | 'basin') => {
    setViewMode(m);
    setAvailableDates([]);
    setSelectedDate('');
    if (!mapReady) return;
    if (m === 'basin') {
      mapRef.current?.setMinZoom(null);
      setAdminLayersVisible(false);
      dispatch({ type: 'RESET' });
      adminDispatch({ type: 'RESET' });
      setBasinLayersVisible(watershed, 'subbasin-l1');
      const url = subMode === 'daily'
        ? `${API}/basin/dates?model=${model}&mb_code=${mbCode}&sub=daily`
        : `${API}/basin/dates?model=${model}&mb_code=${mbCode}`;
      const dates = await fetch(url).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const date = vd.includes(selectedDate) ? selectedDate : (vd[vd.length - 1] ?? '');
      setAvailableDates(vd);
      if (date) { setSelectedDate(date); fetchBasinData(date, 'subbasin-l1', mode, model, mbCode, subMode); }
    } else {
      setBasinLayersVisible(null, null); setAdminLayersVisible(true);
      const url = subMode === 'daily'
        ? `${API}/forecast/dates?model=${model}&mb_code=${mbCode}&sub=daily`
        : `${API}/forecast/dates?model=${model}&mb_code=${mbCode}`;
      const dates = await fetch(url).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const date = vd.includes(selectedDate) ? selectedDate : (vd[vd.length - 1] ?? '');
      setAvailableDates(vd);
      if (date) { setSelectedDate(date); const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(date, activeLevel, mode, p, model, subMode); }
    }
  };

  // ── Date select ─────────────────────────────────────────────────────────────
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (viewMode === 'basin') fetchBasinData(date, basinLevel, mode, model, mbCode, subMode);
    else { const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(date, activeLevel, mode, p, model, subMode); }
  };

  // ── Mode select ─────────────────────────────────────────────────────────────
  const handleModeChange = (md: string) => setMode(md as Mode);

  // ── Basin navigation ────────────────────────────────────────────────────────
  const handleWatershedClick = useCallback(() => {
    dispatch({ type: 'DRILL_TO_L1' });
    mapRef.current?.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode, subMode);
  }, [selectedDate, mode, model, mbCode, subMode, watershed, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrillToL1 = useCallback(() => {
    dispatch({ type: 'DRILL_TO_L1' });
    mapRef.current?.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode, subMode);
  }, [selectedDate, mode, model, mbCode, subMode, watershed, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectL1 = useCallback((sbCode: string) => {
    dispatch({ type: 'SELECT_L1', sbCode });
    const bbox = l1BboxRef.current[watershed]?.[sbCode];
    if (bbox && mapRef.current)
      mapRef.current.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
  }, [watershed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectL2 = useCallback((subbasinId: string) => {
    if (basinState.basinLevel === 'subbasin-l1') {
      dispatch({ type: 'SELECT_L2_FROM_PREVIEW', subbasinId });
    } else {
      dispatch({ type: 'SELECT_L2', subbasinId });
    }
  }, [basinState.basinLevel]);
  const handleDrillToL2 = () => { dispatch({ type: 'DRILL_L2' }); if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode, subMode); };
  const handleDrillToL2FromWatershed = () => { dispatch({ type: 'DRILL_L2_FROM_WATERSHED' }); if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode, subMode); };
  const handleDrillToL2FromL1 = useCallback((sbCode: string) => {
    if (!selectedDate) return;
    dispatch({ type: 'DRILL_L2_FROM_L1', sbCode });
    fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode, subMode);
  }, [selectedDate, mode, model, mbCode, subMode, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBasinBack = useCallback(() => {
    const will = basinLevel === 'subbasin-l2' ? 'subbasin-l1' : basinLevel === 'subbasin-l1' ? 'watershed' : null;
    dispatch({ type: 'BACK' });
    if (will === 'subbasin-l1' && selectedDate) fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode, subMode);
    else if (will === 'watershed' && selectedDate) fetchBasinData(selectedDate, 'watershed', mode, model, mbCode, subMode);
  }, [basinLevel, selectedDate, mode, model, mbCode, subMode, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBasinRowClick = useCallback((id: string) => {
    if (basinLevel === 'watershed') handleWatershedClick();
    else if (basinLevel === 'subbasin-l1') { if (id !== selectedL1) handleSelectL1(id); }
    else { if (id !== selectedL2) handleSelectL2(id); }
  }, [basinLevel, selectedL1, selectedL2, handleWatershedClick, handleSelectL1, handleSelectL2]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const rows = viewMode === 'basin' ? basinDetailData : detailData;
    const rainfallLabel = model === '7days' ? t.table.rainfall7days : t.table.rainfall6months;
    const levelLabel = viewMode === 'basin'
      ? (basinLevel === 'watershed' ? t.table.watershed : basinLevel === 'subbasin-l1' ? t.table.subbasinL1 : t.table.subbasinL2)
      : (activeLevel === 'province'  ? t.table.province  : activeLevel === 'amphoe' ? t.table.amphoe : t.table.tambon);
    const headers = mode === 'rainfall'
      ? [t.table.code, `${levelLabel} EN`, `${levelLabel} TH`, t.table.rainfallIndex, rainfallLabel, t.table.waterbalanceVal, t.table.waterdemand, t.table.watersupply, t.table.reservoir]
      : [t.table.code, `${levelLabel} EN`, `${levelLabel} TH`, t.table.waterbalance, t.table.drought, t.table.runoff, t.table.waterbalanceVal, t.table.waterdemand, t.table.watersupply, rainfallLabel, t.table.reservoir];
    const formatCode = (r: any) => `${r.id ?? ''}`;
    const rowData = (r: any) => mode === 'rainfall'
      ? [formatCode(r), `"${r.name ?? ''}"`, `"${r.name_th ?? ''}"`, rainfallToIndex(r.rainfall), r.rainfall ?? '', r.water_balance ?? '', r.water_demand ?? '', r.watersupply ?? '', r.reservoir ?? '']
      : [formatCode(r), `"${r.name ?? ''}"`, `"${r.name_th ?? ''}"`, r.wb_level ?? '', r.drought_index ?? '', r.runoff_index ?? '', r.water_balance ?? '', r.water_demand ?? '', r.watersupply ?? '', r.rainfall ?? '', r.reservoir ?? ''];
    const lines = [headers.join(','), ...rows.map((r: any) => rowData(r).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    if (!selectedDate) return;
    const modelLabel  = model === '7days' ? 'week' : 'month';
    const subLabel    = subMode === 'daily' ? 'daily' : model === '7days' ? 'weekly' : 'monthly';
    const langLabel   = locale === 'th' ? 'TH' : 'EN';
    const dateLabel   = model === '6months' && subMode === 'aggregate' ? selectedDate.slice(0, 7) : selectedDate;
    const mapLevelLabel = viewMode === 'admin'
      ? (activeLevel === 'tambon' ? 'tambon' : activeLevel === 'amphoe' ? 'amphoe' : 'province')
      : (basinLevel === 'subbasin-l2' ? 'microbasin' : basinLevel === 'subbasin-l1' ? 'subbasin' : 'watershed');
    const a = document.createElement('a'); a.href = url; a.download = `${watershed}-${dateLabel}-${viewMode}-${mapLevelLabel}-${modelLabel}-${subLabel}-${langLabel}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const swatHref = swatZipUrl(watershed, viewMode, activeLevel, basinLevel);
  const handleDownloadShp = async () => {
    const res = await fetch(swatHref);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = swatHref.split('/').pop() ?? 'shapefile.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExportPng = () => {
    const map = mapRef.current;
    if (!map) return;
    exportMapPng({ map, mode, model, subMode, watershed, date: selectedDate, locale, t, enabledCrops })
      .catch(err => console.error('PNG export failed', err));
  };

  // ── Map events ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (viewMode === 'basin') {
      const basinFillLayer =
        basinLevel === 'watershed'   ? 'basin-watershed-fill' :
        basinLevel === 'subbasin-l1' ? `${watershed}-l1-fill` :
                                       `${watershed}-l2-fill`;
      const lookupBasinVal = (id: string) => { const row = basinColorData.find(r => r.id === id); return row != null ? modeValue(row, mode) : null; };
      const lookupBasinGeo = (props: Record<string, unknown>) => {
        if (basinLevel === 'watershed') return { name: String(props.MBASIN_E ?? props.MB_CODE ?? ''), name_th: String(props.MBASIN_T ?? props.MB_CODE ?? '') };
        if (basinLevel === 'subbasin-l1') { const row = basinDetailData.find(r => r.id === props.SB_CODE); const name = row?.name ?? String(props.SB_CODE ?? ''); return { name, name_th: name }; }
        const id = String(props.Subbasin ?? ''); return { name: `Sub-basin #${id}`, name_th: `Sub-basin #${id}` };
      };
      const onMouseMove = (e: maplibregl.MapMouseEvent) => {
        const feat = map.queryRenderedFeatures(e.point, { layers: [basinFillLayer] });
        if (!feat.length) { setTooltip(null); return; }
        const props = feat[0].properties ?? {};
        const id = basinLevel === 'watershed' ? String(props.MB_CODE ?? '') : basinLevel === 'subbasin-l1' ? String(props.SB_CODE ?? '') : String(props.Subbasin ?? '');
        if (!id) { setTooltip(null); return; }
        setTooltip({ x: e.originalEvent.offsetX, y: e.originalEvent.offsetY, ...lookupBasinGeo(props), value: lookupBasinVal(id) });
      };
      const onLeave = () => setTooltip(null);
      const onCursor = () => { map.getCanvas().style.cursor = 'pointer'; };
      const offCursor = () => { map.getCanvas().style.cursor = ''; };
      const onClick = (e: maplibregl.MapMouseEvent) => {
        if (basinLevel === 'watershed') {
          if (map.queryRenderedFeatures(e.point, { layers: ['basin-watershed-hit'] }).length) handleWatershedClick();
        } else if (basinLevel === 'subbasin-l1') {
          const feat = map.queryRenderedFeatures(e.point, { layers: [`${watershed}-l1-fill`] });
          if (!feat.length) { handleBasinBack(); return; }
          const sbCode = String(feat[0].properties?.SB_CODE ?? '');
          if (!sbCode) return;
          if (sbCode === selectedL1) handleDrillToL2FromL1(sbCode); else handleSelectL1(sbCode);
        } else {
          const feat = map.queryRenderedFeatures(e.point, { layers: [`${watershed}-l2-fill`] });
          if (!feat.length) { handleBasinBack(); return; }
          const id = String(feat[0].properties?.Subbasin ?? '');
          if (id) handleSelectL2(id);
        }
      };
      map.on('mousemove', onMouseMove); map.on('mouseleave', basinFillLayer, onLeave);
      map.on('mousemove', basinFillLayer, onCursor); map.on('mouseleave', basinFillLayer, offCursor);
      map.on('click', onClick);
      return () => {
        map.off('mousemove', onMouseMove); map.off('mouseleave', basinFillLayer, onLeave);
        map.off('mousemove', basinFillLayer, onCursor); map.off('mouseleave', basinFillLayer, offCursor);
        map.off('click', onClick);
      };
    }

    const fillLayer = activeLevel === 'province' ? 'adm1-fill' : activeLevel === 'amphoe' ? 'adm2-fill' : 'adm3-fill';
    const pcodeField = activeLevel === 'province' ? 'adm1_pcode' : activeLevel === 'amphoe' ? 'adm2_pcode' : 'adm3_pcode';
    const stripTH = (p: string) => p.startsWith('TH') ? p.slice(2) : p;
    const levelColorData = activeLevel === 'province' ? provinceColorData : activeLevel === 'amphoe' ? amphoeColorData : tambonColorData;
    const lookupVal = (id: string) => { const row = levelColorData.find(r => r.id === id); return row != null ? modeValue(row, mode) : null; };
    const lookupGeo = (id: string) => {
      if (!geoRef.current) return { name: id, name_th: id };
      const list = activeLevel === 'province' ? geoRef.current.provinces : activeLevel === 'amphoe' ? geoRef.current.amphoes : geoRef.current.tambons;
      const found = list.find(g => g.id === id);
      return found ? { name: found.name, name_th: found.name_th } : { name: id, name_th: id };
    };
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const feat = map.queryRenderedFeatures(e.point, { layers: [fillLayer] });
      if (!feat.length) { setTooltip(null); return; }
      const pcode = feat[0].properties?.[pcodeField] as string | undefined;
      if (!pcode) { setTooltip(null); return; }
      const id = stripTH(pcode);
      setTooltip({ x: e.originalEvent.offsetX, y: e.originalEvent.offsetY, ...lookupGeo(id), value: lookupVal(id) });
    };
    const onLeave = () => setTooltip(null);
    const onCursor = () => { map.getCanvas().style.cursor = 'pointer'; };
    const offCursor = () => { map.getCanvas().style.cursor = ''; };
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (activeLevel === 'province') {
        const feat = map.queryRenderedFeatures(e.point, { layers: ['adm1-hit'] });
        if (!feat.length) { if (selectedProvince) handleProvinceSelect(''); return; }
        const pcode = feat[0].properties?.adm1_pcode as string | undefined; if (!pcode) return;
        const id = stripTH(pcode);
        if (id === selectedProvince) handleAmphoeSelect(''); else handleProvinceSelect(id);
      } else if (activeLevel === 'amphoe') {
        const feat = map.queryRenderedFeatures(e.point, { layers: [fillLayer] });
        if (!feat.length) { handleAmphoeDeselect(); return; }
        const pcode = feat[0].properties?.[pcodeField] as string | undefined; if (!pcode) return;
        const id = stripTH(pcode);
        // First click selects (handleAmphoeSelect derives province when in all-amphoe view);
        // re-clicking the already-selected amphoe drills to its tambons. DRILL_TO_TAMBON clears
        // entryFromAllAmphoe, so drilling cleanly exits the all-amphoe view into normal nav.
        if (id === selectedAmphoe) handleDrillToTambon(); else handleAmphoeSelect(id);
      } else {
        const feat = map.queryRenderedFeatures(e.point, { layers: [fillLayer] });
        if (!feat.length) { handleTambonDeselect(); return; }
        const pcode = feat[0].properties?.[pcodeField] as string | undefined; if (!pcode) return;
        const id = stripTH(pcode);
        if (id === selectedTambon) return; // A7 re-click same tambon → no-op
        handleTambonSelect(id);
      }
    };
    map.on('mousemove', onMouseMove); map.on('mouseleave', fillLayer, onLeave);
    map.on('mousemove', fillLayer, onCursor); map.on('mouseleave', fillLayer, offCursor);
    map.on('click', onClick);
    return () => {
      map.off('mousemove', onMouseMove); map.off('mouseleave', fillLayer, onLeave);
      map.off('mousemove', fillLayer, onCursor); map.off('mouseleave', fillLayer, offCursor);
      map.off('click', onClick);
    };
  }, [
    mapReady, viewMode, basinLevel, basinColorData, basinDetailData,
    activeLevel, selectedProvince, selectedAmphoe, selectedTambon, provinceColorData, amphoeColorData, tambonColorData, mode,
    handleProvinceSelect, handleAmphoeSelect, handleAmphoeDeselect,
    handleTambonSelect, handleTambonDeselect, handleDrillToTambon,
    handleWatershedClick, handleSelectL1, handleSelectL2, handleDrillToL2FromL1,
    selectedL1, handleBasinBack,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dropdown option lists ───────────────────────────────────────────────────
  const allDateOptions = [...availableDates].reverse().map(d => ({ value: d, label: fmtDate(d) }));
  const currentDate = selectDefaultDate(availableDates, model, subMode);

  const _today = new Date().toISOString().slice(0, 10);
  const _currentMonth = _today.slice(0, 7);

  // Effective rainfall floor — fallback when current date/month is absent from DB.
  // 6months: current month if it exists, else previous month (data may arrive mid-month).
  // 7days: today if it exists, else 14 days ago (data updates weekly, not daily).
  const _prevMonth = (() => { const d = new Date(_today); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const _14daysAgo = (() => { const d = new Date(_today); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })();
  const _rainfallFloor6m = allDateOptions.some(o => o.value.slice(0, 7) === _currentMonth) ? _currentMonth : _prevMonth;
  const _rainfallFloor7d = allDateOptions.some(o => o.value === _today) ? _today : _14daysAgo;

  // subbasin-l2 (microbasin) exempts from date-based rainfall restrictions
  const isAtMicrobasin = viewMode === 'basin' && basinLevel === 'subbasin-l2';

  const rainfallDateOptions = isAtMicrobasin
    ? allDateOptions
    : model === '7days'
      ? allDateOptions.filter(o => o.value >= _rainfallFloor7d)
      : allDateOptions.filter(o => o.value.slice(0, 7) >= _rainfallFloor6m);

  const dateOptions = mode === 'rainfall' ? rainfallDateOptions : allDateOptions;
  const rainfallDisabled = rainfallDateOptions.length === 0
    || !rainfallDateOptions.some(o => o.value === selectedDate);

  const isPastDate = !!selectedDate && (
    model === '6months'
      ? selectedDate.slice(0, 7) < _rainfallFloor6m
      : selectedDate < _rainfallFloor7d
  );
  const showRainfall = isAtMicrobasin || !isPastDate;
  const modeOptions: { value: Mode; label: string; disabled?: boolean }[] = [
    { value: 'drought',      label: t.mode.drought },
    { value: 'runoff',       label: t.mode.runoff },
    { value: 'waterbalance', label: t.mode.waterbalance },
    { value: 'rainfall',     label: t.mode.rainfall, disabled: rainfallDisabled },
  ];
  const viewModeOptions = [
    { value: 'basin', label: t.viewMode.basin },
    { value: 'admin', label: t.viewMode.admin },
  ];
  const modelOptions: { value: Model; label: string }[] = [
    { value: '6months', label: t.model['6months'] },
    { value: '7days',   label: t.model['7days'] },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fc-layout" style={{ fontFamily: 'sans-serif', fontSize: 13 }}>

      {/* Mobile overlay */}
      <div className={`fc-sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* ── Main row (sidebar + right column) ───────────────────────────────── */}
      <div className="fc-main">

        {/* ── Left sidebar ─────────────────────────────────────────────────── */}
        <div
          className={`fc-sidebar${sidebarOpen ? ' open' : ''}`}
          style={{
            background: P.sidebarBg, borderRight: `1px solid ${P.sidebarBorder}`,
            width: sidebarCollapsed ? theme.sidebar.collapsedWidth : theme.sidebar.width,
            transition: 'width 0.2s ease', display: 'flex', flexDirection: 'row',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

            {/* Logo + title */}
            <div style={{
              padding: '10px 10px 8px', flexShrink: 0,
              borderBottom: `1px solid ${P.sidebarBorder}`,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/hii.png" alt="HII" style={{ height: 28, width: 'auto' }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/cmu.svg" alt="CMU" style={{ height: 28, width: 'auto' }} />
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: theme.color.brandDark, lineHeight: 1.5 }}>
                {viewMode === 'admin' ? t.basinHeader[watershed] : t.app.title}
              </div>
            </div>

            {/* Section label */}
            <div style={{
              background: P.sectionBg, padding: '5px 10px',
              fontSize: theme.fontSize.xs, fontWeight: 700, color: theme.color.textLabel,
              textTransform: 'uppercase', letterSpacing: 0.5,
              borderBottom: `1px solid ${P.sidebarBorder}`, flexShrink: 0,
            }}>
              {t.sidebar.analysisResults}
            </div>

            {/* Dropdowns: view-mode + model */}
            <div style={{
              padding: '8px 10px', flexShrink: 0,
              borderBottom: `1px solid ${P.sidebarBorder}`,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textLabel, marginBottom: 2 }}>
                {t.sidebar.boundaryType}
              </div>
              <ProtoDropdown
                label={viewModeOptions.find(o => o.value === viewMode)?.label ?? viewMode}
                options={viewModeOptions}
                onSelect={v => handleViewModeChange(v as 'admin' | 'basin')}
                fullWidth
                testId="viewmode-dropdown"
              />
              <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textLabel, marginTop: 4, marginBottom: 2 }}>
                {t.model.label}
              </div>
              <ProtoDropdown
                label={modelOptions.find(o => o.value === model)?.label ?? model}
                options={modelOptions}
                onSelect={v => handleModelChange(v as Model)}
                fullWidth
                testId="model-dropdown"
              />
              <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', flexShrink: 0, marginTop: 2 }}>
                {([
                  { value: 'aggregate' as const, label: model === '6months' ? t.model.monthly : t.model.weekly },
                  { value: 'daily' as const,     label: t.model.daily },
                ] as const).filter(opt => !(model === '6months' && opt.value === 'daily')).map(opt => (
                  <button
                    key={opt.value}
                    data-testid={`submode-${opt.value}`}
                    onClick={() => handleSubModeChange(opt.value)}
                    style={{
                      flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 500,
                      background: subMode === opt.value ? P.btnBlue : P.sectionBg,
                      color: subMode === opt.value ? theme.color.textOnDark : theme.color.textBody,
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Basin / Province navigation */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {viewMode === 'basin' ? (
                <BasinSidebar
                  basinLevel={basinLevel} selectedBasin={watershed}
                  selectedL1={selectedL1} selectedL2={selectedL2} l2FilterSbCode={l2FilterSbCode}
                  colorData={basinColorData} l1DetailData={basinL1DetailData}
                  detailData={
                    l2FilterSbCode && basinLevel === 'subbasin-l2'
                      ? basinDetailData.filter(r => l2SbLookup.current[watershed]?.[r.id] === l2FilterSbCode)
                      : basinDetailData
                  }
                  mode={mode}
                  onSelectBasin={(id: string) => {
                    const basin = id === '06' ? 'ping' : 'yom';
                    if (basin !== watershed) { router.push(`/forecast/${basin}`); } else { handleWatershedClick(); }
                  }}
                  onSelectL1={handleSelectL1} onSelectL2={handleSelectL2}
                  onDrillL1={handleDrillToL1}
                  onBack={handleBasinBack}
                />
              ) : (
                <>
                <div style={{
                  padding: '6px 12px', fontSize: theme.fontSize.xs, fontWeight: 700,
                  color: theme.color.textLabel, textTransform: 'uppercase',
                  background: P.sectionBg, borderBottom: `1px solid ${P.sidebarBorder}`,
                  flexShrink: 0, letterSpacing: 0.3,
                }}>
                  {t.viewMode.admin} · {t.basinHeader[watershed]}
                </div>
                <ProvinceSelector
                  provinces={basinProvinceIds.current.size > 0 ? provinces.filter(p => basinProvinceIds.current.has(p.id)) : provinces}
                  selectedProvince={selectedProvince} selectedAmphoe={selectedAmphoe} selectedTambon={selectedTambon}
                  onSelect={handleProvinceSelect} onSelectAmphoe={handleAmphoeSelect}
                  onDeselectAmphoe={handleAmphoeDeselect} onSelectTambon={handleTambonSelect}
                  onDeselectTambon={handleTambonDeselect}
                  amphoeList={filteredAmphoeList} tambonList={filteredTambonList}
                  provinceColorData={provinceColorData} amphoeColorData={amphoeColorData} tambonColorData={tambonColorData}
                  mode={mode}
                />
                </>
              )}
            </div>

            {/* Drill to all amphoes — admin mode */}
            {viewMode === 'admin' && (
              <div
                data-testid="all-amphoes-btn"
                onClick={handleDrillToAllAmphoe}
                style={{
                  padding: '5px 12px', fontSize: theme.fontSize.xs, fontWeight: 600,
                  color: theme.color.primary, background: theme.color.primaryLight,
                  borderTop: `1px solid ${theme.color.border}`, flexShrink: 0,
                  cursor: 'pointer', userSelect: 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{t.selector.allAmphoe}</span><span>→</span>
              </div>
            )}

            {/* Drill to all tambons — admin mode */}
            {viewMode === 'admin' && (
              <div
                data-testid="all-tambons-btn"
                onClick={handleDrillToAllTambon}
                style={{
                  padding: '5px 12px', fontSize: theme.fontSize.xs, fontWeight: 600,
                  color: theme.color.primary, background: theme.color.primaryLight,
                  borderTop: `1px solid ${theme.color.border}`, flexShrink: 0,
                  cursor: 'pointer', userSelect: 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{t.selector.allTambon}</span><span>→</span>
              </div>
            )}

            {/* All micro basin — basin mode, pinned at the bottom like the admin drill buttons */}
            {viewMode === 'basin' && (
              <div
                data-testid="drill-l2-btn"
                onClick={basinLevel === 'watershed' ? handleDrillToL2FromWatershed : handleDrillToL2}
                style={{
                  padding: '5px 12px', fontSize: theme.fontSize.xs, fontWeight: 600,
                  color: theme.color.primary, background: theme.color.primaryLight,
                  borderTop: `1px solid ${theme.color.border}`, flexShrink: 0,
                  cursor: 'pointer', userSelect: 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{t.basin.drillL2}</span><span>→</span>
              </div>
            )}

            {/* Export buttons */}
            <div style={{
              padding: '8px 10px', flexShrink: 0,
              borderTop: `1px solid ${P.sidebarBorder}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textLabel, flex: 1 }}>
                {t.sidebar.exportData}
              </span>
              <IconBtn title="Download CSV"    icon="/csv.png" onClick={handleExportCsv} testId="export-csv-btn" />
              <IconBtn title="Download SHP" icon="/shp.png" onClick={handleDownloadShp} />
              <IconBtn title="Download Map (PNG)" icon="/png.png" onClick={handleExportPng} testId="export-png-btn" />
            </div>

          </div>

          {/* Collapse toggle */}
          <button
            className="fc-sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(c => !c)}
            style={{
              width: theme.sidebar.collapsedWidth, flexShrink: 0,
              border: 'none', borderLeft: `1px solid ${P.sidebarBorder}`,
              background: P.sectionBg, cursor: 'pointer',
              color: theme.color.textLabel, fontSize: theme.fontSize.base,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* ── Right column: top bar + map/table ───────────────────────────────── */}
        <div className="fc-right">

          {/* Top bar — starts at left edge of map */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
            background: P.topBarBg, borderBottom: `1px solid ${P.topBarBorder}`,
            flexShrink: 0, flexWrap: 'wrap',
          }}>
            <button
              className="fc-menu-btn"
              onClick={() => setSidebarOpen(o => !o)}
              style={{ color: theme.color.textMuted, fontSize: theme.fontSize.nav }}
            >☰</button>
            <span style={{ fontWeight: 700, fontSize: 16, color: theme.color.brandDark }}>
              {t.basinHeader[watershed]}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <ProtoDropdown
                label={selectedDate ? fmtDate(selectedDate) : '—'}
                options={dateOptions}
                onSelect={handleDateSelect}
                align="right"
                testId="date-dropdown"
              />
              <ProtoDropdown
                label={modeOptions.find(o => o.value === mode)?.label ?? mode}
                options={modeOptions}
                onSelect={handleModeChange}
                align="right"
                testId="mode-dropdown"
              />
              <button
                onClick={() => setLocale(locale === 'en' ? 'th' : 'en')}
                style={{ padding: '4px 10px', border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, background: 'transparent', color: theme.color.textMuted, cursor: 'pointer', fontSize: theme.fontSize.xs }}
              >{locale === 'en' ? 'ภาษาไทย' : 'English'}</button>
            </div>
          </div>

          {/* Map + Table */}
          <div className="fc-map-row">

            {/* ── Map column ───────────────────────────────────────────────── */}
            <div className="fc-map-column">
              <div className="fc-map-area" style={{ display: 'flex' }}>
                {/* Map wrapper (flex:1) — the drawer sits BESIDE this, so the canvas never sits under
                    the panel's scroll container. minWidth:0 lets it shrink when the drawer opens. */}
                <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                  <div ref={mapContainer} style={{ width: '100%', height: '100%' }} onMouseLeave={() => setTooltip(null)} />
                  {/* Floating toggle for the Layers drawer */}
                  <button
                    onClick={() => setLayersOpen(o => !o)}
                    title="Toggle layers"
                    style={{
                      position: 'absolute', top: 10, right: 10, zIndex: 11,
                      width: 32, height: 32,
                      border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
                      background: layersOpen ? theme.color.primaryLight : 'rgba(255,255,255,0.95)',
                      color: layersOpen ? theme.color.primaryDark : theme.color.textLabel,
                      cursor: 'pointer', fontSize: 15,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/layer.png" alt="Layers" width={18} height={18} style={{ display: 'block' }} />
                  </button>
                  {tooltip && (
                    <div style={{
                      position: 'absolute', left: tooltip.x + 14, top: tooltip.y - 10,
                      pointerEvents: 'none', background: 'rgba(255,255,255,0.97)',
                      border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)', padding: '7px 11px',
                      fontSize: theme.fontSize.sm, zIndex: 20, whiteSpace: 'nowrap',
                    }}>
                      <div style={{ fontWeight: 600, color: theme.color.textPrimary, marginBottom: 4 }}>
                        {locale === 'th' ? tooltip.name_th : tooltip.name}
                      </div>
                      {tooltip.value !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 11, height: 11, borderRadius: 2, flexShrink: 0, background: valueToColor(tooltip.value, mode), border: '1px solid #e2e8f0' }} />
                          <span style={{ color: theme.color.textBody }}>{tooltipLabel(tooltip.value, mode, t)}</span>
                        </div>
                      ) : (
                        <span style={{ color: theme.color.textMuted }}>{t.legend.nodata}</span>
                      )}
                    </div>
                  )}
                </div>
                {layersOpen && (
                  <div style={{
                    width: 240, flexShrink: 0, height: '100%',
                    borderLeft: `1px solid ${theme.color.border}`,
                  }}>
                    <OverlayToggle
                      overlayProvince={overlayProvince} overlayAmphoe={overlayAmphoe}
                      overlayRivers={overlayRivers} overlayHillshade={overlayHillshade}
                      overlayBasemap={overlayBasemap}
                      overlayReservoirS={overlayReservoirS}
                      overlayReservoirM={overlayReservoirM}
                      overlayReservoirL={overlayReservoirL}
                      onToggleProvince={() => setOverlayProvince(v => !v)}
                      onToggleAmphoe={() => setOverlayAmphoe(v => !v)}
                      onToggleRivers={() => setOverlayRivers(v => !v)}
                      onToggleHillshade={() => setOverlayHillshade(v => !v)}
                      onToggleBasemap={() => setOverlayBasemap(v => !v)}
                      onToggleReservoirS={() => setOverlayReservoirS(v => !v)}
                      onToggleReservoirM={() => setOverlayReservoirM(v => !v)}
                      onToggleReservoirL={() => setOverlayReservoirL(v => !v)}
                      watershed={watershed}
                      enabledCrops={enabledCrops}
                      onToggleAgriculture={toggleAgriculture}
                      onToggleCrop={toggleCrop}
                      viewMode={viewMode}
                      onClose={() => setLayersOpen(false)}
                    />
                  </div>
                )}
              </div>
              <Legend mode={mode} />
              {agricultureOn && <AgricultureLegend watershed={watershed} />}
            </div>

            {/* ── Table panel ──────────────────────────────────────────────── */}
            <TablePanel>
              <SideTable
                rows={viewMode === 'basin'
                  ? (l2FilterSbCode && basinLevel === 'subbasin-l2'
                      ? basinDetailData.filter(r => l2SbLookup.current[watershed]?.[r.id] === l2FilterSbCode)
                      : basinDetailData)
                  : activeLevel === 'tambon' && selectedAmphoe
                    ? detailData.filter(r => r.id.startsWith(selectedAmphoe))
                    : detailData
                }
                activeLevel={viewMode === 'basin'
                  ? (basinLevel === 'watershed' ? 'province' : basinLevel === 'subbasin-l1' ? 'amphoe' : 'tambon')
                  : activeLevel
                }
                selectedId={
                  viewMode === 'basin'
                    ? basinLevel === 'watershed' ? mbCode : basinLevel === 'subbasin-l1' ? (selectedL1 ?? undefined) : (selectedL2 ?? undefined)
                    : activeLevel === 'province' ? selectedProvince : activeLevel === 'amphoe' ? selectedAmphoe : selectedTambon
                }
                onRowClick={viewMode === 'basin' ? handleBasinRowClick : handleAdminRowClick}
                watershed={watershed} viewMode={viewMode} basinLevel={basinLevel} model={model} mode={mode} hideToolbar
                subMode={subMode} selectedDate={selectedDate}
                showRainfall={showRainfall}
                geo={geoRef.current}
              />
            </TablePanel>

          </div>{/* fc-map-row */}
        </div>{/* fc-right */}

      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(to right, ${P.footerFrom}, ${P.footerTo})`,
        color: theme.color.textOnDark, padding: '9px 18px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12, fontSize: 12,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span>
          เลขที่ 901 ถนนงามวงศ์วาน แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900
          {' '}โทรศัพท์ : 0-2158-0901 แฟกซ์ : 0-2158-0910 อีเมล์ : <u>info_thaiwater@hii.or.th</u>
        </span>
      </div>

    </div>
  );
}
