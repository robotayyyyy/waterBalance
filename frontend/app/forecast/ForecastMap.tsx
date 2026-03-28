'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
import { useLang } from '../i18n/LangContext';
import type { Translations } from '../i18n/translations';

import { useMapInit, valueToColor } from './hooks/useMapInit';
import type { Model, Mode, Level } from './hooks/useMapInit';
import { useSelectionHandlers } from './hooks/useSelectionHandlers';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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

export default function ForecastMap() {
  const { locale, t, setLocale } = useLang();

  const [model, setModel] = useState<Model>('7days');
  const [mode, setMode] = useState<Mode>('drought');
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

  const initialized = useRef(false);

  const { mapRef, mapContainer, bboxRef, amphoeBboxRef, geoRef, mapReady, provinces, applyColors } =
    useMapInit({ selectedProvince, selectedAmphoe, activeLevel });

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
  }, [applyColors]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    updateTambonList, updateSidebarLists,
    handleProvinceSelect, handleAmphoeSelect, handleAmphoeDeselect,
    handleTambonDeselect, handleDrillToTambon, handleTambonSelect,
  } = useSelectionHandlers({
    mapRef, bboxRef, amphoeBboxRef, geoRef,
    selectedDate, mode, model, selectedProvince, selectedAmphoe,
    setSelectedProvince, setSelectedAmphoe, setSelectedTambon, setActiveLevel,
    setAmphoeList, setTambonList,
    fetchData,
  });

  // Auto-init: Chiang Mai + latest date
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
  }, [mapReady, provinces, updateSidebarLists]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when mode changes (after init)
  useEffect(() => {
    if (!initialized.current || !selectedDate) return;
    const provId = activeLevel !== 'province' ? selectedProvince : '';
    fetchData(selectedDate, activeLevel, mode, provId, model);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Model toggle: reload dates and auto-select latest
  const handleModelChange = async (m: Model) => {
    setModel(m);
    setAvailableDates([]);
    setSelectedDate('');
    const dates = await fetch(`${API}/forecast/dates?model=${m}&start=2020-01-01&end=2030-12-31`).then(r => r.json());
    const validDates = Array.isArray(dates) ? dates : [];
    const latest = validDates[validDates.length - 1] ?? '';
    setAvailableDates(validDates);
    if (latest) {
      setSelectedDate(latest);
      const provId = activeLevel !== 'province' ? selectedProvince : '';
      fetchData(latest, activeLevel, mode, provId, m);
    }
  };

  // Date range search
  const handleDateSearch = async (start: string, end: string) => {
    const dates = await fetch(`${API}/forecast/dates?model=${model}&start=${start}&end=${end}`).then(r => r.json());
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
    const provId = activeLevel !== 'province' ? selectedProvince : '';
    fetchData(date, activeLevel, mode, provId, model);
  };

  // Map interaction: hover tooltip + click-to-select + drill
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

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
        // adm1-hit is an unfiltered transparent fill layer — reliable interior click detection
        const features = map.queryRenderedFeatures(e.point, { layers: ['adm1-hit'] });
        if (!features.length) return;
        const pcode = features[0].properties?.adm1_pcode as string | undefined;
        if (!pcode) return;
        const id = stripTH(pcode);
        if (id === selectedProvince && selectedAmphoe) {
          // Re-click selected province → drill into amphoe view
          handleAmphoeSelect(selectedAmphoe);
        } else {
          handleProvinceSelect(id);
        }
      } else if (activeLevel === 'amphoe') {
        // adm2-fill is filtered to selected province — no features = clicked outside province
        const features = map.queryRenderedFeatures(e.point, { layers: [fillLayer] });
        if (!features.length) { handleAmphoeDeselect(); return; }
        const pcode = features[0].properties?.[pcodeField] as string | undefined;
        if (!pcode) return;
        const id = stripTH(pcode);
        if (id === selectedAmphoe) {
          // Re-click selected amphoe → drill into tambon view
          handleDrillToTambon();
        } else {
          handleAmphoeSelect(id);
        }
      } else {
        // adm3-fill is filtered to selected amphoe — no features = clicked outside amphoe
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
    mapReady, activeLevel, selectedProvince, selectedAmphoe,
    colorData, mode,
    handleProvinceSelect, handleAmphoeSelect, handleAmphoeDeselect,
    handleTambonSelect, handleTambonDeselect, handleDrillToTambon,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginRight: 'auto' }}>{t.app.title}</span>
        <ModelToggle model={model} onChange={handleModelChange} />
        <ModeButtons mode={mode} onChange={setMode} />
        <button
          onClick={() => setLocale(locale === 'en' ? 'th' : 'en')}
          style={{ padding: '4px 10px', border: '1px solid #475569', borderRadius: 4, background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}
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
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} onMouseLeave={() => setTooltip(null)} />
            <Legend mode={mode} />
            {tooltip && (
              <div style={{
                position: 'absolute',
                left: tooltip.x + 14,
                top: tooltip.y - 10,
                pointerEvents: 'none',
                background: 'rgba(255,255,255,0.97)',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                padding: '7px 11px',
                fontSize: 12,
                zIndex: 20,
                whiteSpace: 'nowrap',
              }}>
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                  {locale === 'th' ? tooltip.name_th : tooltip.name}
                </div>
                {tooltip.value !== null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 2, flexShrink: 0, background: valueToColor(tooltip.value, mode), border: '1px solid #e2e8f0' }} />
                    <span style={{ color: '#475569' }}>{tooltipLabel(tooltip.value, mode, t)}</span>
                  </div>
                ) : (
                  <span style={{ color: '#94a3b8' }}>{t.legend.nodata}</span>
                )}
              </div>
            )}
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
          <SideTable
            rows={activeLevel === 'tambon' && selectedAmphoe ? detailData.filter(r => r.id.startsWith(selectedAmphoe)) : detailData}
            activeLevel={activeLevel}
          />
        </TablePanel>

      </div>

    </div>
  );
}
