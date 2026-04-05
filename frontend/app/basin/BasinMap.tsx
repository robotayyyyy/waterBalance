'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { theme } from '../forecast/theme';

const PROTOMAPS_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY || '';

type Basin = 'ping' | 'yom';
// L1 = official sub-basin zones (SB_CODE, from "yom/ping real sub" shapefile, data: Sbonwr_Aggregated.csv)
// L2 = SWAT model fine-grained sub-watersheds (Subbasin, from TablesOut/subs.shp, data: Analysis_Sbswat.csv)
type Level = 'subbasin-l1' | 'subbasin-l2';

const BASIN_CENTERS: Record<Basin, [number, number]> = {
  ping: [98.97, 17.5],
  yom: [100.1, 17.2],
};

const LEVEL_ZOOM: Record<Level, number> = {
  'subbasin-l1': 7,
  'subbasin-l2': 8,
};

const ID_FIELD: Record<Level, string> = {
  'subbasin-l1': 'SB_CODE',
  'subbasin-l2': 'Subbasin',
};

// PMTiles layer names match the filenames from convert-basin-shapefiles.py
const PMTILES_NAME: Record<Basin, Record<Level, string>> = {
  ping: { 'subbasin-l1': 'ping-subbasin-l1', 'subbasin-l2': 'ping-subbasin-l2' },
  yom:  { 'subbasin-l1': 'yom-subbasin-l1',  'subbasin-l2': 'yom-subbasin-l2'  },
};

export default function BasinMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [basin, setBasin] = useState<Basin>('yom');
  const [level, setLevel] = useState<Level>('subbasin-l1');
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || containerRef.current.offsetWidth === 0) return;

    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: `https://api.protomaps.com/styles/v5/light/en.json?key=${PROTOMAPS_KEY}`,
      center: BASIN_CENTERS.yom,
      zoom: LEVEL_ZOOM['subbasin-l1'],
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      maplibregl.removeProtocol('pmtiles');
      map.remove();
    };
  }, []);

  // Swap source + layers when basin or level changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ready = () => {
      setSelected(null);
      setHovered(null);

      const sourceId = 'basin-source';
      const fillId = 'basin-fill';
      const lineId = 'basin-line';
      const highlightOuterId = 'basin-highlight-outer';
      const highlightInnerId = 'basin-highlight-inner';
      const layerName = PMTILES_NAME[basin][level];
      const url = `pmtiles:///thaimap/${layerName}.pmtiles`;

      // Remove old layers + source
      for (const id of [highlightInnerId, highlightOuterId, lineId, fillId]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      map.addSource(sourceId, { type: 'vector', url });

      map.addLayer({
        id: fillId,
        type: 'fill',
        source: sourceId,
        'source-layer': layerName,
        paint: {
          'fill-color': theme.color.noData,
          'fill-opacity': theme.mapFillOpacity,
        },
      });

      map.addLayer({
        id: lineId,
        type: 'line',
        source: sourceId,
        'source-layer': layerName,
        paint: {
          'line-color': level === 'subbasin-l1' ? theme.mapLine.l2.color : theme.mapLine.l3.color,
          'line-width': level === 'subbasin-l1' ? theme.mapLine.l2.width : theme.mapLine.l3.width,
          'line-opacity': level === 'subbasin-l1' ? theme.mapLine.l2.opacity : theme.mapLine.l3.opacity,
          'line-dasharray': level === 'subbasin-l1' ? theme.mapLine.l2.dash : undefined,
        },
      });

      map.addLayer({
        id: highlightOuterId,
        type: 'line',
        source: sourceId,
        'source-layer': layerName,
        filter: ['==', ID_FIELD[level], ''],
        paint: {
          'line-color': theme.mapLine.highlightOuter.color,
          'line-width': theme.mapLine.highlightOuter.width,
          'line-opacity': theme.mapLine.highlightOuter.opacity,
        },
      });

      map.addLayer({
        id: highlightInnerId,
        type: 'line',
        source: sourceId,
        'source-layer': layerName,
        filter: ['==', ID_FIELD[level], ''],
        paint: {
          'line-color': theme.mapLine.highlightInner.color,
          'line-width': theme.mapLine.highlightInner.width,
          'line-opacity': theme.mapLine.highlightInner.opacity,
        },
      });

      // Click handler
      const clickHandler = (e: any) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const id = String(feat.properties?.[ID_FIELD[level]] ?? '');
        setSelected(id);
        const filter = ['==', ID_FIELD[level], id];
        map.setFilter(highlightOuterId, filter);
        map.setFilter(highlightInnerId, filter);
      };
      map.off('click', fillId, clickHandler);
      map.on('click', fillId, clickHandler);

      // Hover
      const mousemoveHandler = (e: any) => {
        const feat = e.features?.[0];
        const id = feat ? String(feat.properties?.[ID_FIELD[level]] ?? '') : null;
        setHovered(id);
        map.getCanvas().style.cursor = 'pointer';
      };
      const mouseleaveHandler = () => {
        setHovered(null);
        map.getCanvas().style.cursor = '';
      };
      map.off('mousemove', fillId, mousemoveHandler);
      map.off('mouseleave', fillId, mouseleaveHandler);
      map.on('mousemove', fillId, mousemoveHandler);
      map.on('mouseleave', fillId, mouseleaveHandler);

      map.flyTo({ center: BASIN_CENTERS[basin], zoom: LEVEL_ZOOM[level], duration: 800 });

    };

    if (map.isStyleLoaded()) ready();
    else map.once('load', ready);
  }, [basin, level]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    background: active ? '#3b82f6' : '#1e293b',
    color: active ? '#fff' : '#94a3b8',
  });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Controls */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        background: '#0f172a', borderRadius: 10, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, fontFamily: 'sans-serif' }}>
          Basin POC
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#64748b', fontSize: 11, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: 1 }}>Basin</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btnStyle(basin === 'ping')} onClick={() => setBasin('ping')}>Ping</button>
            <button style={btnStyle(basin === 'yom')} onClick={() => setBasin('yom')}>Yom</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#64748b', fontSize: 11, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: 1 }}>Level</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btnStyle(level === 'subbasin-l1')} onClick={() => setLevel('subbasin-l1')}>Sub-basin L1</button>
            <button style={btnStyle(level === 'subbasin-l2')} onClick={() => setLevel('subbasin-l2')}>Sub-basin L2</button>
          </div>
        </div>

        {selected && (
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8, fontFamily: 'sans-serif' }}>
            <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Selected</div>
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 16, marginTop: 2 }}>{selected}</div>
            {hovered && hovered !== selected && (
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Hover: {hovered}</div>
            )}
          </div>
        )}
        {!selected && hovered && (
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8, fontFamily: 'sans-serif' }}>
            <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Hover</div>
            <div style={{ color: '#94a3b8', fontWeight: 600, fontSize: 14, marginTop: 2 }}>{hovered}</div>
          </div>
        )}
      </div>
    </div>
  );
}
