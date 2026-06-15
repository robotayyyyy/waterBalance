/**
 * Pure admin navigation state machine.
 *
 * No React, no MapLibre. Takes current state + action, returns next state.
 * Map layer calls, camera animations, and geo list updates are side effects
 * handled by the caller (useSelectionHandlers / ProtoLayout / ForecastMap).
 */

export type AdminLevel = 'province' | 'amphoe' | 'tambon';

export type AdminState = {
  activeLevel: AdminLevel;
  selectedProvince: string;
  selectedAmphoe: string;
  selectedTambon: string;
  entryFromAllTambon: boolean;
};

export type AdminAction =
  | { type: 'SELECT_PROVINCE';    id: string }   // click province → A3
  | { type: 'DESELECT_PROVINCE'              }   // × province    → A1
  | { type: 'SELECT_AMPHOE';      id: string }   // click amphoe (id='' = overview) → A3/A4
  | { type: 'DESELECT_AMPHOE'               }   // × amphoe      → A2
  | { type: 'DRILL_TO_TAMBON'               }   // re-click selected amphoe → A5
  | { type: 'DRILL_TO_ALL_TAMBON'           }   // "All Tambons" button → A6
  | { type: 'SELECT_TAMBON';      id: string }   // click tambon  → A7 (derives province+amphoe)
  | { type: 'DESELECT_TAMBON'               }   // × tambon → A4 (normal) or A6 (if entryFromAllTambon)
  | { type: 'RESET'                         };  // switch view mode → A1

export const initialAdminState: AdminState = {
  activeLevel:        'province',
  selectedProvince:   '',
  selectedAmphoe:     '',
  selectedTambon:     '',
  entryFromAllTambon: false,
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
      };

    case 'DESELECT_PROVINCE':
      return initialAdminState;

    // id='' → amphoe overview (all amphoes colored, none selected)
    case 'SELECT_AMPHOE':
      return {
        ...state,
        activeLevel:        'amphoe',
        selectedAmphoe:     action.id,
        selectedTambon:     '',
        entryFromAllTambon: false,
      };

    // back from amphoe → province still in view but at province level
    case 'DESELECT_AMPHOE':
      return {
        ...state,
        activeLevel:        'province',
        selectedAmphoe:     '',
        selectedTambon:     '',
        entryFromAllTambon: false,
      };

    case 'DRILL_TO_TAMBON':
      return {
        ...state,
        activeLevel:        'tambon',
        selectedTambon:     '',
        entryFromAllTambon: false,
      };

    case 'DRILL_TO_ALL_TAMBON':
      return {
        ...state,
        activeLevel:        'tambon',
        selectedAmphoe:     '',
        selectedTambon:     '',
        entryFromAllTambon: true,
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
        };
      }
      return {
        ...state,
        activeLevel:        'amphoe',
        selectedTambon:     '',
        entryFromAllTambon: false,
      };

    case 'RESET':
      return initialAdminState;
  }
}
