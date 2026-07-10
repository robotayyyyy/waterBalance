'use client';

import { useCallback } from 'react';
import type { MutableRefObject, Dispatch } from 'react';
import type maplibregl from 'maplibre-gl';
import { INIT_VIEW } from './useMapInit';
import type { Model, Mode, Level, GeoData, Basin } from './useMapInit';
import { theme } from '../theme';
import type { AdminAction } from '../admin/adminState';

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
  selectedTambon: string;
  entryFromAllTambon: boolean;
  entryFromAllAmphoe: boolean;
  dispatch: Dispatch<AdminAction>;
  setAmphoeList: (v: any[]) => void;
  setTambonList: (v: any[]) => void;
  fetchData: (date: string, lvl: Level, md: Mode, provId: string, mdl: Model) => Promise<void>;
  prefetchTambonColors: (date: string, md: Mode, provId: string, mdl: Model) => Promise<void>;
  watershed: Basin;
  getFillOpacity: () => number;
}

export function useSelectionHandlers({
  mapRef, bboxRef, amphoeBboxRef, geoRef,
  selectedDate, mode, model, selectedProvince, selectedAmphoe, selectedTambon, entryFromAllTambon, entryFromAllAmphoe,
  dispatch, setAmphoeList, setTambonList,
  fetchData, prefetchTambonColors, watershed, getFillOpacity,
}: Params) {

  const updateTambonList = useCallback((amphoeId: string) => {
    if (!geoRef.current || !amphoeId) { setTambonList([]); return; }
    setTambonList(geoRef.current.tambons.filter(t => t.amphoe_id === amphoeId));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Populates amphoeList and tambonList from geo data — does NOT touch navigation state.
  const updateSidebarLists = useCallback((provId: string) => {
    if (!geoRef.current || !provId) {
      setAmphoeList([]);
      setTambonList([]);
      return;
    }
    const amphoes = geoRef.current.amphoes.filter(a => a.province_id === provId);
    setAmphoeList(amphoes);
    const first = amphoes[0];
    setTambonList(first ? geoRef.current.tambons.filter(t => t.amphoe_id === first.id) : []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProvinceSelect = useCallback((provId: string) => {
    console.log(`[WF] handleProvinceSelect("${provId}") — ${provId ? 'SELECT' : 'DESELECT'}`);
    const map = mapRef.current;
    if (!map) return;
    map.setMinZoom(null);

    if (provId) {
      dispatch({ type: 'SELECT_PROVINCE', id: provId });
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setFilter('adm2-line', ['==', ['get', 'adm1_pcode'], `TH${provId}`]);
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      const bbox = bboxRef.current[provId];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
      updateSidebarLists(provId);
      setTambonList([]);
      if (selectedDate) fetchData(selectedDate, 'amphoe', mode, provId, model);
    } else {
      dispatch({ type: 'DESELECT_PROVINCE' });
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setPaintProperty('adm1-fill', 'fill-color', theme.color.noData);
      map.setPaintProperty('adm1-fill', 'fill-opacity', getFillOpacity());
      map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
      updateSidebarLists('');
      map.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
      if (selectedDate) fetchData(selectedDate, 'province', mode, '', model);
    }
  }, [selectedDate, mode, model, fetchData, updateSidebarLists]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAmphoeSelect = useCallback((amphoeId: string) => {
    console.log(`[WF] handleAmphoeSelect("${amphoeId}") — entryFromAllAmphoe=${entryFromAllAmphoe}, selectedProvince at call time: "${selectedProvince}"`);
    // Mirrors handleTambonSelect: when entering from the unfiltered All Amphoe view, derive the
    // province locally rather than trusting the (stale, pre-dispatch) selectedProvince closure.
    const provinceId = entryFromAllAmphoe && amphoeId ? amphoeId.slice(0, 2) : selectedProvince;
    dispatch({ type: 'SELECT_AMPHOE', id: amphoeId });
    if (entryFromAllAmphoe && !selectedProvince) {
      updateSidebarLists(provinceId);
    }
    const map = mapRef.current;
    if (map) {
      map.setMinZoom(null);
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'visible');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setFilter('adm2-line', ['==', ['get', 'adm1_pcode'], `TH${provinceId}`]);
      map.setFilter('adm2-highlight', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      map.setFilter('adm2-highlight-inner', ['==', ['get', 'adm2_pcode'], `TH${amphoeId}`]);
      const bbox = amphoeBboxRef.current[amphoeId] ?? bboxRef.current[String(provinceId)];
      if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
    }
    updateTambonList(amphoeId);
    if (selectedDate) {
      fetchData(selectedDate, 'amphoe', mode, provinceId, model);
      prefetchTambonColors(selectedDate, mode, provinceId, model);
    }
  }, [selectedDate, mode, model, selectedProvince, entryFromAllAmphoe, fetchData, prefetchTambonColors, updateTambonList, updateSidebarLists]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAmphoeDeselect = useCallback(() => {
    console.log(`[WF] handleAmphoeDeselect() — entryFromAllAmphoe=${entryFromAllAmphoe}, selectedAmphoe="${selectedAmphoe}"`);
    const map = mapRef.current;

    // Dismiss the all-amphoe view: at AA1 (all amphoes, none selected) + all-amphoe mode, a click
    // on empty space dismisses back to province level (all provinces). Mirrors the all-tambon
    // A6-no-filter dismiss in handleTambonDeselect. All-amphoe is always basin-wide (no province
    // filter), so dismiss always returns to A1.
    if (selectedAmphoe === '' && entryFromAllAmphoe) {
      dispatch({ type: 'DESELECT_PROVINCE' });
      setTambonList([]);
      if (map) {
        map.setMinZoom(null);
        map.setLayoutProperty('adm2-line', 'visibility', 'none');
        map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
        map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
        map.setLayoutProperty('adm3-line', 'visibility', 'none');
        map.setLayoutProperty('adm3-fill', 'visibility', 'none');
        map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
        map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
        map.setLayoutProperty('adm1-fill', 'visibility', 'visible');
        map.setPaintProperty('adm1-fill', 'fill-color', theme.color.noData);
        map.setPaintProperty('adm1-fill', 'fill-opacity', getFillOpacity());
        map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
        map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
        map.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
      }
      if (selectedDate) fetchData(selectedDate, 'province', mode, '', model);
      return;
    }

    dispatch({ type: 'DESELECT_AMPHOE' });
    setTambonList([]);

    if (entryFromAllAmphoe) {
      // Return to AA1: all basin amphoes, no amphoe selected
      if (map) {
        map.setMinZoom(null);
        map.setLayoutProperty('adm2-line', 'visibility', 'visible');
        map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
        map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
        map.setLayoutProperty('adm3-line', 'visibility', 'none');
        map.setLayoutProperty('adm3-fill', 'visibility', 'none');
        map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
        map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
        // Keep adm2-fill visible + painted — it is the click target for the all-amphoe view
        map.setLayoutProperty('adm2-fill', 'visibility', 'visible');
        map.setFilter('adm2-line', null);
        map.setPaintProperty('adm2-fill', 'fill-opacity', getFillOpacity());
        map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
        map.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
      }
      if (selectedDate) fetchData(selectedDate, 'amphoe', mode, '', model);
      return;
    }

    if (map) {
      map.setMinZoom(null);
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
  }, [selectedDate, mode, model, selectedProvince, selectedAmphoe, entryFromAllAmphoe, fetchData, watershed, getFillOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrillToAllAmphoe = useCallback(() => {
    console.log('[WF] handleDrillToAllAmphoe()');
    dispatch({ type: 'DRILL_TO_ALL_AMPHOE' });
    const map = mapRef.current;
    if (map) {
      map.setMinZoom(null);
      map.setLayoutProperty('adm2-line', 'visibility', 'visible');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-line', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      // adm2-fill is the click target + color layer for the all-amphoe view. Set it visible
      // explicitly (mirror of how handleDrillToAllTambon shows adm3-fill) — it can be 'none' if
      // setAdminLayersVisible hasn't run, and a hidden layer is neither painted nor hit-testable.
      map.setLayoutProperty('adm2-fill', 'visibility', 'visible');
      map.setFilter('adm2-line', null);
      // Set fill-opacity explicitly: adm2-fill may be 0 when arriving from A1/A3 before any amphoe fetch
      map.setPaintProperty('adm2-fill', 'fill-opacity', getFillOpacity());
      map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
      map.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
    }
    if (selectedDate) fetchData(selectedDate, 'amphoe', mode, '', model);
  }, [selectedDate, mode, model, fetchData, getFillOpacity, watershed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTambonDeselect = useCallback(() => {
    console.log(`[WF] handleTambonDeselect() — entryFromAllTambon=${entryFromAllTambon}, selectedTambon="${selectedTambon}"`);
    const map = mapRef.current;

    // A6 dismiss: no tambon selected + All Tambons mode → dismiss back to province overview or full reset
    if (selectedTambon === '' && entryFromAllTambon) {
      if (selectedProvince) {
        // A6-province-filter → A3: amphoe overview for the province
        dispatch({ type: 'SELECT_PROVINCE', id: selectedProvince });
        if (map) {
          map.setMinZoom(null);
          map.setLayoutProperty('adm2-line', 'visibility', 'visible');
          map.setFilter('adm2-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
          map.setLayoutProperty('adm3-fill', 'visibility', 'none');
          map.setLayoutProperty('adm3-line', 'visibility', 'none');
          map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
          map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
          map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
          const bbox = bboxRef.current[selectedProvince];
          if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
        }
        if (selectedDate) fetchData(selectedDate, 'amphoe', mode, selectedProvince, model);
      } else {
        // A6-no-filter → A1: full reset
        dispatch({ type: 'DESELECT_PROVINCE' });
        if (map) {
          map.setMinZoom(null);
          map.setLayoutProperty('adm2-line', 'visibility', 'none');
          map.setLayoutProperty('adm3-fill', 'visibility', 'none');
          map.setLayoutProperty('adm3-line', 'visibility', 'none');
          map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
          map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
          map.setPaintProperty('adm1-fill', 'fill-color', theme.color.noData);
          map.setPaintProperty('adm1-fill', 'fill-opacity', getFillOpacity());
          map.setPaintProperty('adm2-fill', 'fill-opacity', 0);
          map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
          map.flyTo({ center: INIT_VIEW[watershed].center, zoom: INIT_VIEW[watershed].zoom, duration: 800 });
        }
        if (selectedDate) fetchData(selectedDate, 'province', mode, '', model);
      }
      return;
    }

    dispatch({ type: 'DESELECT_TAMBON' });
    if (entryFromAllTambon) {
      // Return to A6: all tambons in province, map at province bbox
      if (map) {
        map.setMinZoom(null);
        map.setLayoutProperty('adm2-line', 'visibility', 'none');
        map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
        map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
        map.setLayoutProperty('adm3-fill', 'visibility', 'visible');
        map.setLayoutProperty('adm3-line', 'visibility', 'visible');
        map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
        map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
        if (selectedProvince) {
          map.setFilter('adm3-line', ['==', ['slice', ['get', 'adm2_pcode'], 0, 4], `TH${selectedProvince}`]);
        } else {
          map.setFilter('adm3-line', null);
        }
        const bbox = bboxRef.current[String(selectedProvince)];
        if (bbox) {
          const camera = map.cameraForBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60 });
          map.easeTo({
            center: camera?.center ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
            zoom: camera?.zoom ?? 6,
            duration: 800,
          });
        }
      }
      if (selectedDate) fetchData(selectedDate, 'tambon', mode, selectedProvince, model);
    } else {
      // Return to A4: amphoe selected, map at amphoe bbox
      if (map) {
        map.setMinZoom(null);
        map.setLayoutProperty('adm2-line', 'visibility', 'visible');
        map.setLayoutProperty('adm2-highlight', 'visibility', 'visible');
        map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'visible');
        map.setLayoutProperty('adm3-line', 'visibility', 'none');
        map.setLayoutProperty('adm3-fill', 'visibility', 'none');
        map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
        map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
        map.setPaintProperty('adm3-fill', 'fill-opacity', 0);
        map.setFilter('adm2-line', ['==', ['get', 'adm1_pcode'], `TH${selectedProvince}`]);
        map.setFilter('adm2-highlight', ['==', ['get', 'adm2_pcode'], `TH${selectedAmphoe}`]);
        map.setFilter('adm2-highlight-inner', ['==', ['get', 'adm2_pcode'], `TH${selectedAmphoe}`]);
        const bbox = amphoeBboxRef.current[selectedAmphoe] ?? bboxRef.current[String(selectedProvince)];
        if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 800 });
      }
      if (selectedDate) fetchData(selectedDate, 'amphoe', mode, selectedProvince, model);
    }
  }, [selectedDate, mode, model, selectedProvince, selectedAmphoe, selectedTambon, entryFromAllTambon, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrillToAllTambon = useCallback(() => {
    console.log('[WF] handleDrillToAllTambon()');
    dispatch({ type: 'DRILL_TO_ALL_TAMBON' });
    const map = mapRef.current;
    const bbox = bboxRef.current[String(selectedProvince)];
    if (map) {
      map.setMinZoom(null);
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      // Set fill-opacity explicitly: adm3-fill is 0 when arriving from A4 before any tambon fetch
      map.setPaintProperty('adm3-fill', 'fill-opacity', getFillOpacity());
      if (selectedProvince) {
        map.setFilter('adm3-line', ['==', ['slice', ['get', 'adm2_pcode'], 0, 4], `TH${selectedProvince}`]);
      } else {
        map.setFilter('adm3-line', null);
      }
      if (bbox) {
        const camera = map.cameraForBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60 });
        map.easeTo({
          center: camera?.center ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
          zoom: camera?.zoom ?? 6,
          duration: 800,
        });
      }
    }
    if (selectedDate) fetchData(selectedDate, 'tambon', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, fetchData, getFillOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrillToTambon = useCallback(() => {
    console.log('[WF] handleDrillToTambon()');
    dispatch({ type: 'DRILL_TO_TAMBON' });
    const map = mapRef.current;
    const bbox = amphoeBboxRef.current[selectedAmphoe];
    if (map) {
      map.setLayoutProperty('adm2-line', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm2-highlight-inner', 'visibility', 'none');
      map.setLayoutProperty('adm3-fill', 'visibility', 'visible');
      map.setLayoutProperty('adm3-line', 'visibility', 'visible');
      map.setLayoutProperty('adm3-highlight', 'visibility', 'none');
      map.setLayoutProperty('adm3-highlight-inner', 'visibility', 'none');
      map.setFilter('adm3-line', ['==', ['get', 'adm2_pcode'], `TH${selectedAmphoe}`]);
      if (bbox) {
        const camera = map.cameraForBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60 });
        map.easeTo({
          center: camera?.center ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
          zoom: Math.max(8, camera?.zoom ?? 8),
          duration: 800,
        });
        map.once('moveend', () => { map.setMinZoom(8); });
      } else {
        map.setMinZoom(8);
      }
    }
    if (selectedDate) fetchData(selectedDate, 'tambon', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, selectedAmphoe, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTambonSelect = useCallback((tambonId: string) => {
    console.log(`[WF] handleTambonSelect("${tambonId}") — selectedProvince at call time: "${selectedProvince}"`);
    const amphoeId   = tambonId.slice(0, 4);
    const provinceId = tambonId.slice(0, 2);
    dispatch({ type: 'SELECT_TAMBON', id: tambonId });
    const map = mapRef.current;
    const bbox = amphoeBboxRef.current[String(amphoeId)];
    if (!selectedProvince) {
      updateSidebarLists(provinceId);
    }
    updateTambonList(amphoeId);
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
      if (bbox) {
        const camera = map.cameraForBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60 });
        map.easeTo({
          center: camera?.center ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
          zoom: Math.max(8, camera?.zoom ?? 8),
          duration: 800,
        });
        map.once('moveend', () => { map.setMinZoom(8); });
      } else {
        map.setMinZoom(8);
      }
    }
    if (selectedDate) fetchData(selectedDate, 'tambon', mode, selectedProvince, model);
  }, [selectedDate, mode, model, selectedProvince, fetchData, updateTambonList, updateSidebarLists]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    updateTambonList,
    updateSidebarLists,
    handleProvinceSelect,
    handleAmphoeSelect,
    handleAmphoeDeselect,
    handleTambonDeselect,
    handleDrillToTambon,
    handleDrillToAllTambon,
    handleDrillToAllAmphoe,
    handleTambonSelect,
  };
}
