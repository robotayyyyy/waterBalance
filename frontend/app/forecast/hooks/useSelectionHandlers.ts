'use client';

import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type maplibregl from 'maplibre-gl';
import type { Model, Mode, Level, GeoData } from './useMapInit';

interface Params {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  bboxRef: MutableRefObject<Record<string, [number, number, number, number]>>;
  amphoeBboxRef: MutableRefObject<Record<string, [number, number, number, number]>>;
  geoRef: MutableRefObject<GeoData | null>;
  selectedDate: string;
  mode: Mode;
  model: Model;
  selectedProvince: string;
  selectedAmphoe: string;
  setSelectedProvince: (v: string) => void;
  setSelectedAmphoe: (v: string) => void;
  setSelectedTambon: (v: string) => void;
  setActiveLevel: (v: Level) => void;
  setAmphoeList: (v: any[]) => void;
  setTambonList: (v: any[]) => void;
  fetchData: (date: string, lvl: Level, md: Mode, provId: string, mdl: Model) => Promise<void>;
}

export function useSelectionHandlers({
  mapRef, bboxRef, amphoeBboxRef, geoRef,
  selectedDate, mode, model, selectedProvince, selectedAmphoe,
  setSelectedProvince, setSelectedAmphoe, setSelectedTambon, setActiveLevel,
  setAmphoeList, setTambonList,
  fetchData,
}: Params) {

  const updateTambonList = useCallback((amphoeId: string) => {
    if (!geoRef.current || !amphoeId) { setTambonList([]); return; }
    setTambonList(geoRef.current.tambons.filter(t => t.amphoe_id === amphoeId));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProvinceSelect = useCallback((provId: string) => {
    setSelectedProvince(provId);
    setSelectedTambon('');
    setActiveLevel('province');
    const map = mapRef.current;
    if (!map) return;
    map.setMinZoom(null); // clear tambon-level zoom floor if coming from tambon view

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
  }, [selectedDate, mode, model, fetchData, updateSidebarLists]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAmphoeSelect = useCallback((amphoeId: string) => {
    setSelectedAmphoe(amphoeId);
    setSelectedTambon('');
    setActiveLevel('amphoe');
    const map = mapRef.current;
    if (map) {
      map.setMinZoom(null); // clear tambon-level zoom floor if coming from tambon view
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'visible');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setFilter('adm2-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
      map.setFilter('adm2-highlight', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm2-highlight-inner', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      const bbox = bboxRef.current[String(selectedProvince)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
    }
    updateTambonList(amphoeId);
    if (selectedDate) fetchData(selectedDate, 'amphoe', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, fetchData, updateTambonList]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAmphoeDeselect = useCallback(() => {
    setSelectedAmphoe('');
    setSelectedTambon('');
    setActiveLevel('province');
    setTambonList([]);
    const map = mapRef.current;
    if (map) {
      map.setMinZoom(null); // clear tambon-level zoom floor
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
  }, [selectedDate, mode, model, selectedProvince, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Going from tambon level back to amphoe level
  const handleTambonDeselect = useCallback(() => {
    setSelectedTambon('');
    setActiveLevel('amphoe');
    const map = mapRef.current;
    if (map) {
      map.setMinZoom(null); // clear tambon-level zoom floor
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'visible');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'visible');
      // Hide tambon layers — adm3-line filter uses adm2_pcode, not adm1_pcode
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
      map.setFilter('adm2-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
      map.setFilter('adm2-highlight', ['==', ['get', 'adm2_pcode'], `TH${selectedAmphoe}`]);
      map.setFilter('adm2-highlight-inner', ['==', ['get', 'adm2_pcode'], `TH${selectedAmphoe}`]);
      const bbox = bboxRef.current[String(selectedProvince)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
    }
    if (selectedDate) fetchData(selectedDate, 'amphoe', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, selectedAmphoe, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drill from amphoe view → tambon view without selecting a specific tambon
  const handleDrillToTambon = useCallback(() => {
    setActiveLevel('tambon');
    setSelectedTambon('');
    const map = mapRef.current;
    if (map) {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setFilter('adm3-line', ['==', ['get', 'adm2_pcode'], `TH${selectedAmphoe}`]);
      const bbox = amphoeBboxRef.current[selectedAmphoe];
      if (bbox) {
        // tha-tambon.pmtiles has min_zoom=8 — set minZoom only after fitBounds animation
        // completes to avoid an instant camera snap before the intended animation starts.
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
        map.once('moveend', () => map.setMinZoom(8));
      } else {
        map.setMinZoom(8);
      }
    }
    if (selectedDate) fetchData(selectedDate, 'tambon', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, selectedAmphoe, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTambonSelect = useCallback((tambonId: string) => {
    setSelectedTambon(tambonId);
    setActiveLevel('tambon');
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
      if (bbox) {
        // tha-tambon.pmtiles has min_zoom=8 — set minZoom after animation to avoid camera snap
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
        map.once('moveend', () => map.setMinZoom(8));
      } else {
        map.setMinZoom(8);
      }
    }
    if (selectedDate) fetchData(selectedDate, 'tambon', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    updateTambonList,
    updateSidebarLists,
    handleProvinceSelect,
    handleAmphoeSelect,
    handleAmphoeDeselect,
    handleTambonDeselect,
    handleDrillToTambon,
    handleTambonSelect,
  };
}
