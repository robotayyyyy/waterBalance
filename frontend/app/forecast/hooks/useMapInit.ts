'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { theme, dataColors, valueToColor } from '../theme';
import type { Mode } from '../theme';

export type { Mode };
export type Model = '7days' | '6months';
export type Level = 'province' | 'amphoe' | 'tambon';
export type BasinLevel = 'watershed' | 'subbasin-l1' | 'subbasin-l2';
export type Basin = 'ping' | 'yom';

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

const INIT_CENTER: [number, number] = [100, 18];
const INIT_ZOOM = 6;

export { valueToColor };

// ─── Map line styles ──────────────────────────────────────────────────────────
const MAP_LINE = {
  l1:             { 'line-color': theme.mapLine.l1.color, 'line-width': theme.mapLine.l1.width, 'line-opacity': theme.mapLine.l1.opacity, ...( theme.mapLine.l1.dash && { 'line-dasharray': theme.mapLine.l1.dash }) },
  l2:             { 'line-color': theme.mapLine.l2.color, 'line-width': theme.mapLine.l2.width, 'line-opacity': theme.mapLine.l2.opacity, ...( theme.mapLine.l2.dash && { 'line-dasharray': theme.mapLine.l2.dash }) },
  l3:             { 'line-color': theme.mapLine.l3.color, 'line-width': theme.mapLine.l3.width, 'line-opacity': theme.mapLine.l3.opacity },
  highlightOuter: { 'line-color': theme.mapLine.highlightOuter.color, 'line-width': theme.mapLine.highlightOuter.width, 'line-opacity': theme.mapLine.highlightOuter.opacity },
  highlightInner: { 'line-color': theme.mapLine.highlightInner.color, 'line-width': theme.mapLine.highlightInner.width, 'line-opacity': theme.mapLine.highlightInner.opacity },
} as const;

function buildMatchExpr(data: { id: string; value: number }[], idField: string, mode: Mode): any[] {
  const expr: any[] = ['match', ['get', idField]];
  const seen = new Set<string>();
  for (const row of data) {
    const key = `TH${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    expr.push(key, valueToColor(row.value, mode));
  }
  expr.push(dataColors.noData);
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
      center: INIT_CENTER,
      zoom: INIT_ZOOM,
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
      map.addLayer({ id: 'adm1-fill', type: 'fill', source: 'adm1', 'source-layer': 'admin1', paint: { 'fill-color': theme.color.noData, 'fill-opacity': 0.5 } });
      map.addLayer({ id: 'adm1-line', type: 'line', source: 'adm1', 'source-layer': 'admin1', paint: MAP_LINE.l1 });
      map.addLayer({ id: 'adm1-hit',  type: 'fill', source: 'adm1', 'source-layer': 'admin1', paint: { 'fill-color': '#000', 'fill-opacity': 0 } });

      // ADM2 — amphoe
      map.addSource('adm2', { type: 'vector', url: `pmtiles://${ADM2_URL}` });
      map.addLayer({ id: 'adm2-fill',            type: 'fill', source: 'adm2', 'source-layer': 'admin2', paint: { 'fill-color': theme.color.noData, 'fill-opacity': 0 } });
      map.addLayer({ id: 'adm2-line',            type: 'line', source: 'adm2', 'source-layer': 'admin2', paint: MAP_LINE.l2,             layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm2-highlight',       type: 'line', source: 'adm2', 'source-layer': 'admin2', paint: MAP_LINE.highlightOuter, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm2-highlight-inner', type: 'line', source: 'adm2', 'source-layer': 'admin2', paint: MAP_LINE.highlightInner, layout: { visibility: 'none' } });

      // ADM3 — tambon
      map.addSource('adm3', { type: 'vector', url: `pmtiles://${ADM3_URL}` });
      map.addLayer({ id: 'adm3-fill',            type: 'fill', source: 'adm3', 'source-layer': 'admin3', paint: { 'fill-color': theme.color.noData, 'fill-opacity': 0 }, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm3-line',            type: 'line', source: 'adm3', 'source-layer': 'admin3', paint: MAP_LINE.l3,             layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm3-highlight',       type: 'line', source: 'adm3', 'source-layer': 'admin3', paint: MAP_LINE.highlightOuter, layout: { visibility: 'none' } });
      map.addLayer({ id: 'adm3-highlight-inner', type: 'line', source: 'adm3', 'source-layer': 'admin3', paint: MAP_LINE.highlightInner, layout: { visibility: 'none' } });

      // Basin — watershed (combined Ping + Yom, colored by MB_CODE)
      map.addSource('basin-watershed-src', { type: 'vector', url: 'pmtiles:///thaimap/basin-watershed.pmtiles' });
      map.addLayer({ id: 'basin-watershed-fill',            type: 'fill', source: 'basin-watershed-src', 'source-layer': 'basin-watershed', paint: { 'fill-color': theme.color.noData, 'fill-opacity': 0 },                                          layout: { visibility: 'none' } });
      map.addLayer({ id: 'basin-watershed-line',            type: 'line', source: 'basin-watershed-src', 'source-layer': 'basin-watershed', paint: MAP_LINE.l1,                                                                                       layout: { visibility: 'none' } });
      map.addLayer({ id: 'basin-watershed-hit',             type: 'fill', source: 'basin-watershed-src', 'source-layer': 'basin-watershed', paint: { 'fill-color': '#000', 'fill-opacity': 0 },                                                       layout: { visibility: 'none' } });
      map.addLayer({ id: 'basin-watershed-highlight',       type: 'line', source: 'basin-watershed-src', 'source-layer': 'basin-watershed', filter: ['==', ['get', 'MB_CODE'], ''], paint: MAP_LINE.highlightOuter,                                    layout: { visibility: 'none' } });
      map.addLayer({ id: 'basin-watershed-highlight-inner', type: 'line', source: 'basin-watershed-src', 'source-layer': 'basin-watershed', filter: ['==', ['get', 'MB_CODE'], ''], paint: MAP_LINE.highlightInner,                                   layout: { visibility: 'none' } });

      // Basin — sub-basin L1
      map.addSource('ping-l1-src', { type: 'vector', url: 'pmtiles:///thaimap/ping-subbasin-l1.pmtiles' });
      map.addLayer({ id: 'ping-l1-fill',            type: 'fill', source: 'ping-l1-src', 'source-layer': 'ping-subbasin-l1', paint: { 'fill-color': theme.color.noData, 'fill-opacity': 0 },           layout: { visibility: 'none' } });
      map.addLayer({ id: 'ping-l1-line',            type: 'line', source: 'ping-l1-src', 'source-layer': 'ping-subbasin-l1', paint: MAP_LINE.l2,                                                       layout: { visibility: 'none' } });
      map.addLayer({ id: 'ping-l1-highlight',       type: 'line', source: 'ping-l1-src', 'source-layer': 'ping-subbasin-l1', filter: ['==', ['get', 'SB_CODE'], ''], paint: MAP_LINE.highlightOuter,   layout: { visibility: 'none' } });
      map.addLayer({ id: 'ping-l1-highlight-inner', type: 'line', source: 'ping-l1-src', 'source-layer': 'ping-subbasin-l1', filter: ['==', ['get', 'SB_CODE'], ''], paint: MAP_LINE.highlightInner,   layout: { visibility: 'none' } });

      map.addSource('yom-l1-src', { type: 'vector', url: 'pmtiles:///thaimap/yom-subbasin-l1.pmtiles' });
      map.addLayer({ id: 'yom-l1-fill',            type: 'fill', source: 'yom-l1-src', 'source-layer': 'yom-subbasin-l1', paint: { 'fill-color': theme.color.noData, 'fill-opacity': 0 },            layout: { visibility: 'none' } });
      map.addLayer({ id: 'yom-l1-line',            type: 'line', source: 'yom-l1-src', 'source-layer': 'yom-subbasin-l1', paint: MAP_LINE.l2,                                                        layout: { visibility: 'none' } });
      map.addLayer({ id: 'yom-l1-highlight',       type: 'line', source: 'yom-l1-src', 'source-layer': 'yom-subbasin-l1', filter: ['==', ['get', 'SB_CODE'], ''], paint: MAP_LINE.highlightOuter,    layout: { visibility: 'none' } });
      map.addLayer({ id: 'yom-l1-highlight-inner', type: 'line', source: 'yom-l1-src', 'source-layer': 'yom-subbasin-l1', filter: ['==', ['get', 'SB_CODE'], ''], paint: MAP_LINE.highlightInner,    layout: { visibility: 'none' } });

      // Basin — sub-basin L2
      map.addSource('ping-l2-src', { type: 'vector', url: 'pmtiles:///thaimap/ping-subbasin-l2.pmtiles' });
      map.addLayer({ id: 'ping-l2-fill',            type: 'fill', source: 'ping-l2-src', 'source-layer': 'ping-subbasin-l2', paint: { 'fill-color': theme.color.noData, 'fill-opacity': 0 },                      layout: { visibility: 'none' } });
      map.addLayer({ id: 'ping-l2-line',            type: 'line', source: 'ping-l2-src', 'source-layer': 'ping-subbasin-l2', paint: MAP_LINE.l3,                                                                   layout: { visibility: 'none' } });
      map.addLayer({ id: 'ping-l2-highlight',       type: 'line', source: 'ping-l2-src', 'source-layer': 'ping-subbasin-l2', filter: ['==', ['get', 'Subbasin'], 0], paint: MAP_LINE.highlightOuter,               layout: { visibility: 'none' } });
      map.addLayer({ id: 'ping-l2-highlight-inner', type: 'line', source: 'ping-l2-src', 'source-layer': 'ping-subbasin-l2', filter: ['==', ['get', 'Subbasin'], 0], paint: MAP_LINE.highlightInner,               layout: { visibility: 'none' } });

      map.addSource('yom-l2-src', { type: 'vector', url: 'pmtiles:///thaimap/yom-subbasin-l2.pmtiles' });
      map.addLayer({ id: 'yom-l2-fill',            type: 'fill', source: 'yom-l2-src', 'source-layer': 'yom-subbasin-l2', paint: { 'fill-color': theme.color.noData, 'fill-opacity': 0 },                         layout: { visibility: 'none' } });
      map.addLayer({ id: 'yom-l2-line',            type: 'line', source: 'yom-l2-src', 'source-layer': 'yom-subbasin-l2', paint: MAP_LINE.l3,                                                                      layout: { visibility: 'none' } });
      map.addLayer({ id: 'yom-l2-highlight',       type: 'line', source: 'yom-l2-src', 'source-layer': 'yom-subbasin-l2', filter: ['==', ['get', 'Subbasin'], 0], paint: MAP_LINE.highlightOuter,                  layout: { visibility: 'none' } });
      map.addLayer({ id: 'yom-l2-highlight-inner', type: 'line', source: 'yom-l2-src', 'source-layer': 'yom-subbasin-l2', filter: ['==', ['get', 'Subbasin'], 0], paint: MAP_LINE.highlightInner,                  layout: { visibility: 'none' } });

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
      console.log('[adm1-fill filter] province selected → filter to TH' + selectedProvince);
      map.setFilter('adm1-fill', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
    } else {
      console.log('[adm1-fill filter] no province or not province level → null filter (show all)');
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

  // Base layers are always visible in admin mode; contextual layers are managed by selection handlers
  const BASE_ADM_LAYERS = ['adm1-fill','adm1-line','adm1-hit','adm2-fill'];
  const CONTEXTUAL_ADM_LAYERS = ['adm2-line','adm2-highlight','adm2-highlight-inner','adm3-fill','adm3-line','adm3-highlight','adm3-highlight-inner'];
  const ALL_ADM_LAYERS = [...BASE_ADM_LAYERS, ...CONTEXTUAL_ADM_LAYERS];
  const ALL_BASIN_LAYERS = ['basin-watershed-fill','basin-watershed-line','basin-watershed-hit','basin-watershed-highlight','basin-watershed-highlight-inner','ping-l1-fill','ping-l1-line','ping-l1-highlight','ping-l1-highlight-inner','yom-l1-fill','yom-l1-line','yom-l1-highlight','yom-l1-highlight-inner','ping-l2-fill','ping-l2-line','ping-l2-highlight','ping-l2-highlight-inner','yom-l2-fill','yom-l2-line','yom-l2-highlight','yom-l2-highlight-inner'];

  const setAdminLayersVisible = useCallback((visible: boolean) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (visible) {
      // Restore only base layers; contextual layers (highlights, sub-borders) are reset to none
      // so selection handlers can show them at the right time with the right filters
      for (const id of BASE_ADM_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      }
      for (const id of CONTEXTUAL_ADM_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      }
    } else {
      for (const id of ALL_ADM_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      }
    }
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const setBasinLayersVisible = useCallback((basin: Basin | null, basinLevel: BasinLevel | null) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    // Hide all basin layers first
    for (const id of ALL_BASIN_LAYERS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    }
    if (!basinLevel) return;
    if (basinLevel === 'watershed') {
      const mbCode = basin === 'ping' ? '06' : basin === 'yom' ? '08' : null;
      const mbFilter = mbCode ? ['==', ['get', 'MB_CODE'], mbCode] as any : null;
      map.setLayoutProperty('basin-watershed-fill', 'visibility', 'visible');
      map.setLayoutProperty('basin-watershed-line', 'visibility', 'visible');
      map.setLayoutProperty('basin-watershed-hit',  'visibility', 'visible');
      map.setFilter('basin-watershed-fill', mbFilter);
      map.setFilter('basin-watershed-line', mbFilter);
      map.setFilter('basin-watershed-hit',  mbFilter);
    } else if (basinLevel === 'subbasin-l1' && basin) {
      map.setLayoutProperty(`${basin}-l1-fill`,            'visibility', 'visible');
      map.setLayoutProperty(`${basin}-l1-line`,            'visibility', 'visible');
      map.setLayoutProperty(`${basin}-l1-highlight`,       'visibility', 'visible');
      map.setLayoutProperty(`${basin}-l1-highlight-inner`, 'visibility', 'visible');
    } else if (basinLevel === 'subbasin-l2' && basin) {
      const fillId = `${basin}-l2-fill`;
      const lineId = `${basin}-l2-line`;
      const hlId   = `${basin}-l2-highlight`;
      const hlInner = `${basin}-l2-highlight-inner`;
      console.log('[layers] showing L2', { fillId, lineId, hlId, hasLayer: map.getLayer(fillId) != null });
      map.setLayoutProperty(fillId,   'visibility', 'visible');
      map.setLayoutProperty(lineId,   'visibility', 'visible');
      map.setLayoutProperty(hlId,     'visibility', 'visible');
      map.setLayoutProperty(hlInner,  'visibility', 'visible');
      console.log('[layers] L2 fill opacity after show:', map.getPaintProperty(fillId, 'fill-opacity'));
    }
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyBasinColors = useCallback((
    data: { id: string; value: number }[],
    basin: Basin | null,
    basinLevel: BasinLevel,
    md: Mode,
  ) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (basinLevel === 'watershed') {
      const expr: any[] = ['match', ['get', 'MB_CODE']];
      for (const row of data) { expr.push(row.id, valueToColor(row.value, md)); }
      expr.push(theme.color.noData);
      map.setPaintProperty('basin-watershed-fill', 'fill-color', data.length > 0 ? expr : theme.color.noData);
      map.setPaintProperty('basin-watershed-fill', 'fill-opacity', theme.mapFillOpacity);
    } else if (basinLevel === 'subbasin-l1' && basin) {
      const fillId = `${basin}-l1-fill`;
      const expr: any[] = ['match', ['get', 'SB_CODE']];
      for (const row of data) { expr.push(row.id, valueToColor(row.value, md)); }
      expr.push(theme.color.noData);
      map.setPaintProperty(fillId, 'fill-color', data.length > 0 ? expr : theme.color.noData);
      map.setPaintProperty(fillId, 'fill-opacity', theme.mapFillOpacity);
    } else if (basinLevel === 'subbasin-l2' && basin) {
      const fillId = `${basin}-l2-fill`;
      // Subbasin property is a number in the PMTiles — match as number
      const expr: any[] = ['match', ['get', 'Subbasin']];
      for (const row of data) { expr.push(parseInt(row.id, 10), valueToColor(row.value, md)); }
      expr.push(theme.color.noData);
      map.setPaintProperty(fillId, 'fill-color', data.length > 0 ? expr : theme.color.noData);
      map.setPaintProperty(fillId, 'fill-opacity', theme.mapFillOpacity);
    }
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const setL1Highlight = useCallback((basin: Basin, sbCode: string | null) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const filter = ['==', ['get', 'SB_CODE'], sbCode ?? ''] as any;
    for (const id of [`${basin}-l1-highlight`, `${basin}-l1-highlight-inner`]) {
      if (map.getLayer(id)) map.setFilter(id, filter);
    }
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const setL2Highlight = useCallback((basin: Basin, subbasinId: string | null) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    // Subbasin field is a number in PMTiles; 0 never matches a real subbasin
    const filter = ['==', ['get', 'Subbasin'], subbasinId ? parseInt(subbasinId, 10) : 0] as any;
    for (const id of [`${basin}-l2-highlight`, `${basin}-l2-highlight-inner`]) {
      if (map.getLayer(id)) map.setFilter(id, filter);
    }
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const setL2SbFilter = useCallback((basin: Basin, sbCode: string | null) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    // Only filter fill and line — highlight is managed separately by setL2Highlight
    for (const layer of [`${basin}-l2-fill`, `${basin}-l2-line`]) {
      if (map.getLayer(layer)) {
        map.setFilter(layer, sbCode ? ['==', ['get', 'SB_CODE'], sbCode] : null);
      }
    }
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const setWatershedHighlight = useCallback((mbCode: string | null) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (mbCode) {
      map.setLayoutProperty('basin-watershed-highlight', 'visibility', 'visible');
      map.setLayoutProperty('basin-watershed-highlight-inner', 'visibility', 'visible');
      map.setFilter('basin-watershed-highlight', ['==', ['get', 'MB_CODE'], mbCode]);
      map.setFilter('basin-watershed-highlight-inner', ['==', ['get', 'MB_CODE'], mbCode]);
    } else {
      map.setLayoutProperty('basin-watershed-highlight', 'visibility', 'none');
      map.setLayoutProperty('basin-watershed-highlight-inner', 'visibility', 'none');
    }
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyColors = useCallback((data: { id: string; value: number }[], lvl: Level, md: Mode) => {
    const map = mapRef.current;
    console.log(`[applyColors] lvl=${lvl} mode=${md} dataLen=${data.length} mapReady=${mapReady}`);
    if (!map || !mapReady) { console.warn('[applyColors] skipped — map or mapReady not set'); return; }

    map.setPaintProperty('adm1-fill', 'fill-opacity', 0);
    map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
    map.setPaintProperty('adm3-fill', 'fill-opacity', 0);

    if (lvl === 'province') {
      const expr = data.length > 0 ? buildMatchExpr(data, 'adm1_pcode', md) : theme.color.noData;
      console.log('[applyColors] adm1-fill visibility:', map.getLayoutProperty('adm1-fill', 'visibility'));
      console.log('[applyColors] adm1-fill current filter:', map.getFilter('adm1-fill'));
      map.setPaintProperty('adm1-fill', 'fill-color', expr);
      map.setPaintProperty('adm1-fill', 'fill-opacity', theme.mapFillOpacity);
    } else if (lvl === 'amphoe') {
      const expr = data.length > 0 ? buildMatchExpr(data, 'adm2_pcode', md) : theme.color.noData;
      map.setPaintProperty('adm2-fill', 'fill-color', expr);
      map.setPaintProperty('adm2-fill', 'fill-opacity', theme.mapFillOpacity);
    } else if (lvl === 'tambon') {
      const expr = data.length > 0 ? buildMatchExpr(data, 'adm3_pcode', md) : theme.color.noData;
      map.setPaintProperty('adm3-fill', 'fill-color', expr);
      map.setPaintProperty('adm3-fill', 'fill-opacity', theme.mapFillOpacity);
    }
  }, [mapReady]);

  const setHighlightColor = useCallback((md: Mode) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const color = theme.highlightColor[md] ?? theme.mapLine.highlightInner.color;
    const innerLayers = [
      'adm2-highlight-inner', 'adm3-highlight-inner',
      'basin-watershed-highlight-inner',
      'ping-l1-highlight-inner', 'yom-l1-highlight-inner',
      'ping-l2-highlight-inner', 'yom-l2-highlight-inner',
    ];
    for (const id of innerLayers) {
      if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', color);
    }
  }, [mapReady]);

  return {
    mapRef, mapContainer, bboxRef, amphoeBboxRef, geoRef, mapReady, provinces,
    applyColors, applyBasinColors,
    setAdminLayersVisible, setBasinLayersVisible, setL1Highlight, setL2Highlight, setL2SbFilter, setWatershedHighlight,
    setHighlightColor,
  };
}
