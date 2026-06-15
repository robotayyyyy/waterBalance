'use client';
import { useMemo } from 'react';
import { useLang } from '../../i18n/LangContext';
import { theme } from '../theme';
import type { Mode } from '../theme';
import SearchableDropdown from './SearchableDropdown';

type Province = { id: string; name: string; name_th?: string };
type GeoItem = { id: string; name: string; name_th?: string; [key: string]: any };

export default function ProvinceSelector({
  provinces, selectedProvince, selectedAmphoe, selectedTambon,
  onSelect, onSelectAmphoe, onDeselectAmphoe, onSelectTambon, onDeselectTambon,
  amphoeList, tambonList, colorData, mode,
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
  colorData: { id: string; value: number }[];
  mode: Mode;
}) {
  const { t } = useLang();
  const colorMap = useMemo(() => new Map(colorData.map(r => [r.id, r.value])), [colorData]);

  return (
    <div style={{ padding: '10px 12px' }}>
      <SearchableDropdown
        items={provinces}
        selectedId={selectedProvince || null}
        onSelect={onSelect}
        onDeselect={() => onSelect('')}
        placeholder={t.selector.searchProvince}
        label={t.selector.province}
        colorMap={colorMap}
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
          colorMap={colorMap}
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
          colorMap={colorMap}
          mode={mode}
          testId="tambon-dropdown"
        />
      )}
    </div>
  );
}
