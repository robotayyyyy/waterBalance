'use client';
import { useMemo } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme, modeValue } from '../theme';
import type { Mode, ColorRow } from '../theme';
import SearchableDropdown from './SearchableDropdown';

type Province = { id: string; name: string; name_th?: string };
type GeoItem = { id: string; name: string; name_th?: string; [key: string]: any };

export default function ProvinceSelector({
  provinces, selectedProvince, selectedAmphoe, selectedTambon,
  onSelect, onSelectAmphoe, onDeselectAmphoe, onSelectTambon, onDeselectTambon,
  amphoeList, tambonList, provinceColorData, amphoeColorData, tambonColorData, mode,
}: {
  provinces: Province[];
  selectedProvince: string;
  selectedAmphoe: string;
  selectedTambon: string;
  onSelect: (id: string) => void;
  onSelectAmphoe: (id: string) => void;
  onDeselectAmphoe: () => void;
  onSelectTambon: (id: string) => void;
  onDeselectTambon: () => void;
  amphoeList: GeoItem[];
  tambonList: GeoItem[];
  provinceColorData: ColorRow[];
  amphoeColorData: ColorRow[];
  tambonColorData: ColorRow[];
  mode: Mode;
}) {
  const { t } = useLang();
  const provinceColorMap = useMemo(() => new Map(provinceColorData.map(r => [r.id, modeValue(r, mode)])), [provinceColorData, mode]);
  const amphoeColorMap   = useMemo(() => new Map(amphoeColorData.map(r => [r.id, modeValue(r, mode)])), [amphoeColorData, mode]);
  const tambonColorMap   = useMemo(() => new Map(tambonColorData.map(r => [r.id, modeValue(r, mode)])), [tambonColorData, mode]);

  return (
    <div style={{ padding: '10px 12px' }}>
      <SearchableDropdown
        items={provinces}
        selectedId={selectedProvince || null}
        onSelect={onSelect}
        onDeselect={() => onSelect('')}
        placeholder={t.selector.searchProvince}
        label={t.selector.province}
        colorMap={provinceColorMap}
        mode={mode}
        testId="province-dropdown"
      />
      {selectedProvince && (
        <SearchableDropdown
          items={amphoeList}
          selectedId={selectedAmphoe || null}
          onSelect={onSelectAmphoe}
          onDeselect={onDeselectAmphoe}
          placeholder={t.selector.searchAmphoe}
          label={t.selector.amphoe}
          colorMap={amphoeColorMap}
          mode={mode}
          testId="amphoe-dropdown"
        />
      )}
      {selectedAmphoe && (
        <SearchableDropdown
          items={tambonList}
          selectedId={selectedTambon || null}
          onSelect={onSelectTambon}
          onDeselect={onDeselectTambon}
          placeholder={t.selector.searchTambon}
          label={t.selector.tambon}
          colorMap={tambonColorMap}
          mode={mode}
          testId="tambon-dropdown"
        />
      )}
    </div>
  );
}
