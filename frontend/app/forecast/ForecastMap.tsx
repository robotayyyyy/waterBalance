'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import './forecast.css';

import ModelToggle from './components/ModelToggle';
import ModeButtons from './components/ModeButtons';
import ProvinceSelector from './components/ProvinceSelector';
import DateRangePicker from './components/DateRangePicker';
import SideTable from './components/SideTable';
import TablePanel from './components/TablePanel';
import Legend from './components/Legend';

type Model = '7days' | '6months';
type Mode = 'drought' | 'runoff' | 'waterbalance';
type Level = 'province' | 'amphoe' | 'tambon';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ADM1_URL = process.env.NEXT_PUBLIC_PMTILES_ADM1_URL || '/thaimap/tha-province.pmtiles';
const ADM2_URL = process.env.NEXT_PUBLIC_PMTILES_ADM2_URL || '/thaimap/tha-amphoe.pmtiles';
const ADM3_URL = process.env.NEXT_PUBLIC_PMTILES_ADM3_URL || '/thaimap/tha-tambon.pmtiles';
const PROTOMAPS_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY || '';
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';
const DEFAULT_PROVINCE = '50'; // Chiang Mai

const DROUGHT_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#feff73', 2: '#ffaa01', 3: '#fe0000' };
const RUNOFF_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#bee8ff', 2: '#01c5ff', 3: '#005be7' };

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
  const geoRef = useRef<{
    provinces: { id: string; name: string }[];
    amphoes: { id: string; name: string; province_id: string }[];
    tambons: { id: string; name: string; amphoe_id: string }[];
  } | null>(null);

  const [model, setModel] = useState<Model>('7days');
  const [mode, setMode] = useState<Mode>('drought');
  const [activeLevel, setActiveLevel] = useState<Level>('province');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedAmphoe, setSelectedAmphoe] = useState('');
  const [selectedTambon, setSelectedTambon] = useState('');
  const [provinces, setProvinces] = useState<{ id: string; name: string }[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [colorData, setColorData] = useState<{ id: string; value: number }[]>([]);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [amphoeList, setAmphoeList] = useState<any[]>([]);
  const [tambonList, setTambonList] = useState<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      map.addLayer({ id: 'adm2-highlight', type: 'line', source: 'adm2', 'source-layer': 'admin2', paint: { 'line-color': '#ffffff', 'line-width': 5 }, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm2-highlight-inner', type: 'line', source: 'adm2', 'source-layer': 'admin2', paint: { 'line-color': '#10b981', 'line-width': 2 }, layout: { visibility: 'none' } });

      // ADM3 — tambon
      map.addSource('adm3', { type: 'vector', url: `pmtiles://${ADM3_URL}` });
      map.addLayer({ id: 'adm3-fill', type: 'fill', source: 'adm3', 'source-layer': 'admin3', paint: { 'fill-color': '#cccccc', 'fill-opacity': 0 }, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm3-line', type: 'line', source: 'adm3', 'source-layer': 'admin3', paint: { 'line-color': '#333333', 'line-width': 1.2 }, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm3-highlight', type: 'line', source: 'adm3', 'source-layer': 'admin3', paint: { 'line-color': '#ffffff', 'line-width': 5 }, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm3-highlight-inner', type: 'line', source: 'adm3', 'source-layer': 'admin3', paint: { 'line-color': '#10b981', 'line-width': 2 }, layout: { visibility: 'none' } });

      setMapReady(true);
    });

    fetch('/thailand-province-bbox.json').then(r => r.json()).then(data => { bboxRef.current = data; });
    fetch('/thailand-amphoe-bbox.json').then(r => r.json()).then(data => { amphoeBboxRef.current = data; });

    return () => { map.remove(); maplibregl.removeProtocol('pmtiles'); };
  }, []);

  // Load static geographic metadata
  useEffect(() => {
    fetch('/thailand-geo.json')
      .then(r => r.json())
      .then(data => {
        geoRef.current = data;
        setProvinces(data.provinces);
      });
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

  // Filter adm2-fill to the selected province (hides amphoe fill outside province)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (selectedProvince && activeLevel === 'amphoe') {
      map.setFilter('adm2-fill', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
    } else {
      map.setFilter('adm2-fill', null);
    }
  }, [selectedProvince, activeLevel, mapReady]);

  // Filter adm3-fill to the selected amphoe (hides tambon fill outside amphoe)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (selectedAmphoe && activeLevel === 'tambon') {
      map.setFilter('adm3-fill', ['==', ['get', 'adm2_pcode'], `TH${selectedAmphoe}`]);
    } else {
      map.setFilter('adm3-fill', null);
    }
  }, [selectedAmphoe, activeLevel, mapReady]);

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
    } else if (lvl === 'tambon') {
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

  // Filter tambon list for selected amphoe
  const updateTambonList = useCallback((amphoeId: string) => {
    if (!geoRef.current || !amphoeId) { setTambonList([]); return; }
    setTambonList(geoRef.current.tambons.filter(t => t.amphoe_id === amphoeId));
  }, []);

  // Filter amphoe list for selected province, auto-select first amphoe
  const updateSidebarLists = useCallback((provId: string) => {
    if (!geoRef.current || !provId) {
      setAmphoeList([]);
      setTambonList([]);
      setSelectedAmphoe('');
      return;
    }
    const amphoes = geoRef.current.amphoes.filter(a => a.province_id === provId);
    setAmphoeList(amphoes);
    const first = amphoes[0];
    if (first) {
      setSelectedAmphoe(first.id);
      setTambonList(geoRef.current.tambons.filter(t => t.amphoe_id === first.id));
    } else {
      setSelectedAmphoe('');
      setTambonList([]);
    }
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

      updateSidebarLists(DEFAULT_PROVINCE);
      await fetchData(latestDate, 'province', mode, '', model);
    };

    init();
  }, [mapReady, provinces, updateSidebarLists]);

  // Re-fetch when mode changes (after init)
  useEffect(() => {
    if (!initialized.current || !selectedDate) return;
    const provId = activeLevel !== 'province' ? selectedProvince : '';
    fetchData(selectedDate, activeLevel, mode, provId, model);
  }, [mode]);

  // Re-fetch when model changes (after init)
  useEffect(() => {
    if (!initialized.current || !selectedDate) return;
    const provId = activeLevel !== 'province' ? selectedProvince : '';
    fetchData(selectedDate, activeLevel, mode, provId, model);
  }, [model]);

  // Province dropdown selected
  const handleProvinceSelect = useCallback((provId: string) => {
    setSelectedProvince(provId);
    setSelectedTambon('');
    setActiveLevel('province');
    const map = mapRef.current;
    if (!map) return;

    if (provId) {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      const bbox = bboxRef.current[provId];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
      updateSidebarLists(provId);
      if (selectedDate) fetchData(selectedDate, 'province', mode, '', model);
    } else {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setPaintProperty('adm1-fill', 'fill-color', '#cccccc');
      map.setPaintProperty('adm1-fill', 'fill-opacity', 0.5);
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
      updateSidebarLists('');
      map.fitBounds([[97.34, 5.61], [105.64, 20.47]], { padding: 40, duration: 800 });
      if (selectedDate) fetchData(selectedDate, 'province', mode, '', model);
    }
  }, [selectedDate, mode, model, fetchData, updateSidebarLists]);

  // Amphoe clicked in sidebar
  const handleAmphoeSelect = useCallback((amphoeId: string) => {
    setSelectedAmphoe(amphoeId);
    setSelectedTambon('');
    setActiveLevel('amphoe');
    const map = mapRef.current;
    if (map) {
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-fill', 'visibility', 'visible');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'visible');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setFilter('adm2-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
      map.setFilter('adm2-highlight', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm2-highlight-inner', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm3-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
      const bbox = bboxRef.current[String(selectedProvince)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
    }
    updateTambonList(amphoeId);
    if (selectedDate) fetchData(selectedDate, 'amphoe', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, fetchData, updateTambonList]);

  // Amphoe deselected (× button)
  const handleAmphoeDeselect = useCallback(() => {
    setSelectedAmphoe('');
    setSelectedTambon('');
    setActiveLevel('province');
    setTambonList([]);
    const map = mapRef.current;
    if (map) {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
      const bbox = bboxRef.current[String(selectedProvince)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
    }
    if (selectedDate) fetchData(selectedDate, 'province', mode, '', model);
  }, [selectedDate, mode, model, selectedProvince, fetchData]);

  // Tambol deselected (× button)
  const handleTambonDeselect = useCallback(() => {
    setSelectedTambon('');
    setActiveLevel('amphoe');
    const map = mapRef.current;
    if (map) {
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
      map.setFilter('adm2-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
      map.setFilter('adm3-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
      const bbox = bboxRef.current[String(selectedProvince)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
    }
    if (selectedDate) fetchData(selectedDate, 'amphoe', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, fetchData]);

  // Tambol clicked in sidebar
  const handleTambonSelect = useCallback((tambonId: string) => {
    setSelectedTambon(tambonId);
    setActiveLevel('tambon');
    // Derive amphoe from tambon ID (first 4 digits: 510603 → 5106)
    const amphoeId = tambonId.slice(0, 4);
    setSelectedAmphoe(amphoeId);
    const map = mapRef.current;
    if (map) {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'visible');
      map.setFilter('adm3-line', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm3-highlight', ['==', ['get', 'adm3_pcode'], `TH${tambonId}`]);
      map.setFilter('adm3-highlight-inner', ['==', ['get', 'adm3_pcode'], `TH${tambonId}`]);
      const bbox = amphoeBboxRef.current[String(amphoeId)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
    }
    if (selectedDate) fetchData(selectedDate, 'tambon', mode, selectedProvince, model);
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
  };

  return (
    <div className="fc-layout" style={{ fontFamily: 'sans-serif', fontSize: 13 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: '#1e293b', flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          className="fc-menu-btn"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle sidebar"
          style={{ color: '#94a3b8', fontSize: 20 }}
        >☰</button>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginRight: 'auto' }}>Thailand Water Forecast</span>
        <ModelToggle model={model} onChange={m => { setModel(m); setAvailableDates([]); setSelectedDate(''); }} />
        <ModeButtons mode={mode} onChange={setMode} />
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
            background: '#fff',
            borderRight: '1px solid #e2e8f0',
            width: sidebarCollapsed ? 32 : 220,
            transition: 'width 0.2s ease',
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          {/* Sidebar content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
            />
          </div>
          {/* Collapse toggle — desktop only */}
          <button
            className="fc-sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            style={{
              width: 32,
              flexShrink: 0,
              border: 'none',
              borderLeft: '1px solid #e2e8f0',
              background: '#f8fafc',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: 13,
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
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
            <Legend mode={mode} />
          </div>
          <DateRangePicker
            onSearch={handleDateSearch}
            availableDates={availableDates}
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
          />
        </div>

        {/* Table panel */}
        <TablePanel>
          <SideTable rows={detailData} activeLevel={activeLevel} />
        </TablePanel>

      </div>
    </div>
  );
}
