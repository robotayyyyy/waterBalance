'use client';

import { useEffect, useRef, useState, useCallback, useReducer } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './forecast.css';

import ModelToggle from './components/ModelToggle';
import ModeButtons from './components/ModeButtons';
import ProvinceSelector from './components/ProvinceSelector';
import DateRangePicker from './components/DateRangePicker';
import SideTable from './components/SideTable';
import TablePanel from './components/TablePanel';
import Legend from './components/Legend';
import ViewModeToggle from './components/ViewModeToggle';
import BasinSidebar from './components/BasinSidebar';
import OverlayToggle from './components/OverlayToggle';
import { useLang } from '../i18n/LangContext';
import type { Translations } from '../i18n/translations';

import { useMapInit } from './hooks/useMapInit';
import { theme, valueToColor } from './theme';
import { INIT_VIEW } from './hooks/useMapInit';
import type { Model, Mode, Level, Basin, BasinLevel } from './hooks/useMapInit';
import { useSelectionHandlers } from './hooks/useSelectionHandlers';
import { basinReducer, initialBasinState } from './basin/basinState';



const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ENABLE_L2 = process.env.NEXT_PUBLIC_ENABLE_SUBBASIN_L2 === 'true';
const DEFAULT_PROVINCE = '50'; // Chiang Mai

function tooltipLabel(value: number, mode: Mode, t: Translations): string {
  if (mode === 'drought') {
    const labels: Record<number, string> = {
      0: t.legend.normal, 1: t.legend.watch,
      2: t.legend.warning, 3: t.legend.critical,
    };
    return `${value} · ${labels[value] ?? String(value)}`;
  }
  if (mode === 'runoff') {
    const labels: Record<number, string> = {
      0: t.legend.normal, 1: t.legend.low,
      2: t.legend.high, 3: t.legend.extreme,
    };
    return `${value} · ${labels[value] ?? String(value)}`;
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(1)} · ${value >= 0 ? t.legend.surplus : t.legend.deficit}`;
}

export default function ForecastMap({ watershed }: { watershed: 'ping' | 'yom' }) {
  const { locale, t, setLocale } = useLang();
  const mbCode = watershed === 'ping' ? '06' : '08';

  const formatMonthDate = (d: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(d + 'T00:00:00'));

  const [model, setModel] = useState<Model>('6months');
  const [mode, setMode] = useState<Mode>('runoff');
  const [activeLevel, setActiveLevel] = useState<Level>('province');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedAmphoe, setSelectedAmphoe] = useState('');
  const [selectedTambon, setSelectedTambon] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [colorData, setColorData] = useState<{ id: string; value: number }[]>([]);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [amphoeList, setAmphoeList] = useState<any[]>([]);
  const [tambonList, setTambonList] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    name: string; name_th: string;
    value: number | null;
  } | null>(null);

  // Basin mode state
  const [viewMode, setViewMode] = useState<'admin' | 'basin'>('basin');
  const [basinState, dispatch] = useReducer(basinReducer, initialBasinState);
  const { basinLevel, selectedL1, selectedL2, l2FilterSbCode } = basinState;
  const [basinColorData, setBasinColorData] = useState<{ id: string; value: number }[]>([]);
  const [basinDetailData, setBasinDetailData] = useState<any[]>([]);
  const [basinL1DetailData, setBasinL1DetailData] = useState<any[]>([]); // persists when drilling to L2
  const [basinL2PreviewData, setBasinL2PreviewData] = useState<{ id: string; value: number }[]>([]);

  const [overlayProvince,   setOverlayProvince]   = useState(true);
  const [overlayAmphoe,     setOverlayAmphoe]     = useState(false);
  const [overlayRivers,     setOverlayRivers]     = useState(false);
  const [overlayHillshade,  setOverlayHillshade]  = useState(false);

  const initialized = useRef(false);
  const l2SbLookup = useRef<Record<string, Record<string, string>>>({});
  const l1BboxRef = useRef<Record<string, Record<string, [number, number, number, number]>>>({});

  useEffect(() => {
    Promise.all([
      fetch('/ping-l2-sb-lookup.json').then(r => r.json()),
      fetch('/yom-l2-sb-lookup.json').then(r => r.json()),
      fetch('/ping-l1-bbox.json').then(r => r.json()),
      fetch('/yom-l1-bbox.json').then(r => r.json()),
    ]).then(([pingLookup, yomLookup, pingBbox, yomBbox]) => {
      l2SbLookup.current = { ping: pingLookup, yom: yomLookup };
      l1BboxRef.current = { ping: pingBbox, yom: yomBbox };
    });
  }, []);

  const {
    mapRef, mapContainer, bboxRef, amphoeBboxRef, geoRef, mapReady, provinces,
    applyColors, applyBasinColors,
    setAdminLayersVisible, setBasinLayersVisible, setL1Highlight, setL2Highlight, setL2SbFilter, setWatershedHighlight,
    setHighlightColor, setOverlayVisible,
  } = useMapInit({ selectedProvince, selectedAmphoe, activeLevel, watershed });

  // Fetch color + detail data for map and table
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
    setColorData(colorArr);
    const detailArr = Array.isArray(detail) ? detail : [];
    if (geoRef.current) {
      const geoList = lvl === 'province' ? geoRef.current.provinces
        : lvl === 'amphoe' ? geoRef.current.amphoes
        : geoRef.current.tambons;
      const thMap = new Map(geoList.map(g => [g.id, g.name_th]));
      detailArr.forEach(r => { r.name_th = thMap.get(r.id) ?? r.name; });
    }
    setDetailData(detailArr);
    applyColors(colorArr, lvl, md);
  }, [mbCode, applyColors]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBasinData = useCallback(async (
    date: string, lvl: BasinLevel, md: Mode, mdl: Model, mb: string,
  ) => {
    if (!date) return;
    const params = new URLSearchParams({ date, mode: md, model: mdl, mb_code: mb });
    const detailParams = new URLSearchParams({ date, model: mdl, mb_code: mb });

    const [color, detail] = await Promise.all([
      fetch(`${API}/basin/${lvl}?${params}`).then(r => r.json()),
      fetch(`${API}/basin/${lvl}/detail?${detailParams}`).then(r => r.json()),
    ]);
    const colorArr = Array.isArray(color) ? color : [];
    const detailArr = Array.isArray(detail) ? detail : [];
    setBasinColorData(colorArr);
    setBasinDetailData(detailArr);
    if (lvl === 'subbasin-l1') setBasinL1DetailData(detailArr);
    if (lvl === 'watershed') setBasinL1DetailData([]);
    applyBasinColors(colorArr, watershed, lvl, md);
  }, [watershed, applyBasinColors]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    updateTambonList, updateSidebarLists,
    handleProvinceSelect, handleAmphoeSelect, handleAmphoeDeselect,
    handleTambonDeselect, handleDrillToTambon, handleTambonSelect,
  } = useSelectionHandlers({
    mapRef, bboxRef, amphoeBboxRef, geoRef,
    selectedDate, mode, model, selectedProvince, selectedAmphoe,
    setSelectedProvince, setSelectedAmphoe, setSelectedTambon, setActiveLevel,
    setAmphoeList, setTambonList,
    fetchData, watershed,
  });

  const handleAdminRowClick = useCallback((id: string) => {
    if (activeLevel === 'province') {
      if (id === selectedProvince) return;
      handleProvinceSelect(id);
    } else if (activeLevel === 'amphoe') {
      if (id === selectedAmphoe) return;
      handleAmphoeSelect(id);
    } else {
      if (id === selectedTambon) return;
      handleTambonSelect(id);
    }
  }, [activeLevel, selectedProvince, selectedAmphoe, selectedTambon,
      handleProvinceSelect, handleAmphoeSelect, handleTambonSelect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-init: fetch basin dates and show watershed view
  useEffect(() => {
    if (!mapReady || provinces.length === 0 || initialized.current) return;
    initialized.current = true;

    const init = async () => {
      const dates = await fetch(`${API}/basin/dates?model=${model}&mb_code=${mbCode}`).then(r => r.json());
      if (!Array.isArray(dates) || dates.length === 0) return;

      const latestDate = dates[dates.length - 1];
      setAvailableDates(dates);
      setSelectedDate(latestDate);

      setAdminLayersVisible(false);
      fetchBasinData(latestDate, 'subbasin-l1', mode, model, mbCode);
    };

    init();
  }, [mapReady, provinces, updateSidebarLists]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch L2 preview data when an L1 is selected (without changing map state)
  useEffect(() => {
    if (!selectedL1 || !selectedDate || basinLevel !== 'subbasin-l1') {
      setBasinL2PreviewData([]);
      return;
    }
    const url = `${API}/basin/subbasin-l2?date=${selectedDate}&mode=${mode}&model=${model}&mb_code=${mbCode}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const arr: { id: string; value: number }[] = Array.isArray(data) ? data : [];
        const lookup = l2SbLookup.current[watershed] ?? {};
        const filtered = arr.filter(r => lookup[r.id] === selectedL1);
        setBasinL2PreviewData(filtered);
      });
  }, [selectedL1, selectedDate, mode, model, basinLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync basin map layers with basin state — single source of truth for all layer visibility/filters
  useEffect(() => {
    if (!mapReady || viewMode !== 'basin') return;
    setBasinLayersVisible(watershed, basinLevel);
    setWatershedHighlight(basinLevel === 'watershed' ? mbCode : null);
    setL1Highlight(watershed, basinLevel === 'subbasin-l1' ? selectedL1 : null);
    setL2Highlight(watershed, basinLevel === 'subbasin-l2' ? selectedL2 : null);
    setL2SbFilter(watershed, basinLevel === 'subbasin-l2' ? l2FilterSbCode : null);
  }, [basinLevel, selectedL1, selectedL2, l2FilterSbCode, mapReady, viewMode,
      setBasinLayersVisible, setWatershedHighlight, setL1Highlight, setL2Highlight, setL2SbFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when mode changes (after init)
  useEffect(() => {
    setHighlightColor(mode);
    if (!initialized.current || !selectedDate) return;
    if (viewMode === 'basin') {
      fetchBasinData(selectedDate, basinLevel, mode, model, mbCode);
    } else {
      const provId = activeLevel !== 'province' ? selectedProvince : '';
      fetchData(selectedDate, activeLevel, mode, provId, model);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync overlay layer visibility
  useEffect(() => {
    setOverlayVisible('adm1-overlay', overlayProvince);
    setOverlayVisible('adm2-overlay', overlayAmphoe);
    const riverVisible = overlayRivers;
    console.log('[rivers] overlayRivers:', overlayRivers, 'basinLevel:', basinLevel, 'viewMode:', viewMode, '→ riverVisible:', riverVisible);
    setOverlayVisible('ping-rivers', riverVisible && watershed === 'ping');
    setOverlayVisible('yom-rivers', riverVisible && watershed === 'yom');
    setOverlayVisible('hillshading', overlayHillshade);
  }, [overlayProvince, overlayAmphoe, overlayRivers, overlayHillshade, viewMode, basinLevel, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Model toggle: reload dates and auto-select latest
  const handleModelChange = async (m: Model) => {
    setModel(m);
    setAvailableDates([]);
    setSelectedDate('');
    if (viewMode === 'basin') {
      const dates = await fetch(`${API}/basin/dates?model=${m}&mb_code=${mbCode}`).then(r => r.json());
      const validDates = Array.isArray(dates) ? dates : [];
      const latest = validDates[validDates.length - 1] ?? '';
      setAvailableDates(validDates);
      if (latest) {
        setSelectedDate(latest);
        fetchBasinData(latest, basinLevel, mode, m, mbCode);
      }
    } else {
      const dates = await fetch(`${API}/forecast/dates?model=${m}&mb_code=${mbCode}&start=2020-01-01&end=2030-12-31`).then(r => r.json());
      const validDates = Array.isArray(dates) ? dates : [];
      const latest = validDates[validDates.length - 1] ?? '';
      setAvailableDates(validDates);
      if (latest) {
        setSelectedDate(latest);
        const provId = activeLevel !== 'province' ? selectedProvince : '';
        fetchData(latest, activeLevel, mode, provId, m);
      }
    }
  };

  // Switch view mode admin ↔ basin
  const handleViewModeChange = async (m: 'admin' | 'basin') => {
    setViewMode(m);
    if (!mapReady) return;
    if (m === 'basin') {
      mapRef.current?.setMinZoom(null);
      setAdminLayersVisible(false);
      dispatch({ type: 'RESET' });
      const dates = await fetch(`${API}/basin/dates?model=${model}&mb_code=${mbCode}`).then(r => r.json());
      const validDates = Array.isArray(dates) ? dates : [];
      const latest = validDates[validDates.length - 1] ?? '';
      setAvailableDates(validDates);
      if (latest) {
        setSelectedDate(latest);
        fetchBasinData(latest, 'subbasin-l1', mode, model, mbCode);
      }
    } else {
      setBasinLayersVisible(null, null);
      setAdminLayersVisible(true);
      const dates = await fetch(`${API}/forecast/dates?model=${model}&mb_code=${mbCode}&start=2020-01-01&end=2030-12-31`).then(r => r.json());
      const validDates = Array.isArray(dates) ? dates : [];
      const latest = validDates[validDates.length - 1] ?? '';
      setAvailableDates(validDates);
      if (latest) {
        setSelectedDate(latest);
        const provId = activeLevel !== 'province' ? selectedProvince : '';
        fetchData(latest, activeLevel, mode, provId, model);
      }
    }
  };

  // Date range search
  const handleDateSearch = async (start: string, end: string) => {
    const dates = await fetch(`${API}/forecast/dates?model=${model}&mb_code=${mbCode}&start=${start}&end=${end}`).then(r => r.json());
    const validDates = Array.isArray(dates) ? dates : [];
    const latest = validDates[validDates.length - 1] ?? '';
    setAvailableDates(validDates);
    setColorData([]);
    setDetailData([]);
    const map = mapRef.current;
    if (map && mapReady) {
      map.setPaintProperty('adm1-fill', 'fill-color', '#cccccc');
      map.setPaintProperty('adm1-fill', 'fill-opacity', 0.3);
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
    }
    if (latest) handleDateSelect(latest);
  };

  // Date selected from picker
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (viewMode === 'basin') {
      fetchBasinData(date, basinLevel, mode, model, mbCode);
    } else {
      const provId = activeLevel !== 'province' ? selectedProvince : '';
      fetchData(date, activeLevel, mode, provId, model);
    }
  };

  // Basin navigation — single click on watershed polygon drills to L1
  const handleWatershedClick = useCallback(() => {
    dispatch({ type: 'DRILL_TO_L1' });
    if (mapRef.current) mapRef.current.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode);
  }, [selectedDate, mode, model, mbCode, watershed, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrillToL1 = useCallback(() => {
    dispatch({ type: 'DRILL_TO_L1' });
    if (mapRef.current) mapRef.current.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode);
  }, [selectedDate, mode, model, mbCode, watershed, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectL1 = useCallback((sbCode: string) => {
    dispatch({ type: 'SELECT_L1', sbCode });
    const bbox = l1BboxRef.current[watershed]?.[sbCode];
    if (bbox && mapRef.current) {
      mapRef.current.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
    }
  }, [watershed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectL2 = useCallback((subbasinId: string) => {
    dispatch({ type: 'SELECT_L2', subbasinId });
  }, []);

  const handleDrillToL2 = () => {
    dispatch({ type: 'DRILL_L2' });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode);
  };

  const handleDrillToL2FromWatershed = () => {
    dispatch({ type: 'DRILL_L2_FROM_WATERSHED' });
    if (selectedDate) fetchBasinData(selectedDate, 'subbasin-l2', mode, model, mbCode);
  };

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
    const willBeLevel = basinLevel === 'subbasin-l2' ? 'subbasin-l1'
                      : basinLevel === 'subbasin-l1' ? 'watershed'
                      : null;
    dispatch({ type: 'BACK' });
    if (willBeLevel === 'subbasin-l1' && selectedDate) {
      fetchBasinData(selectedDate, 'subbasin-l1', mode, model, mbCode);
    } else if (willBeLevel === 'watershed' && selectedDate) {
      fetchBasinData(selectedDate, 'watershed', mode, model, mbCode);
    }
  }, [basinLevel, selectedDate, mode, model, mbCode, fetchBasinData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBasinRowClick = useCallback((id: string) => {
    if (basinLevel === 'watershed') {
      handleWatershedClick();
    } else if (basinLevel === 'subbasin-l1') {
      if (id === selectedL1) return;
      handleSelectL1(id);
    } else {
      if (id === selectedL2) return;
      handleSelectL2(id);
    }
  }, [basinLevel, selectedL1, selectedL2,
      handleWatershedClick, handleSelectL1, handleSelectL2]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map interaction: hover tooltip + click-to-select + drill
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // ── Basin mode ──────────────────────────────────────────────────────────
    if (viewMode === 'basin') {
      const basinFillLayer =
        basinLevel === 'watershed'   ? 'basin-watershed-fill' :
        basinLevel === 'subbasin-l1' ? `${watershed}-l1-fill` :
                                       `${watershed}-l2-fill`;

      const lookupBasinValue = (id: string): number | null => {
        const row = basinColorData.find(r => r.id === id);
        return row != null ? row.value : null;
      };

      const lookupBasinGeo = (props: Record<string, any>): { name: string; name_th: string } => {
        if (basinLevel === 'watershed') {
          return { name: props.MBASIN_E ?? props.MB_CODE ?? '', name_th: props.MBASIN_T ?? props.MB_CODE ?? '' };
        }
        if (basinLevel === 'subbasin-l1') {
          const row = basinDetailData.find(r => r.id === props.SB_CODE);
          const name = row?.name ?? props.SB_CODE ?? '';
          return { name, name_th: name };
        }
        const id = String(props.Subbasin ?? '');
        return { name: `Sub-basin #${id}`, name_th: `Sub-basin #${id}` };
      };

      const onMouseMove = (e: maplibregl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [basinFillLayer] });
        if (!features.length) { setTooltip(null); return; }
        const props = features[0].properties ?? {};
        const id =
          basinLevel === 'watershed'   ? String(props.MB_CODE ?? '') :
          basinLevel === 'subbasin-l1' ? String(props.SB_CODE ?? '') :
                                         String(props.Subbasin ?? '');
        if (!id) { setTooltip(null); return; }
        setTooltip({
          x: e.originalEvent.offsetX,
          y: e.originalEvent.offsetY,
          ...lookupBasinGeo(props),
          value: lookupBasinValue(id),
        });
      };

      const onMouseLeave = () => setTooltip(null);
      const setCursor = () => { map.getCanvas().style.cursor = 'pointer'; };
      const resetCursor = () => { map.getCanvas().style.cursor = ''; };

      const onClickBasin = (e: maplibregl.MapMouseEvent) => {
        if (basinLevel === 'watershed') {
          const features = map.queryRenderedFeatures(e.point, { layers: ['basin-watershed-hit'] });
          if (!features.length) return;
          handleWatershedClick();
        } else if (basinLevel === 'subbasin-l1') {
          const layerId = `${watershed}-l1-fill`;
          const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
          if (!features.length) { handleBasinBack(); return; }
          const sbCode = String(features[0].properties?.SB_CODE ?? '');
          if (!sbCode) return;
          if (sbCode === selectedL1 && ENABLE_L2) {
            handleDrillToL2FromL1(sbCode);
          } else {
            handleSelectL1(sbCode);
          }
        } else if (basinLevel === 'subbasin-l2') {
          const layerId = `${watershed}-l2-fill`;
          const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
          if (!features.length) { handleBasinBack(); return; }
          const subbasinId = String(features[0].properties?.Subbasin ?? '');
          if (subbasinId) handleSelectL2(subbasinId);
        }
      };

      map.on('mousemove', onMouseMove);
      map.on('mouseleave', basinFillLayer, onMouseLeave);
      map.on('mousemove', basinFillLayer, setCursor);
      map.on('mouseleave', basinFillLayer, resetCursor);
      map.on('click', onClickBasin);

      return () => {
        map.off('mousemove', onMouseMove);
        map.off('mouseleave', basinFillLayer, onMouseLeave);
        map.off('mousemove', basinFillLayer, setCursor);
        map.off('mouseleave', basinFillLayer, resetCursor);
        map.off('click', onClickBasin);
      };
    }

    // ── Admin mode ───────────────────────────────────────────────────────────
    const fillLayer =
      activeLevel === 'province' ? 'adm1-fill' :
      activeLevel === 'amphoe'   ? 'adm2-fill' : 'adm3-fill';
    const pcodeField =
      activeLevel === 'province' ? 'adm1_pcode' :
      activeLevel === 'amphoe'   ? 'adm2_pcode' : 'adm3_pcode';

    const stripTH = (p: string) => p.startsWith('TH') ? p.slice(2) : p;

    const lookupValue = (id: string): number | null => {
      const row = colorData.find(r => r.id === id);
      return row != null ? row.value : null;
    };

    const lookupGeo = (id: string) => {
      if (!geoRef.current) return { name: id, name_th: id };
      const list =
        activeLevel === 'province' ? geoRef.current.provinces :
        activeLevel === 'amphoe'   ? geoRef.current.amphoes :
                                     geoRef.current.tambons;
      const found = list.find(g => g.id === id);
      return found ? { name: found.name, name_th: found.name_th } : { name: id, name_th: id };
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [fillLayer] });
      if (!features.length) { setTooltip(null); return; }
      const pcode = features[0].properties?.[pcodeField] as string | undefined;
      if (!pcode) { setTooltip(null); return; }
      const id = stripTH(pcode);
      setTooltip({ x: e.originalEvent.offsetX, y: e.originalEvent.offsetY, ...lookupGeo(id), value: lookupValue(id) });
    };

    const onMouseLeave = () => setTooltip(null);
    const setCursor = () => { map.getCanvas().style.cursor = 'pointer'; };
    const resetCursor = () => { map.getCanvas().style.cursor = ''; };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (activeLevel === 'province') {
        const features = map.queryRenderedFeatures(e.point, { layers: ['adm1-hit'] });
        if (!features.length) { if (selectedProvince) handleProvinceSelect(''); return; }
        const pcode = features[0].properties?.adm1_pcode as string | undefined;
        if (!pcode) return;
        const id = stripTH(pcode);
        if (id === selectedProvince) {
          handleAmphoeSelect('');
        } else {
          handleProvinceSelect(id);
        }
      } else if (activeLevel === 'amphoe') {
        const features = map.queryRenderedFeatures(e.point, { layers: [fillLayer] });
        if (!features.length) { handleAmphoeDeselect(); return; }
        const pcode = features[0].properties?.[pcodeField] as string | undefined;
        if (!pcode) return;
        const id = stripTH(pcode);
        if (id === selectedAmphoe) {
          handleDrillToTambon();
        } else {
          handleAmphoeSelect(id);
        }
      } else {
        const features = map.queryRenderedFeatures(e.point, { layers: [fillLayer] });
        if (!features.length) { handleTambonDeselect(); return; }
        const pcode = features[0].properties?.[pcodeField] as string | undefined;
        if (!pcode) return;
        handleTambonSelect(stripTH(pcode));
      }
    };

    map.on('mousemove', onMouseMove);
    map.on('mouseleave', fillLayer, onMouseLeave);
    map.on('mousemove', fillLayer, setCursor);
    map.on('mouseleave', fillLayer, resetCursor);
    map.on('click', onClick);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseleave', fillLayer, onMouseLeave);
      map.off('mousemove', fillLayer, setCursor);
      map.off('mouseleave', fillLayer, resetCursor);
      map.off('click', onClick);
    };
  }, [
    mapReady, viewMode, basinLevel, basinColorData, basinDetailData,
    activeLevel, selectedProvince, selectedAmphoe,
    colorData, mode,
    handleProvinceSelect, handleAmphoeSelect, handleAmphoeDeselect,
    handleTambonSelect, handleTambonDeselect, handleDrillToTambon,
    handleWatershedClick, handleSelectL1, handleSelectL2, handleDrillToL2FromL1,
    selectedL1, handleBasinBack,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const logoStyle: React.CSSProperties = { height: 28, width: 'auto' };

  return (
    <div className="fc-layout" style={{ fontFamily: 'sans-serif', fontSize: 13 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: theme.color.headerBg, flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          className="fc-menu-btn"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle sidebar"
          style={{ color: theme.color.textMuted, fontSize: theme.fontSize.nav }}
        >☰</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hii.png" alt="HII" style={logoStyle} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cmu.svg" alt="CMU" style={logoStyle} />
        <span style={{ color: theme.color.textOnDark, fontWeight: 600, fontSize: theme.fontSize.lg, marginRight: 'auto' }}>
          {t.app.title}
          {viewMode === 'basin' && (
            <span style={{ fontWeight: 400, opacity: 0.7 }}> — {t.basinHeader[watershed]}</span>
          )}
        </span>
        <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />
        <ModelToggle model={model} onChange={handleModelChange} />
        <ModeButtons mode={mode} onChange={setMode} />
        <button
          onClick={() => setLocale(locale === 'en' ? 'th' : 'en')}
          style={{ padding: '4px 10px', border: `1px solid ${theme.color.textBody}`, borderRadius: theme.radius.md, background: 'transparent', color: theme.color.textMuted, cursor: 'pointer', fontSize: theme.fontSize.xs, flexShrink: 0 }}
        >{locale === 'en' ? 'ภาษาไทย' : 'English'}</button>
      </div>

      {/* Mobile sidebar overlay */}
      <div
        className={`fc-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main */}
      <div className="fc-main">

        {/* Left sidebar */}
        <div
          className={`fc-sidebar${sidebarOpen ? ' open' : ''}`}
          style={{
            background: theme.color.pageBg,
            borderRight: `1px solid ${theme.color.border}`,
            width: sidebarCollapsed ? theme.sidebar.collapsedWidth : theme.sidebar.width,
            transition: 'width 0.2s ease',
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          {/* Sidebar content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {viewMode === 'basin' ? (
              <BasinSidebar
                basinLevel={basinLevel}
                selectedBasin={watershed}
                selectedL1={selectedL1}
                selectedL2={selectedL2}
                l2FilterSbCode={l2FilterSbCode}
                colorData={basinColorData}
                l1DetailData={basinL1DetailData}
                detailData={
                  l2FilterSbCode && basinLevel === 'subbasin-l2'
                    ? basinDetailData.filter(r => l2SbLookup.current[watershed]?.[r.id] === l2FilterSbCode)
                    : basinDetailData
                }
                mode={mode}
                l2PreviewData={basinL2PreviewData}
                onSelectBasin={() => handleWatershedClick()}
                onSelectL1={handleSelectL1}
                onSelectL2={handleSelectL2}
                onSelectL2Preview={handleSelectL2FromPreview}
                onDrillL1={handleDrillToL1}
                onDrillL2={handleDrillToL2}
                onDrillL2FromWatershed={handleDrillToL2FromWatershed}
                onBack={handleBasinBack}
                enableL2={ENABLE_L2}
              />
            ) : (
              <ProvinceSelector
                provinces={provinces}
                selectedProvince={selectedProvince}
                selectedAmphoe={selectedAmphoe}
                selectedTambon={selectedTambon}
                onSelect={handleProvinceSelect}
                onSelectAmphoe={handleAmphoeSelect}
                onDeselectAmphoe={handleAmphoeDeselect}
                onSelectTambon={handleTambonSelect}
                onDeselectTambon={handleTambonDeselect}
                amphoeList={amphoeList}
                tambonList={tambonList}
                colorData={colorData}
                mode={mode}
              />
            )}
          </div>
          {/* Collapse toggle — desktop only */}
          <button
            className="fc-sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            style={{
              width: theme.sidebar.collapsedWidth,
              flexShrink: 0,
              border: 'none',
              borderLeft: `1px solid ${theme.color.border}`,
              background: theme.color.surfaceBg,
              cursor: 'pointer',
              color: theme.color.textLabel,
              fontSize: theme.fontSize.base,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Map column: map + date picker stacked */}
        <div className="fc-map-column">
          <div className="fc-map-area">
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} onMouseLeave={() => setTooltip(null)} />
            <OverlayToggle
              overlayProvince={overlayProvince}
              overlayAmphoe={overlayAmphoe}
              overlayRivers={overlayRivers}
              overlayHillshade={overlayHillshade}
              onToggleProvince={() => setOverlayProvince(v => !v)}
              onToggleAmphoe={() => setOverlayAmphoe(v => !v)}
              onToggleRivers={() => setOverlayRivers(v => !v)}
              onToggleHillshade={() => setOverlayHillshade(v => !v)}
              viewMode={viewMode}
            />
            {tooltip && (
              <div style={{
                position: 'absolute',
                left: tooltip.x + 14,
                top: tooltip.y - 10,
                pointerEvents: 'none',
                background: 'rgba(255,255,255,0.97)',
                border: `1px solid ${theme.color.border}`,
                borderRadius: theme.radius.lg,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                padding: '7px 11px',
                fontSize: theme.fontSize.sm,
                zIndex: 20,
                whiteSpace: 'nowrap',
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
          <DateRangePicker
            onSearch={handleDateSearch}
            availableDates={availableDates}
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
            formatDate={model === '6months' ? formatMonthDate : undefined}
          />
        </div>

        {/* Table panel */}
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
                ? basinLevel === 'watershed'
                    ? mbCode
                    : basinLevel === 'subbasin-l1'
                        ? (selectedL1 ?? undefined)
                        : (selectedL2 ?? undefined)
                : activeLevel === 'province' ? selectedProvince
                : activeLevel === 'amphoe'   ? selectedAmphoe
                : selectedTambon
            }
            onRowClick={viewMode === 'basin' ? handleBasinRowClick : handleAdminRowClick}
            watershed={watershed}
            viewMode={viewMode}
            basinLevel={basinLevel}
            model={model}
          />
        </TablePanel>

      </div>

    </div>
  );
}
