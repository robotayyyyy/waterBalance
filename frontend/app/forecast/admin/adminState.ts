/**
 * Pure admin navigation state machine.
 *
 * No React, no MapLibre. Takes current state + action, returns next state.
 * Map layer calls, camera animations, and geo list updates are side effects
 * handled by the caller (useSelectionHandlers / ForecastLayout).
 */

export type AdminLevel = 'province' | 'amphoe' | 'tambon';

export type AdminState = {
  activeLevel: AdminLevel;
  selectedProvince: string;
  selectedAmphoe: string;
  selectedTambon: string;
  entryFromAllTambon: boolean;
  entryFromAllAmphoe: boolean;
};

export type AdminAction =
  | { type: 'SELECT_PROVINCE';    id: string }   // click province → A3
  | { type: 'DESELECT_PROVINCE'              }   // × province    → A1
  | { type: 'SELECT_AMPHOE';      id: string }   // click amphoe (id='' = overview) → A3/A4
  | { type: 'DESELECT_AMPHOE'               }   // × amphoe      → A2
  | { type: 'DRILL_TO_TAMBON'               }   // re-click selected amphoe → A5
  | { type: 'DRILL_TO_ALL_TAMBON'           }   // "All Tambons" button → A6
  | { type: 'DRILL_TO_ALL_AMPHOE'           }   // "All Amphoe" button → AA1
  | { type: 'SELECT_TAMBON';      id: string }   // click tambon  → A7 (derives province+amphoe)
  | { type: 'DESELECT_TAMBON'               }   // × tambon → A4 (normal) or A6 (if entryFromAllTambon)
  | { type: 'RESET'                         };  // switch view mode → A1

export const initialAdminState: AdminState = {
  activeLevel:        'province',
  selectedProvince:   '',
  selectedAmphoe:     '',
  selectedTambon:     '',
  entryFromAllTambon: false,
  entryFromAllAmphoe: false,
};

export function adminReducer(state: AdminState, action: AdminAction): AdminState {
  switch (action.type) {

    case 'SELECT_PROVINCE':
      return {
        activeLevel:        'amphoe',
        selectedProvince:   action.id,
        selectedAmphoe:     '',
        selectedTambon:     '',
        entryFromAllTambon: false,
        entryFromAllAmphoe: false,
      };

    case 'DESELECT_PROVINCE':
      return initialAdminState;

    // id='' → amphoe overview (all amphoes colored, none selected)
    // When entering from All Amphoe (entryFromAllAmphoe=true), always re-derive
    // selectedProvince from the amphoe ID — every basin amphoe stays clickable in
    // that view, so a cross-province re-click must not keep a stale province.
    case 'SELECT_AMPHOE': {
      const derivedProvince = state.entryFromAllAmphoe && action.id
        ? action.id.slice(0, 2)
        : state.selectedProvince;
      return {
        ...state,
        activeLevel:        'amphoe',
        selectedProvince:   derivedProvince,
        selectedAmphoe:     action.id,
        selectedTambon:     '',
        entryFromAllTambon: false,
        entryFromAllAmphoe: state.entryFromAllAmphoe,
      };
    }

    // entryFromAllAmphoe=false → A2 (province level, keep province)
    // entryFromAllAmphoe=true  → AA1 (amphoe level, clear province, unfiltered all-amphoe view)
    case 'DESELECT_AMPHOE':
      if (state.entryFromAllAmphoe) {
        return {
          ...state,
          activeLevel:        'amphoe',
          selectedProvince:   '',
          selectedAmphoe:     '',
          selectedTambon:     '',
          entryFromAllTambon: false,
          entryFromAllAmphoe: true,
        };
      }
      return {
        ...state,
        activeLevel:        'province',
        selectedAmphoe:     '',
        selectedTambon:     '',
        entryFromAllTambon: false,
        entryFromAllAmphoe: false,
      };

    case 'DRILL_TO_TAMBON':
      return {
        ...state,
        activeLevel:        'tambon',
        selectedTambon:     '',
        entryFromAllTambon: false,
        entryFromAllAmphoe: false,
      };

    case 'DRILL_TO_ALL_TAMBON':
      return {
        ...state,
        activeLevel:        'tambon',
        selectedAmphoe:     '',
        selectedTambon:     '',
        entryFromAllTambon: true,
        entryFromAllAmphoe: false,
      };

    case 'DRILL_TO_ALL_AMPHOE':
      return {
        ...state,
        activeLevel:        'amphoe',
        selectedProvince:   '',
        selectedAmphoe:     '',
        selectedTambon:     '',
        entryFromAllTambon: false,
        entryFromAllAmphoe: true,
      };

    case 'SELECT_TAMBON': {
      const amphoeId   = action.id.slice(0, 4);
      const provinceId = action.id.slice(0, 2);
      return {
        activeLevel:        'tambon',
        selectedProvince:   state.selectedProvince || provinceId,
        selectedAmphoe:     amphoeId,
        selectedTambon:     action.id,
        entryFromAllTambon: state.entryFromAllTambon,
        entryFromAllAmphoe: false,
      };
    }

    // entryFromAllTambon=false → A4 (amphoe level, keep amphoe)
    // entryFromAllTambon=true  → A6 (tambon level, clear amphoe, keep province)
    case 'DESELECT_TAMBON':
      if (state.entryFromAllTambon) {
        return {
          ...state,
          activeLevel:        'tambon',
          selectedAmphoe:     '',
          selectedTambon:     '',
          entryFromAllTambon: true,
          entryFromAllAmphoe: false,
        };
      }
      return {
        ...state,
        activeLevel:        'amphoe',
        selectedTambon:     '',
        entryFromAllTambon: false,
        entryFromAllAmphoe: false,
      };

    case 'RESET':
      return initialAdminState;
  }
}
