'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

import ModelToggle from './components/ModelToggle';
import ModeButtons from './components/ModeButtons';
import ProvinceSelector from './components/ProvinceSelector';
import DateRangePicker from './components/DateRangePicker';
import SideTable from './components/SideTable';
import Legend from './components/Legend';

type Model = '7days' | '6months';
type Mode = 'drought' | 'runoff' | 'waterbalance';
type Level = 'province' | 'amphoe' | 'tambol';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ADM1_URL = process.env.NEXT_PUBLIC_PMTILES_ADM1_URL || '/thaimap/tha-province.pmtiles';
const ADM2_URL = process.env.NEXT_PUBLIC_PMTILES_ADM2_URL || '/thaimap/tha-amphoe.pmtiles';
const ADM3_URL = process.env.NEXT_PUBLIC_PMTILES_ADM3_URL || '/thaimap/tha-tambon.pmtiles';
const PROTOMAPS_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY || '';
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';
const DEFAULT_PROVINCE = '50'; // Chiang Mai

const DROUGHT_COLORS: Record<number, string> = { 0: '#2563eb', 1: '#fbbf24', 2: '#f97316', 3: '#dc2626' };
const RUNOFF_COLORS: Record<number, string> = { 0: '#2563eb', 1: '#fbbf24', 2: '#f97316', 3: '#dc2626' };

function valueToColor(value: number, mode: Mode): string {
  if (mode === 'drought') return DROUGHT_COLORS[value] ?? '#cccccc';
  if (mode === 'runoff') return RUNOFF_COLORS[value] ?? '#cccccc';
  if (mode === 'waterbalance') return value >= 0 ? '#2563eb' : '#dc2626';
  return '#cccccc';
}

function buildMatchExpr(data: { id: string; value: number }[], idField: string, mode: Mode): any[] {
  const expr: any[] = ['match', ['get', idField]];
  for (const row of data) {
    expr.push(`TH${row.id}`, valueToColor(row.value, mode));
  }
  expr.push('#cccccc');
  return expr;
}

export default function ForecastMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const bboxRef = useRef<Record<string, [number, number, number, number]>>({});
  const amphoeBboxRef = useRef<Record<string, [number, number, number, number]>>({});
  const initialized = useRef(false);

  const [model, setModel] = useState<Model>('7days');
  const [mode, setMode] = useState<Mode>('drought');
  const [activeLevel, setActiveLevel] = useState<Level>('province');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedAmphoe, setSelectedAmphoe] = useState('');
  const [selectedTambol, setSelectedTambol] = useState('');
  const [provinces, setProvinces] = useState<{ id: string; name: string }[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [colorData, setColorData] = useState<{ id: string; value: number }[]>([]);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [amphoeList, setAmphoeList] = useState<any[]>([]);
  const [tambolList, setTambolList] = useState<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Init map
  useEffect(() => {
    if (!mapContainer.current) return;
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.protomaps.com/styles/v5/light/en.json?key=${PROTOMAPS_KEY}`,
      center: [101, 13],
      zoom: 5,
      interactive: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      if (MAPTILER_KEY) {
        map.addSource('terrain', { type: 'raster-dem', url: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${MAPTILER_KEY}`, tileSize: 256 });
        map.addLayer({ id: 'hillshading', type: 'hillshade', source: 'terrain' } as any);
      }

      // ADM1 — provinces
      map.addSource('adm1', { type: 'vector', url: `pmtiles://${ADM1_URL}` });
      map.addLayer({ id: 'adm1-fill', type: 'fill', source: 'adm1', 'source-layer': 'admin1', paint: { 'fill-color': '#cccccc', 'fill-opacity': 0.5 } });
      map.addLayer({ id: 'adm1-line', type: 'line', source: 'adm1', 'source-layer': 'admin1', paint: { 'line-color': '#1e293b', 'line-width': 1.5 } });

      // ADM2 — amphoe
      map.addSource('adm2', { type: 'vector', url: `pmtiles://${ADM2_URL}` });
      map.addLayer({ id: 'adm2-fill', type: 'fill', source: 'adm2', 'source-layer': 'admin2', paint: { 'fill-color': '#cccccc', 'fill-opacity': 0 } });
      map.addLayer({ id: 'adm2-line', type: 'line', source: 'adm2', 'source-layer': 'admin2', paint: { 'line-color': '#475569', 'line-width': 1.5 }, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm2-highlight', type: 'line', source: 'adm2', 'source-layer': 'admin2', paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-gap-width': 0 }, layout: { visibility: 'none' } });

      // ADM3 — tambol
      map.addSource('adm3', { type: 'vector', url: `pmtiles://${ADM3_URL}` });
      map.addLayer({ id: 'adm3-fill', type: 'fill', source: 'adm3', 'source-layer': 'admin3', paint: { 'fill-color': '#cccccc', 'fill-opacity': 0 }, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm3-line', type: 'line', source: 'adm3', 'source-layer': 'admin3', paint: { 'line-color': '#333333', 'line-width': 1.2 }, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm3-highlight', type: 'line', source: 'adm3', 'source-layer': 'admin3', paint: { 'line-color': '#ffffff', 'line-width': 3 }, layout: { visibility: 'none' } });

      setMapReady(true);
    });

    fetch('/thailand-province-bbox.json').then(r => r.json()).then(data => { bboxRef.current = data; });
    fetch('/thailand-amphoe-bbox.json').then(r => r.json()).then(data => { amphoeBboxRef.current = data; });

    return () => { map.remove(); maplibregl.removeProtocol('pmtiles'); };
  }, []);

  // Load provinces list
  useEffect(() => {
    fetch(`${API}/forecast/provinces`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setProvinces(data));
  }, []);

  // Filter adm1-fill to only show selected province
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (selectedProvince && activeLevel === 'province') {
      map.setFilter('adm1-fill', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
    } else {
      map.setFilter('adm1-fill', null);
    }
  }, [selectedProvince, activeLevel, mapReady]);

  // Apply colors to map based on active level
  const applyColors = useCallback((data: { id: string; value: number }[], lvl: Level, md: Mode) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    map.setPaintProperty('adm1-fill', 'fill-opacity', 0);
    map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
    map.setPaintProperty('adm3-fill', 'fill-opacity', 0);

    if (lvl === 'province') {
      const expr = data.length > 0 ? buildMatchExpr(data, 'adm1_pcode', md) : '#cccccc';
      map.setPaintProperty('adm1-fill', 'fill-color', expr);
      map.setPaintProperty('adm1-fill', 'fill-opacity', 0.6);
    } else if (lvl === 'amphoe') {
      const expr = data.length > 0 ? buildMatchExpr(data, 'adm2_pcode', md) : '#cccccc';
      map.setPaintProperty('adm2-fill', 'fill-color', expr);
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0.6);
    } else if (lvl === 'tambol') {
      const expr = data.length > 0 ? buildMatchExpr(data, 'adm3_pcode', md) : '#cccccc';
      map.setPaintProperty('adm3-fill', 'fill-color', expr);
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0.6);
    }
  }, [mapReady]);

  // Fetch color + detail data for map and table
  const fetchData = useCallback(async (date: string, lvl: Level, md: Mode, provId: string, mdl: Model) => {
    if (!date) return;
    const params = new URLSearchParams({ date, mode: md, model: mdl });
    if (provId && lvl !== 'province') params.set('province_id', provId);

    const detailParams = new URLSearchParams({ date, model: mdl });
    if (provId && lvl !== 'province') detailParams.set('province_id', provId);

    const [color, detail] = await Promise.all([
      fetch(`${API}/forecast/${lvl}?${params}`).then(r => r.json()),
      fetch(`${API}/forecast/${lvl}/detail?${detailParams}`).then(r => r.json()),
    ]);

    const colorArr = Array.isArray(color) ? color : [];
    setColorData(colorArr);
    setDetailData(Array.isArray(detail) ? detail : []);
    applyColors(colorArr, lvl, md);
  }, [applyColors]);

  // Fetch amphoe + tambol sidebar lists for a province
  const fetchSidebarLists = useCallback(async (date: string, provId: string, mdl: Model) => {
    if (!date || !provId) return;
    const params = new URLSearchParams({ date, model: mdl, province_id: provId });
    const [amphoe, tambol] = await Promise.all([
      fetch(`${API}/forecast/amphoe/detail?${params}`).then(r => r.json()),
      fetch(`${API}/forecast/tambol/detail?${params}`).then(r => r.json()),
    ]);
    setAmphoeList(Array.isArray(amphoe) ? amphoe : []);
    setTambolList(Array.isArray(tambol) ? tambol : []);
  }, []);

  // Auto-init: ChiangMai + latest date
  useEffect(() => {
    if (!mapReady || provinces.length === 0 || initialized.current) return;
    initialized.current = true;

    const init = async () => {
      const dates = await fetch(`${API}/forecast/dates?model=7days&start=2020-01-01&end=2030-12-31`).then(r => r.json());
      if (!Array.isArray(dates) || dates.length === 0) return;

      const latestDate = dates[dates.length - 1];
      setAvailableDates(dates);
      setSelectedDate(latestDate);
      setSelectedProvince(DEFAULT_PROVINCE);
      setActiveLevel('province');

      const map = mapRef.current;
      if (map) {
        map.setLayoutProperty('adm2-line', 'visibility', 'none');
        const bbox = bboxRef.current[DEFAULT_PROVINCE];
        if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
      }

      await Promise.all([
        fetchData(latestDate, 'province', mode, '', model),
        fetchSidebarLists(latestDate, DEFAULT_PROVINCE, model),
      ]);
    };

    init();
  }, [mapReady, provinces]);

  // Re-apply colors when mode changes
  useEffect(() => {
    if (colorData.length > 0) applyColors(colorData, activeLevel, mode);
  }, [mode, applyColors]);

  // Re-fetch when model changes (after init)
  useEffect(() => {
    if (!initialized.current || !selectedDate) return;
    const provId = activeLevel !== 'province' ? selectedProvince : '';
    fetchData(selectedDate, activeLevel, mode, provId, model);
  }, [model]);

  // Province dropdown selected
  const handleProvinceSelect = useCallback((provId: string) => {
    setSelectedProvince(provId);
    setSelectedAmphoe('');
    setSelectedTambol('');
    setActiveLevel('province');
    const map = mapRef.current;
    if (!map) return;

    if (provId) {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      const bbox = bboxRef.current[provId];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
      if (selectedDate) {
        fetchData(selectedDate, 'province', mode, '', model);
        fetchSidebarLists(selectedDate, provId, model);
      }
    } else {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      setAmphoeList([]);
      setTambolList([]);
      map.flyTo({ center: [101, 13], zoom: 5, duration: 800 });
      if (selectedDate) fetchData(selectedDate, 'province', mode, '', model);
    }
  }, [selectedDate, mode, model, fetchData, fetchSidebarLists]);

  // Amphoe clicked in sidebar
  const handleAmphoeSelect = useCallback((amphoeId: string) => {
    setSelectedAmphoe(amphoeId);
    setSelectedTambol('');
    setActiveLevel('amphoe');
    const map = mapRef.current;
    if (map) {
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-fill', 'visibility', 'visible');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setFilter('adm2-highlight', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm3-fill', null);
      map.setFilter('adm3-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
      const bbox = bboxRef.current[String(selectedProvince)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
    }
    if (selectedDate) fetchData(selectedDate, 'amphoe', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, fetchData]);

  // Tambol clicked in sidebar
  const handleTambolSelect = useCallback((tambolId: string) => {
    setSelectedTambol(tambolId);
    setActiveLevel('tambol');
    // Derive amphoe from tambol ID (first 4 digits: 510603 → 5106)
    const amphoeId = tambolId.slice(0, 4);
    setSelectedAmphoe(amphoeId);
    const map = mapRef.current;
    if (map) {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'visible');
      map.setLayoutProperty('adm3-fill', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'visible');
      map.setFilter('adm2-highlight', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm3-fill', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm3-line', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm3-highlight', ['==', ['get', 'adm3_pcode'], `TH${tambolId}`]);
      const bbox = amphoeBboxRef.current[String(amphoeId)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
    }
    if (selectedDate) fetchData(selectedDate, 'tambol', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, fetchData]);

  // Date range search
  const handleDateSearch = async (start: string, end: string) => {
    const dates = await fetch(`${API}/forecast/dates?model=${model}&start=${start}&end=${end}`).then(r => r.json());
    setAvailableDates(Array.isArray(dates) ? dates : []);
    setSelectedDate('');
    setColorData([]);
    setDetailData([]);
    const map = mapRef.current;
    if (map && mapReady) {
      map.setPaintProperty('adm1-fill', 'fill-color', '#cccccc');
      map.setPaintProperty('adm1-fill', 'fill-opacity', 0.3);
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
    }
  };

  // Date selected from picker
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    const provId = activeLevel !== 'province' ? selectedProvince : '';
    fetchData(date, activeLevel, mode, provId, model);
    if (selectedProvince) fetchSidebarLists(date, selectedProvince, model);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif', fontSize: 13 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', background: '#1e293b', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginRight: 'auto' }}>Thailand Water Forecast</span>
        <ModelToggle model={model} onChange={m => { setModel(m); setAvailableDates([]); setSelectedDate(''); }} />
        <ModeButtons mode={mode} onChange={setMode} />
      </div>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left panel */}
        <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ProvinceSelector
            provinces={provinces}
            selectedProvince={selectedProvince}
            selectedAmphoe={selectedAmphoe}
            selectedTambol={selectedTambol}
            onSelect={handleProvinceSelect}
            onSelectAmphoe={handleAmphoeSelect}
            onSelectTambol={handleTambolSelect}
            amphoeList={amphoeList}
            tambolList={tambolList}
          />
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
          <Legend mode={mode} />
        </div>

      </div>

      {/* Date picker */}
      <DateRangePicker
        onSearch={handleDateSearch}
        availableDates={availableDates}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
      />

      {/* Side table */}
      <SideTable rows={detailData} activeLevel={activeLevel} />

    </div>
  );
}
