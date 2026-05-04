'use client';

import { useEffect, useRef, useState, useCallback, useReducer } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../forecast/forecast.css';
import './proto.css';

import BasinSidebar from '../forecast/components/BasinSidebar';
import ProvinceSelector from '../forecast/components/ProvinceSelector';
import OverlayToggle from '../forecast/components/OverlayToggle';
import TablePanel from '../forecast/components/TablePanel';
import SideTable from '../forecast/components/SideTable';
import Legend from '../forecast/components/Legend';
import { useLang } from '../i18n/LangContext';
import { useMapInit, INIT_VIEW } from '../forecast/hooks/useMapInit';
import { theme, valueToColor } from '../forecast/theme';
import type { Model, Mode, Level, BasinLevel } from '../forecast/hooks/useMapInit';
import { useSelectionHandlers } from '../forecast/hooks/useSelectionHandlers';
import { basinReducer, initialBasinState } from '../forecast/basin/basinState';
import { ENABLE_L2 } from '../forecast/config';
import type { Translations } from '../i18n/translations';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const P = {
  sidebarBg:     '#ffffff',
  sidebarBorder: '#e2e8f0',
  sectionBg:     '#f1f5f9',
  topBarBg:      '#ffffff',
  topBarBorder:  '#e2e8f0',
  btnBlue:       '#1565c0',
  footerFrom:    '#1565c0',
  footerTo:      '#0d47a1',
};

// ─── Reusable blue dropdown ───────────────────────────────────────────────────
function ProtoDropdown({ label, options, onSelect, align = 'left', fullWidth = false }: {
  label: string;
  options: { value: string; label: string }[];
  onSelect: (v: string) => void;
  align?: 'left' | 'right';
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', width: fullWidth ? '100%' : undefined }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 6, padding: '6px 10px', background: P.btnBlue, color: '#fff',
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
            <div
              key={o.value}
              onClick={() => { onSelect(o.value); setOpen(false); }}
              style={{
                padding: '8px 14px', cursor: 'pointer',
                fontSize: theme.fontSize.sm,
                color: theme.color.textBody,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = theme.color.primaryLight)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Icon button for sidebar exports ─────────────────────────────────────────
function IconBtn({ title, icon, onClick, href }: {
  title: string; icon: string;
  onClick?: () => void; href?: string;
}) {
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: theme.radius.md, cursor: 'pointer',
    background: theme.color.surfaceBg, border: `1px solid ${theme.color.border}`,
    textDecoration: 'none', flexShrink: 0, padding: 4,
  };
  const img = <img src={icon} alt={title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;  // eslint-disable-line @next/next/no-img-element
  if (href) return <a href={href} download title={title} style={style}>{img}</a>;
  return <button title={title} onClick={onClick} style={{ ...style, font: 'inherit' }}>{img}</button>;
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
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(1)} · ${value >= 0 ? t.legend.surplus : t.legend.deficit}`;
}

function swatZipUrl(watershed: 'ping' | 'yom', viewMode: 'admin' | 'basin', adminLevel: string, basinLevel: string) {
  const code = watershed === 'ping' ? '06' : '08';
  if (viewMode === 'admin') {
    if (adminLevel === 'tambon') return `/downloads/01Tambol_Basin${code}.zip`;
    if (adminLevel === 'amphoe') return `/downloads/02Amphoe_Basin${code}.zip`;
    return `/downloads/03Province_Basin${code}.zip`;
  }
  if (basinLevel === 'subbasin-l2') return `/downloads/Basin${code}_Sbswat.zip`;
  if (basinLevel === 'subbasin-l1') return `/downloads/Basin${code}_Sbonwr.zip`;
  return `/downloads/Basin${code}_bonwr.zip`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProtoLayout({ watershed }: { watershed: 'ping' | 'yom' }) {
  const { locale, t, setLocale } = useLang();
  const mbCode = watershed === 'ping' ? '06' : '08';

  const fmtMonth = (d: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(d + 'T00:00:00'));
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T00:00:00'));
  const fmtDate = (d: string) => d ? (model === '6months' ? fmtMonth(d) : fmtDay(d)) : '—';

  const [model, setModel]                       = useState<Model>('6months');
  const [mode,  setMode]                        = useState<Mode>('runoff');
  const [activeLevel,      setActiveLevel]      = useState<Level>('province');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedAmphoe,   setSelectedAmphoe]   = useState('');
  const [selectedTambon,   setSelectedTambon]   = useState('');
  const [availableDates,   setAvailableDates]   = useState<string[]>([]);
  const [selectedDate,     setSelectedDate]     = useState('');
  const [colorData,        setColorData]        = useState<{ id: string; value: number }[]>([]);
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

  const [basinColorData,     setBasinColorData]     = useState<{ id: string; value: number }[]>([]);
  const [basinDetailData,    setBasinDetailData]    = useState<any[]>([]);
  const [basinL1DetailData,  setBasinL1DetailData]  = useState<any[]>([]);
  const [basinL2PreviewData, setBasinL2PreviewData] = useState<{ id: string; value: number }[]>([]);

  const [overlayProvince,  setOverlayProvince]  = useState(true);
  const [overlayAmphoe,    setOverlayAmphoe]    = useState(false);
  const [overlayRivers,    setOverlayRivers]    = useState(false);
  const [overlayHillshade, setOverlayHillshade] = useState(false);

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
    setHighlightColor, setOverlayVisible,
  } = useMapInit({ selectedProvince, selectedAmphoe, activeLevel, watershed });

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (date: string, lvl: Level, md: Mode, provId: string, mdl: Model) => {
    if (!date) return;
    const params = new URLSearchParams({ date, mode: md, model: mdl, mb_code: mbCode });
    if (provId && lvl !== 'province') params.set('province_id', provId);
    const detailParams = new URLSearchParams({ date, model: mdl, mb_code: mbCode });
    if (provId && lvl !== 'province') detailParams.set('province_id', provId);
    const [color, detail] = await Promise.all([
      fetch(`${API}/forecast/${lvl}?${params}`).then(r => r.json()),
      fetch(`${API}/forecast/${lvl}/detail?${detailParams}`).then(r => r.json()),
    ]);
    const colorArr = Array.isArray(color) ? color : [];
    if (lvl === 'province' && colorArr.length > 0)
      basinProvinceIds.current = new Set(colorArr.map((r: { id: string }) => r.id));
    setColorData(colorArr);
    const detailArr = Array.isArray(detail) ? detail : [];
    if (geoRef.current) {
      const geoList = lvl === 'province' ? geoRef.current.provinces : lvl === 'amphoe' ? geoRef.current.amphoes : geoRef.current.tambons;
      const thMap = new Map(geoList.map(g => [g.id, g.name_th]));
      detailArr.forEach(r => { r.name_th = thMap.get(r.id) ?? r.name; });
    }
    setDetailData(detailArr);
    applyColors(colorArr, lvl, md);
  }, [mbCode, applyColors]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBasinData = useCallback(async (date: string, lvl: BasinLevel, md: Mode, mdl: Model, mb: string) => {
    if (!date) return;
    const params = new URLSearchParams({ date, mode: md, model: mdl, mb_code: mb });
    const detailParams = new URLSearchParams({ date, model: mdl, mb_code: mb });
    const [color, detail] = await Promise.all([
      fetch(`${API}/basin/${lvl}?${params}`).then(r => r.json()),
      fetch(`${API}/basin/${lvl}/detail?${detailParams}`).then(r => r.json()),
    ]);
    const colorArr = Array.isArray(color) ? color : [];
    const detailArr = Array.isArray(detail) ? detail : [];
    setBasinColorData(colorArr); setBasinDetailData(detailArr);
    if (lvl === 'subbasin-l1') setBasinL1DetailData(detailArr);
    if (lvl === 'watershed')   setBasinL1DetailData([]);
    applyBasinColors(colorArr, watershed, lvl, md);
  }, [watershed, applyBasinColors]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin selection handlers ────────────────────────────────────────────────
  const {
    updateSidebarLists,
    handleProvinceSelect, handleAmphoeSelect, handleAmphoeDeselect,
    handleTambonDeselect, handleDrillToTambon, handleTambonSelect,
  } = useSelectionHandlers({
    mapRef, bboxRef, amphoeBboxRef, geoRef,
    selectedDate, mode, model, selectedProvince, selectedAmphoe,
    setSelectedProvince, setSelectedAmphoe, setSelectedTambon, setActiveLevel,
    setAmphoeList, setTambonList, fetchData, watershed,
  });

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
        const latest = dates[dates.length - 1];
        setAvailableDates(dates); setSelectedDate(latest);
        setAdminLayersVisible(false);
        fetchBasinData(latest, 'subbasin-l1', mode, model, mbCode);
      });
  }, [mapReady, provinces, updateSidebarLists]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedL1 || !selectedDate || basinLevel !== 'subbasin-l1') { setBasinL2PreviewData([]); return; }
    fetch(`${API}/basin/subbasin-l2?date=${selectedDate}&mode=${mode}&model=${model}&mb_code=${mbCode}`)
      .then(r => r.json()).then(data => {
        const arr: { id: string; value: number }[] = Array.isArray(data) ? data : [];
        const lookup = l2SbLookup.current[watershed] ?? {};
        setBasinL2PreviewData(arr.filter(r => lookup[r.id] === selectedL1));
      });
  }, [selectedL1, selectedDate, mode, model, basinLevel]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (viewMode === 'basin') fetchBasinData(selectedDate, basinLevel, mode, model, mbCode);
    else { const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(selectedDate, activeLevel, mode, p, model); }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOverlayVisible('adm1-overlay', overlayProvince);
    setOverlayVisible('adm2-overlay', overlayAmphoe);
    setOverlayVisible('ping-rivers', overlayRivers && watershed === 'ping');
    setOverlayVisible('yom-rivers',  overlayRivers && watershed === 'yom');
    setOverlayVisible('hillshading', overlayHillshade);
  }, [overlayProvince, overlayAmphoe, overlayRivers, overlayHillshade, viewMode, basinLevel, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Model / view-mode toggles ───────────────────────────────────────────────
  const handleModelChange = async (m: Model) => {
    setModel(m); setAvailableDates([]); setSelectedDate('');
    if (viewMode === 'basin') {
      const dates = await fetch(`${API}/basin/dates?model=${m}&mb_code=${mbCode}`).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const latest = vd[vd.length - 1] ?? '';
      setAvailableDates(vd);
      if (latest) { setSelectedDate(latest); fetchBasinData(latest, basinLevel, mode, m, mbCode); }
    } else {
      const dates = await fetch(`${API}/forecast/dates?model=${m}&mb_code=${mbCode}&start=2020-01-01&end=2030-12-31`).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const latest = vd[vd.length - 1] ?? '';
      setAvailableDates(vd);
      if (latest) { setSelectedDate(latest); const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(latest, activeLevel, mode, p, m); }
    }
  };

  const handleViewModeChange = async (m: 'admin' | 'basin') => {
    setViewMode(m);
    if (!mapReady) return;
    if (m === 'basin') {
      mapRef.current?.setMinZoom(null);
      setAdminLayersVisible(false);
      dispatch({ type: 'RESET' });
      setBasinLayersVisible(watershed, 'subbasin-l1');
      setSelectedDate('');
      const dates = await fetch(`${API}/basin/dates?model=${model}&mb_code=${mbCode}`).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const latest = vd[vd.length - 1] ?? '';
      setAvailableDates(vd);
      if (latest) { setSelectedDate(latest); fetchBasinData(latest, 'subbasin-l1', mode, model, mbCode); }
    } else {
      setBasinLayersVisible(null, null); setAdminLayersVisible(true);
      const dates = await fetch(`${API}/forecast/dates?model=${model}&mb_code=${mbCode}&start=2020-01-01&end=2030-12-31`).then(r => r.json());
      const vd = Array.isArray(dates) ? dates : [];
      const latest = vd[vd.length - 1] ?? '';
      setAvailableDates(vd);
      if (latest) { setSelectedDate(latest); const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(latest, activeLevel, mode, p, model); }
    }
  };

  // ── Date select ─────────────────────────────────────────────────────────────
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (viewMode === 'basin') fetchBasinData(date, basinLevel, mode, model, mbCode);
    else { const p = activeLevel !== 'province' ? selectedProvince : ''; fetchData(date, activeLevel, mode, p, model); }
  };

  // ── Mode select ─────────────────────────────────────────────────────────────
  const handleModeChange = (md: string) => setMode(md as Mode);

  // ── Basin navigation ────────────────────────────────────────────────────────
  const handleWatershedClick = useCallback(() => {
    dispatch({ type: 'DRILL_TO_L1' });
    mapRef.current?.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode);
  }, [selectedDate, mode, model, mbCode, watershed, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrillToL1 = useCallback(() => {
    dispatch({ type: 'DRILL_TO_L1' });
    mapRef.current?.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode);
  }, [selectedDate, mode, model, mbCode, watershed, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectL1 = useCallback((sbCode: string) => {
    dispatch({ type: 'SELECT_L1', sbCode });
    const bbox = l1BboxRef.current[watershed]?.[sbCode];
    if (bbox && mapRef.current)
      mapRef.current.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
  }, [watershed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectL2 = useCallback((subbasinId: string) => { dispatch({ type: 'SELECT_L2', subbasinId }); }, []);
  const handleDrillToL2 = () => { dispatch({ type: 'DRILL_L2' }); if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode); };
  const handleDrillToL2FromWatershed = () => { dispatch({ type: 'DRILL_L2_FROM_WATERSHED' }); if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode); };
  const handleDrillToL2FromL1 = useCallback((sbCode: string) => {
    if (!selectedDate) return;
    dispatch({ type: 'DRILL_L2_FROM_L1', sbCode });
    fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode);
  }, [selectedDate, mode, model, mbCode, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectL2FromPreview = useCallback((subbasinId: string) => {
    if (!selectedL1) return;
    dispatch({ type: 'SELECT_L2_FROM_PREVIEW', subbasinId });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode);
  }, [selectedL1, selectedDate, mode, model, mbCode, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBasinBack = useCallback(() => {
    const will = basinLevel === 'subbasin-l2' ? 'subbasin-l1' : basinLevel === 'subbasin-l1' ? 'watershed' : null;
    dispatch({ type: 'BACK' });
    if (will === 'subbasin-l1' && selectedDate) fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode);
    else if (will === 'watershed' && selectedDate) fetchBasinData(selectedDate, 'watershed', mode, model, mbCode);
  }, [basinLevel, selectedDate, mode, model, mbCode, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBasinRowClick = useCallback((id: string) => {
    if (basinLevel === 'watershed') handleWatershedClick();
    else if (basinLevel === 'subbasin-l1') { if (id !== selectedL1) handleSelectL1(id); }
    else { if (id !== selectedL2) handleSelectL2(id); }
  }, [basinLevel, selectedL1, selectedL2, handleWatershedClick, handleSelectL1, handleSelectL2]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const rows = viewMode === 'basin' ? basinDetailData : detailData;
    const headers = ['ID', 'Name', 'Rainfall', 'WaterSupply', 'Reservoir', 'WaterDemand', 'WaterBalance', 'DroughtIndex', 'RunoffIndex'];
    const lines = [
      headers.join(','),
      ...rows.map((r: any) => [r.id ?? '', `"${r.name_th ?? r.name ?? ''}"`, r.rainfall ?? '', r.watersupply ?? '', r.reservoir ?? '', r.water_demand ?? '', r.water_balance ?? '', r.drought_index ?? '', r.runoff_index ?? ''].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `water-${selectedDate || 'all'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const swatHref = swatZipUrl(watershed, viewMode, activeLevel, basinLevel);

  // ── Map events ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (viewMode === 'basin') {
      const basinFillLayer =
        basinLevel === 'watershed'   ? 'basin-watershed-fill' :
        basinLevel === 'subbasin-l1' ? `${watershed}-l1-fill` :
                                       `${watershed}-l2-fill`;
      const lookupBasinVal = (id: string) => { const row = basinColorData.find(r => r.id === id); return row != null ? row.value : null; };
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
          if (sbCode === selectedL1 && ENABLE_L2) handleDrillToL2FromL1(sbCode); else handleSelectL1(sbCode);
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
    const lookupVal = (id: string) => { const row = colorData.find(r => r.id === id); return row != null ? row.value : null; };
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
        if (id === selectedAmphoe) handleDrillToTambon(); else handleAmphoeSelect(id);
      } else {
        const feat = map.queryRenderedFeatures(e.point, { layers: [fillLayer] });
        if (!feat.length) { handleTambonDeselect(); return; }
        const pcode = feat[0].properties?.[pcodeField] as string | undefined; if (!pcode) return;
        handleTambonSelect(stripTH(pcode));
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
    activeLevel, selectedProvince, selectedAmphoe, colorData, mode,
    handleProvinceSelect, handleAmphoeSelect, handleAmphoeDeselect,
    handleTambonSelect, handleTambonDeselect, handleDrillToTambon,
    handleWatershedClick, handleSelectL1, handleSelectL2, handleDrillToL2FromL1,
    selectedL1, handleBasinBack,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dropdown option lists ───────────────────────────────────────────────────
  const dateOptions = availableDates.map(d => ({ value: d, label: fmtDate(d) }));
  const modeOptions: { value: Mode; label: string }[] = [
    { value: 'drought',      label: t.mode.drought },
    { value: 'runoff',       label: t.mode.runoff },
    { value: 'waterbalance', label: t.mode.waterbalance },
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
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1a2e4a', lineHeight: 1.5 }}>
                {t.app.title}
              </div>
            </div>

            {/* Section label */}
            <div style={{
              background: P.sectionBg, padding: '5px 10px',
              fontSize: theme.fontSize.xs, fontWeight: 700, color: theme.color.textLabel,
              textTransform: 'uppercase', letterSpacing: 0.5,
              borderBottom: `1px solid ${P.sidebarBorder}`, flexShrink: 0,
            }}>
              ผลการวิเคราะห์
            </div>

            {/* Dropdowns: view-mode + model */}
            <div style={{
              padding: '8px 10px', flexShrink: 0,
              borderBottom: `1px solid ${P.sidebarBorder}`,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textLabel, marginBottom: 2 }}>
                ขอบเขตลุ่มน้ำ
              </div>
              <ProtoDropdown
                label={viewModeOptions.find(o => o.value === viewMode)?.label ?? viewMode}
                options={viewModeOptions}
                onSelect={v => handleViewModeChange(v as 'admin' | 'basin')}
                fullWidth
              />
              <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textLabel, marginTop: 4, marginBottom: 2 }}>
                {t.model.label}
              </div>
              <ProtoDropdown
                label={modelOptions.find(o => o.value === model)?.label ?? model}
                options={modelOptions}
                onSelect={v => handleModelChange(v as Model)}
                fullWidth
              />
            </div>

            {/* Basin / Province navigation */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
                  mode={mode} l2PreviewData={basinL2PreviewData}
                  onSelectBasin={() => handleWatershedClick()}
                  onSelectL1={handleSelectL1} onSelectL2={handleSelectL2}
                  onSelectL2Preview={handleSelectL2FromPreview}
                  onDrillL1={handleDrillToL1} onDrillL2={handleDrillToL2}
                  onDrillL2FromWatershed={handleDrillToL2FromWatershed}
                  onBack={handleBasinBack} enableL2={ENABLE_L2}
                />
              ) : (
                <ProvinceSelector
                  provinces={basinProvinceIds.current.size > 0 ? provinces.filter(p => basinProvinceIds.current.has(p.id)) : provinces}
                  selectedProvince={selectedProvince} selectedAmphoe={selectedAmphoe} selectedTambon={selectedTambon}
                  onSelect={handleProvinceSelect} onSelectAmphoe={handleAmphoeSelect}
                  onDeselectAmphoe={handleAmphoeDeselect} onSelectTambon={handleTambonSelect}
                  onDeselectTambon={handleTambonDeselect}
                  amphoeList={amphoeList} tambonList={tambonList} colorData={colorData} mode={mode}
                />
              )}
            </div>

            {/* Export buttons */}
            <div style={{
              padding: '8px 10px', flexShrink: 0,
              borderTop: `1px solid ${P.sidebarBorder}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textLabel, flex: 1 }}>
                ส่งออกข้อมูล
              </span>
              <IconBtn title="Export CSV"    icon="/csv.png" onClick={handleExportCsv} />
              <IconBtn title="Download SWAT" icon="/shp.png" href={swatHref} />
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
        <div className="proto-right">

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
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a2e4a' }}>
              {viewMode === 'basin' ? t.basinHeader[watershed] : t.app.title}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <ProtoDropdown
                label={selectedDate ? fmtDate(selectedDate) : '—'}
                options={dateOptions}
                onSelect={handleDateSelect}
                align="right"
              />
              <ProtoDropdown
                label={modeOptions.find(o => o.value === mode)?.label ?? mode}
                options={modeOptions}
                onSelect={handleModeChange}
                align="right"
              />
              <button
                onClick={() => setLocale(locale === 'en' ? 'th' : 'en')}
                style={{ padding: '4px 10px', border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, background: 'transparent', color: theme.color.textMuted, cursor: 'pointer', fontSize: theme.fontSize.xs }}
              >{locale === 'en' ? 'ภาษาไทย' : 'English'}</button>
            </div>
          </div>

          {/* Map + Table */}
          <div className="proto-map-row">

            {/* ── Map column ───────────────────────────────────────────────── */}
            <div className="fc-map-column">
              <div className="fc-map-area">
                <div ref={mapContainer} style={{ width: '100%', height: '100%' }} onMouseLeave={() => setTooltip(null)} />
                <OverlayToggle
                  overlayProvince={overlayProvince} overlayAmphoe={overlayAmphoe}
                  overlayRivers={overlayRivers} overlayHillshade={overlayHillshade}
                  onToggleProvince={() => setOverlayProvince(v => !v)}
                  onToggleAmphoe={() => setOverlayAmphoe(v => !v)}
                  onToggleRivers={() => setOverlayRivers(v => !v)}
                  onToggleHillshade={() => setOverlayHillshade(v => !v)}
                  viewMode={viewMode}
                />
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
              <Legend mode={mode} />
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
                watershed={watershed} viewMode={viewMode} basinLevel={basinLevel} model={model}
              />
            </TablePanel>

          </div>{/* proto-map-row */}
        </div>{/* proto-right */}

      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(to right, ${P.footerFrom}, ${P.footerTo})`,
        color: '#fff', padding: '9px 18px', flexShrink: 0,
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
