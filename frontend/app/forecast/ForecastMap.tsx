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

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ADM1_URL = process.env.NEXT_PUBLIC_PMTILES_ADM1_URL || '/thaimap/thailand-adm1.pmtiles';
const ADM2_URL = process.env.NEXT_PUBLIC_PMTILES_ADM2_URL || '/thaimap/thailand-adm2.pmtiles';
const ADM3_URL = process.env.NEXT_PUBLIC_PMTILES_ADM3_URL || '/thaimap/thailand-adm3.pmtiles';
const PROTOMAPS_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY || '';
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';

// Color helpers
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
    expr.push(row.id, valueToColor(row.value, mode));
  }
  expr.push('#cccccc');
  return expr;
}

export default function ForecastMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const bboxRef = useRef<Record<string, [number, number, number, number]>>({});

  const [model, setModel] = useState<Model>('7days');
  const [mode, setMode] = useState<Mode>('drought');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [provinces, setProvinces] = useState<{ id: string; name: string }[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [colorData, setColorData] = useState<{ id: string; value: number }[]>([]);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [amphoeList, setAmphoeList] = useState<any[]>([]);
  const [tambolList, setTambolList] = useState<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Active level: province when no province selected, amphoe when selected
  const activeLevel = selectedProvince ? 'amphoe' : 'province';

  // Init map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Register pmtiles protocol
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
      // Optional: Maptiler terrain
      if (MAPTILER_KEY) {
        map.addSource('terrain', {
          type: 'raster-dem',
          url: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${MAPTILER_KEY}`,
          tileSize: 256,
        });
        map.addLayer({ id: 'hillshading', type: 'hillshade', source: 'terrain' } as any);
      }

      // ADM1 source + layers
      map.addSource('adm1', { type: 'vector', url: `pmtiles://${ADM1_URL}` });
      map.addLayer({
        id: 'adm1-fill', type: 'fill', source: 'adm1', 'source-layer': 'gadm41_THA_1',
        paint: { 'fill-color': '#cccccc', 'fill-opacity': 0.5 },
      });
      map.addLayer({
        id: 'adm1-line', type: 'line', source: 'adm1', 'source-layer': 'gadm41_THA_1',
        paint: { 'line-color': '#1e293b', 'line-width': 1.5 },
      });

      // ADM2 source + layers
      map.addSource('adm2', { type: 'vector', url: `pmtiles://${ADM2_URL}` });
      map.addLayer({
        id: 'adm2-fill', type: 'fill', source: 'adm2', 'source-layer': 'gadm41_THA_2',
        paint: { 'fill-color': '#cccccc', 'fill-opacity': 0 },
      });
      map.addLayer({
        id: 'adm2-line', type: 'line', source: 'adm2', 'source-layer': 'gadm41_THA_2',
        paint: { 'line-color': '#475569', 'line-width': 0.8 },
        layout: { visibility: 'none' },
      });

      // ADM3 source + layers (boundary only, no fill color)
      map.addSource('adm3', { type: 'vector', url: `pmtiles://${ADM3_URL}` });
      map.addLayer({
        id: 'adm3-line', type: 'line', source: 'adm3', 'source-layer': 'gadm41_THA_3',
        paint: { 'line-color': '#94a3b8', 'line-width': 0.5 },
        layout: { visibility: 'none' },
      });

      setMapReady(true);
    });

    // Load province bboxes
    fetch('/thailand-province-bbox.json')
      .then(r => r.json())
      .then(data => { bboxRef.current = data; });

    return () => {
      map.remove();
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  // Load provinces on mount
  useEffect(() => {
    fetch(`${API}/forecast/provinces`)
      .then(r => r.json())
      .then(setProvinces);
  }, []);

  // Apply color data to map
  const applyColors = useCallback((data: { id: string; value: number }[], lvl: string, md: Mode) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (lvl === 'province') {
      const expr = data.length > 0 ? buildMatchExpr(data, 'CC_1', md) : '#cccccc';
      map.setPaintProperty('adm1-fill', 'fill-color', expr);
      map.setPaintProperty('adm1-fill', 'fill-opacity', 0.6);
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
    } else {
      // amphoe coloring
      const expr = data.length > 0 ? buildMatchExpr(data, 'CC_2', md) : '#cccccc';
      map.setPaintProperty('adm2-fill', 'fill-color', expr);
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0.6);
      map.setPaintProperty('adm1-fill', 'fill-opacity', 0); // hide province fill
    }
  }, [mapReady]);

  // Fetch color data and detail data
  const fetchData = useCallback(async (date: string, lvl: string, md: Mode, prov: string, mdl: Model) => {
    if (!date) return;
    const params = new URLSearchParams({ date, mode: md, model: mdl });
    if (prov && lvl !== 'province') params.set('province_id', prov);

    const [color, detail, amphoe, tambol] = await Promise.all([
      fetch(`${API}/forecast/${lvl}?${params}`).then(r => r.json()),
      fetch(`${API}/forecast/${lvl}/detail?${new URLSearchParams({ date, model: mdl, ...(prov && lvl !== 'province' ? { province_id: prov } : {}) })}`).then(r => r.json()),
      prov ? fetch(`${API}/forecast/amphoe/detail?${new URLSearchParams({ date, model: mdl, province_id: prov })}`).then(r => r.json()) : Promise.resolve([]),
      prov ? fetch(`${API}/forecast/tambol/detail?${new URLSearchParams({ date, model: mdl, province_id: prov })}`).then(r => r.json()) : Promise.resolve([]),
    ]);

    setColorData(color);
    setDetailData(detail);
    setAmphoeList(amphoe);
    setTambolList(tambol);
    applyColors(color, lvl, md);
  }, [applyColors]);

  // Re-apply colors when mode changes (no refetch needed)
  useEffect(() => {
    if (colorData.length > 0) {
      applyColors(colorData, activeLevel, mode);
    }
  }, [mode, applyColors]);

  // Re-fetch when date or model changes
  useEffect(() => {
    if (selectedDate) {
      fetchData(selectedDate, activeLevel, mode, selectedProvince, model);
    }
  }, [selectedDate, model]);

  // Province selection: fitBounds + show/hide layers + refetch
  const handleProvinceSelect = useCallback((provId: string) => {
    setSelectedProvince(provId);
    const map = mapRef.current;
    if (!map) return;

    if (provId) {
      // Show amphoe and tambol layers
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'visible');

      // Fit to province bounds
      const bbox = bboxRef.current[provId];
      if (bbox) {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
      }

      // Fetch amphoe level data
      if (selectedDate) {
        fetchData(selectedDate, 'amphoe', mode, provId, model);
      }
    } else {
      // Reset to full Thailand
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
      map.flyTo({ center: [101, 13], zoom: 5, duration: 800 });
      setAmphoeList([]);
      setTambolList([]);

      // Restore province coloring
      if (selectedDate) {
        fetchData(selectedDate, 'province', mode, '', model);
      }
    }
  }, [selectedDate, mode, model, fetchData]);

  // Date search
  const handleDateSearch = async (start: string, end: string) => {
    const dates = await fetch(`${API}/forecast/dates?model=${model}&start=${start}&end=${end}`)
      .then(r => r.json());
    setAvailableDates(dates);
    setSelectedDate('');
    setColorData([]);
    setDetailData([]);
    // Clear map colors
    const map = mapRef.current;
    if (map && mapReady) {
      map.setPaintProperty('adm1-fill', 'fill-color', '#cccccc');
      map.setPaintProperty('adm1-fill', 'fill-opacity', 0.3);
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
    }
  };

  // Date selection
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    fetchData(date, activeLevel, mode, selectedProvince, model);
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
            onSelect={handleProvinceSelect}
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
