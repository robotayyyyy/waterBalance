'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

export type Model = '7days' | '6months';
export type Mode = 'drought' | 'runoff' | 'waterbalance';
export type Level = 'province' | 'amphoe' | 'tambon';

export type GeoData = {
  provinces: { id: string; name: string; name_th: string }[];
  amphoes: { id: string; name: string; name_th: string; province_id: string }[];
  tambons: { id: string; name: string; name_th: string; amphoe_id: string }[];
};

const ADM1_URL = process.env.NEXT_PUBLIC_PMTILES_ADM1_URL || '/thaimap/tha-province.pmtiles';
const ADM2_URL = process.env.NEXT_PUBLIC_PMTILES_ADM2_URL || '/thaimap/tha-amphoe.pmtiles';
const ADM3_URL = process.env.NEXT_PUBLIC_PMTILES_ADM3_URL || '/thaimap/tha-tambon.pmtiles';
const PROTOMAPS_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY || '';
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';

const DROUGHT_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#feff73', 2: '#ffaa01', 3: '#fe0000' };
const RUNOFF_COLORS: Record<number, string> = { 0: '#ffffff', 1: '#bee8ff', 2: '#01c5ff', 3: '#005be7' };

export function valueToColor(value: number, mode: Mode): string {
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

interface UseMapInitParams {
  selectedProvince: string;
  selectedAmphoe: string;
  activeLevel: Level;
}

export function useMapInit({ selectedProvince, selectedAmphoe, activeLevel }: UseMapInitParams) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const bboxRef = useRef<Record<string, [number, number, number, number]>>({});
  const amphoeBboxRef = useRef<Record<string, [number, number, number, number]>>({});
  const geoRef = useRef<GeoData | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [provinces, setProvinces] = useState<{ id: string; name: string; name_th: string }[]>([]);

  // Init map + layers
  useEffect(() => {
    if (!mapContainer.current) return;
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.protomaps.com/styles/v5/light/en.json?key=${PROTOMAPS_KEY}`,
      center: [101, 13],
      zoom: 5,
      interactive: true,
      attributionControl: { compact: true },
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
      map.addLayer({ id: 'adm1-hit', type: 'fill', source: 'adm1', 'source-layer': 'admin1', paint: { 'fill-color': '#000', 'fill-opacity': 0 } });

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

  return { mapRef, mapContainer, bboxRef, amphoeBboxRef, geoRef, mapReady, provinces, applyColors };
}
