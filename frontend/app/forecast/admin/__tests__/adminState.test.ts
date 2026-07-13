import { describe, it, expect } from 'vitest';
import { adminReducer, initialAdminState } from '../adminState';
import type { AdminState } from '../adminState';

function apply(state: AdminState, ...actions: Parameters<typeof adminReducer>[1][]): AdminState {
  return actions.reduce((s, a) => adminReducer(s, a), state);
}

const init = initialAdminState;

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts at province level with nothing selected', () => {
    expect(init.activeLevel).toBe('province');
    expect(init.selectedProvince).toBe('');
    expect(init.selectedAmphoe).toBe('');
    expect(init.selectedTambon).toBe('');
    expect(init.entryFromAllTambon).toBe(false);
    expect(init.entryFromAllAmphoe).toBe(false);
  });
});

// ─── A1 → A3: SELECT_PROVINCE ─────────────────────────────────────────────────

describe('SELECT_PROVINCE', () => {
  it('moves to amphoe level and sets province', () => {
    const next = adminReducer(init, { type: 'SELECT_PROVINCE', id: '50' });
    expect(next.activeLevel).toBe('amphoe');
    expect(next.selectedProvince).toBe('50');
  });

  it('clears amphoe and tambon selections', () => {
    const withAmphoe: AdminState = { ...init, selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '500101', activeLevel: 'tambon' };
    const next = adminReducer(withAmphoe, { type: 'SELECT_PROVINCE', id: '63' });
    expect(next.selectedAmphoe).toBe('');
    expect(next.selectedTambon).toBe('');
  });

  it('selecting different province replaces current province', () => {
    const withProvince = adminReducer(init, { type: 'SELECT_PROVINCE', id: '50' });
    const next = adminReducer(withProvince, { type: 'SELECT_PROVINCE', id: '63' });
    expect(next.selectedProvince).toBe('63');
    expect(next.activeLevel).toBe('amphoe');
  });

  it('clears entryFromAllTambon', () => {
    const inAllTambon: AdminState = { ...init, activeLevel: 'tambon', entryFromAllTambon: true };
    const next = adminReducer(inAllTambon, { type: 'SELECT_PROVINCE', id: '50' });
    expect(next.entryFromAllTambon).toBe(false);
  });

  it('clears entryFromAllAmphoe', () => {
    const inAllAmphoe: AdminState = { ...init, activeLevel: 'amphoe', entryFromAllAmphoe: true };
    const next = adminReducer(inAllAmphoe, { type: 'SELECT_PROVINCE', id: '50' });
    expect(next.entryFromAllAmphoe).toBe(false);
  });
});

// ─── A3/A2 → A1: DESELECT_PROVINCE ────────────────────────────────────────────

describe('DESELECT_PROVINCE', () => {
  it('resets to initial state', () => {
    const withProvince = adminReducer(init, { type: 'SELECT_PROVINCE', id: '50' });
    const next = adminReducer(withProvince, { type: 'DESELECT_PROVINCE' });
    expect(next).toEqual(initialAdminState);
  });

  it('clears everything even from deep tambon state', () => {
    const deep = apply(init,
      { type: 'SELECT_PROVINCE', id: '50' },
      { type: 'SELECT_AMPHOE', id: '5001' },
      { type: 'SELECT_TAMBON', id: '500101' },
    );
    const next = adminReducer(deep, { type: 'DESELECT_PROVINCE' });
    expect(next).toEqual(initialAdminState);
  });

  it('clears entryFromAllTambon', () => {
    const inAllTambon: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: true, entryFromAllAmphoe: false };
    const next = adminReducer(inAllTambon, { type: 'DESELECT_PROVINCE' });
    expect(next).toEqual(initialAdminState);
  });

  it('clears entryFromAllAmphoe', () => {
    const inAllAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: true };
    const next = adminReducer(inAllAmphoe, { type: 'DESELECT_PROVINCE' });
    expect(next).toEqual(initialAdminState);
  });
});

// ─── A3/A4: SELECT_AMPHOE ──────────────────────────────────────────────────────

describe('SELECT_AMPHOE', () => {
  const atAmphoeLevel: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };

  it('selects amphoe and stays at amphoe level', () => {
    const next = adminReducer(atAmphoeLevel, { type: 'SELECT_AMPHOE', id: '5001' });
    expect(next.activeLevel).toBe('amphoe');
    expect(next.selectedAmphoe).toBe('5001');
  });

  it('clears tambon when selecting amphoe', () => {
    const withTambon: AdminState = { ...atAmphoeLevel, selectedTambon: '500101', activeLevel: 'tambon' };
    const next = adminReducer(withTambon, { type: 'SELECT_AMPHOE', id: '5002' });
    expect(next.selectedTambon).toBe('');
  });

  it('id="" enters amphoe overview with no amphoe selected (re-click province)', () => {
    const next = adminReducer(atAmphoeLevel, { type: 'SELECT_AMPHOE', id: '' });
    expect(next.activeLevel).toBe('amphoe');
    expect(next.selectedAmphoe).toBe('');
    expect(next.selectedProvince).toBe('50');
  });

  it('preserves selectedProvince when selecting amphoe', () => {
    const next = adminReducer(atAmphoeLevel, { type: 'SELECT_AMPHOE', id: '5001' });
    expect(next.selectedProvince).toBe('50');
  });

  it('clears entryFromAllTambon', () => {
    const inAllTambon: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: true, entryFromAllAmphoe: false };
    const next = adminReducer(inAllTambon, { type: 'SELECT_AMPHOE', id: '5001' });
    expect(next.entryFromAllTambon).toBe(false);
  });

  // ─── All Amphoe: derive province from amphoe ID (mirrors SELECT_TAMBON deriving province+amphoe) ───

  describe('when entering from All Amphoe (province not yet selected)', () => {
    const allAmphoeView: AdminState = { activeLevel: 'amphoe', selectedProvince: '', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: true };

    it('derives province from amphoe ID when selectedProvince is empty', () => {
      const next = adminReducer(allAmphoeView, { type: 'SELECT_AMPHOE', id: '5001' });
      expect(next.selectedProvince).toBe('50');
      expect(next.selectedAmphoe).toBe('5001');
    });

    it('preserves entryFromAllAmphoe=true after selecting an amphoe', () => {
      const next = adminReducer(allAmphoeView, { type: 'SELECT_AMPHOE', id: '5001' });
      expect(next.entryFromAllAmphoe).toBe(true);
    });

    it('stays at amphoe level (select, not drill to tambon)', () => {
      const next = adminReducer(allAmphoeView, { type: 'SELECT_AMPHOE', id: '5001' });
      expect(next.activeLevel).toBe('amphoe');
      expect(next.selectedTambon).toBe('');
    });

    it('id="" (dismiss to all-amphoe overview) does not derive a province from an empty ID', () => {
      const next = adminReducer(allAmphoeView, { type: 'SELECT_AMPHOE', id: '' });
      expect(next.selectedProvince).toBe('');
      expect(next.selectedAmphoe).toBe('');
    });

    it('re-derives province on cross-province re-select (no stale province)', () => {
      const first = adminReducer(allAmphoeView, { type: 'SELECT_AMPHOE', id: '5001' });
      expect(first.selectedProvince).toBe('50');

      const second = adminReducer(first, { type: 'SELECT_AMPHOE', id: '6301' });
      expect(second.selectedProvince).toBe('63');
      expect(second.selectedAmphoe).toBe('6301');
      expect(second.entryFromAllAmphoe).toBe(true);
    });
  });

  it('preserves entryFromAllAmphoe=false when selecting from a normal (non-All-Amphoe) state', () => {
    const next = adminReducer(atAmphoeLevel, { type: 'SELECT_AMPHOE', id: '5001' });
    expect(next.entryFromAllAmphoe).toBe(false);
  });
});

// ─── A4 → A2: DESELECT_AMPHOE ──────────────────────────────────────────────────

describe('DESELECT_AMPHOE', () => {
  describe('when entryFromAllAmphoe=false (normal path → back to province level)', () => {
    it('goes back to province level and clears amphoe+tambon', () => {
      const withAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
      const next = adminReducer(withAmphoe, { type: 'DESELECT_AMPHOE' });
      expect(next.activeLevel).toBe('province');
      expect(next.selectedAmphoe).toBe('');
      expect(next.selectedTambon).toBe('');
    });

    it('preserves selectedProvince (A2 state)', () => {
      const withAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
      const next = adminReducer(withAmphoe, { type: 'DESELECT_AMPHOE' });
      expect(next.selectedProvince).toBe('50');
    });

    it('clears entryFromAllTambon (even from A7 via entryFromAllTambon=true)', () => {
      const inA7AllTambon: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '500101', entryFromAllTambon: true, entryFromAllAmphoe: false };
      const next = adminReducer(inA7AllTambon, { type: 'DESELECT_AMPHOE' });
      expect(next.entryFromAllTambon).toBe(false);
      expect(next.activeLevel).toBe('province');
    });

    it('keeps entryFromAllAmphoe=false', () => {
      const withAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
      const next = adminReducer(withAmphoe, { type: 'DESELECT_AMPHOE' });
      expect(next.entryFromAllAmphoe).toBe(false);
    });
  });

  describe('when entryFromAllAmphoe=true (All Amphoe path → back to all-amphoe view)', () => {
    const selectedWithinAllAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: true };

    it('stays at amphoe level (not province)', () => {
      const next = adminReducer(selectedWithinAllAmphoe, { type: 'DESELECT_AMPHOE' });
      expect(next.activeLevel).toBe('amphoe');
    });

    it('clears province and amphoe (back to unfiltered All Amphoe view)', () => {
      const next = adminReducer(selectedWithinAllAmphoe, { type: 'DESELECT_AMPHOE' });
      expect(next.selectedProvince).toBe('');
      expect(next.selectedAmphoe).toBe('');
    });

    it('clears tambon', () => {
      const next = adminReducer(selectedWithinAllAmphoe, { type: 'DESELECT_AMPHOE' });
      expect(next.selectedTambon).toBe('');
    });

    it('keeps entryFromAllAmphoe=true (still in All Amphoe mode)', () => {
      const next = adminReducer(selectedWithinAllAmphoe, { type: 'DESELECT_AMPHOE' });
      expect(next.entryFromAllAmphoe).toBe(true);
    });
  });
});

// ─── A4 → A5: DRILL_TO_TAMBON ──────────────────────────────────────────────────

describe('DRILL_TO_TAMBON', () => {
  it('moves to tambon level, clears tambon, keeps province+amphoe', () => {
    const withAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withAmphoe, { type: 'DRILL_TO_TAMBON' });
    expect(next.activeLevel).toBe('tambon');
    expect(next.selectedTambon).toBe('');
    expect(next.selectedProvince).toBe('50');
    expect(next.selectedAmphoe).toBe('5001');
  });

  it('sets entryFromAllTambon=false (normal drill path)', () => {
    const withAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withAmphoe, { type: 'DRILL_TO_TAMBON' });
    expect(next.entryFromAllTambon).toBe(false);
  });

  it('clears entryFromAllAmphoe (exits amphoe scope)', () => {
    const withinAllAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: true };
    const next = adminReducer(withinAllAmphoe, { type: 'DRILL_TO_TAMBON' });
    expect(next.entryFromAllAmphoe).toBe(false);
  });
});

// ─── any → A6: DRILL_TO_ALL_TAMBON ────────────────────────────────────────────

describe('DRILL_TO_ALL_TAMBON', () => {
  it('moves to tambon level and clears amphoe+tambon', () => {
    const withAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withAmphoe, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(next.activeLevel).toBe('tambon');
    expect(next.selectedAmphoe).toBe('');
    expect(next.selectedTambon).toBe('');
  });

  it('preserves selectedProvince', () => {
    const withProvince: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withProvince, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(next.selectedProvince).toBe('50');
  });

  it('works from province level (no province selected)', () => {
    const next = adminReducer(init, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(next.activeLevel).toBe('tambon');
    expect(next.selectedProvince).toBe('');
    expect(next.selectedAmphoe).toBe('');
  });

  it('sets entryFromAllTambon=true (A6 marker)', () => {
    const withAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withAmphoe, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(next.entryFromAllTambon).toBe(true);
  });

  it('sets entryFromAllTambon=true even from A1 (no province)', () => {
    const next = adminReducer(init, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(next.entryFromAllTambon).toBe(true);
  });

  it('clears entryFromAllAmphoe (exclusive with entryFromAllTambon)', () => {
    const withinAllAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: true };
    const next = adminReducer(withinAllAmphoe, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(next.entryFromAllAmphoe).toBe(false);
    expect(next.entryFromAllTambon).toBe(true);
  });
});

// ─── any → AA1: DRILL_TO_ALL_AMPHOE ───────────────────────────────────────────
// "AA1" = All Amphoe unfiltered view (mirrors A6 for tambons), one level up.

describe('DRILL_TO_ALL_AMPHOE', () => {
  it('moves to amphoe level and clears province+amphoe+tambon', () => {
    const withProvince: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withProvince, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(next.activeLevel).toBe('amphoe');
    expect(next.selectedProvince).toBe('');
    expect(next.selectedAmphoe).toBe('');
    expect(next.selectedTambon).toBe('');
  });

  it('clears amphoe+tambon+province even from deep tambon state', () => {
    const deep = apply(init,
      { type: 'SELECT_PROVINCE', id: '50' },
      { type: 'SELECT_AMPHOE', id: '5001' },
      { type: 'SELECT_TAMBON', id: '500101' },
    );
    const next = adminReducer(deep, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(next.activeLevel).toBe('amphoe');
    expect(next.selectedProvince).toBe('');
    expect(next.selectedAmphoe).toBe('');
    expect(next.selectedTambon).toBe('');
  });

  it('works from province level (A1, nothing selected)', () => {
    const next = adminReducer(init, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(next.activeLevel).toBe('amphoe');
    expect(next.selectedProvince).toBe('');
  });

  it('sets entryFromAllAmphoe=true (AA1 marker)', () => {
    const next = adminReducer(init, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(next.entryFromAllAmphoe).toBe(true);
  });

  it('sets entryFromAllAmphoe=true even from a normal province+amphoe state', () => {
    const withProvince: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withProvince, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(next.entryFromAllAmphoe).toBe(true);
  });

  it('clears entryFromAllTambon (exclusive with entryFromAllAmphoe)', () => {
    const inAllTambon: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: true, entryFromAllAmphoe: false };
    const next = adminReducer(inAllTambon, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(next.entryFromAllTambon).toBe(false);
    expect(next.entryFromAllAmphoe).toBe(true);
  });
});

// ─── A5/A6: SELECT_TAMBON ────────────────────────────────────────────

describe('SELECT_TAMBON', () => {
  it('selects tambon and derives amphoe+province from ID', () => {
    const next = adminReducer(init, { type: 'SELECT_TAMBON', id: '500101' });
    expect(next.activeLevel).toBe('tambon');
    expect(next.selectedTambon).toBe('500101');
    expect(next.selectedAmphoe).toBe('5001');
    expect(next.selectedProvince).toBe('50');
  });

  it('preserves existing selectedProvince if already set', () => {
    const withProvince: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withProvince, { type: 'SELECT_TAMBON', id: '500101' });
    expect(next.selectedProvince).toBe('50');
  });

  it('derives province from tambon ID when selectedProvince is empty (All Tambons entry)', () => {
    const next = adminReducer(init, { type: 'SELECT_TAMBON', id: '630101' });
    expect(next.selectedProvince).toBe('63');
    expect(next.selectedAmphoe).toBe('6301');
  });

  it('selecting different tambon in same amphoe updates only tambon', () => {
    const withTambon: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '500101', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(withTambon, { type: 'SELECT_TAMBON', id: '500102' });
    expect(next.selectedTambon).toBe('500102');
    expect(next.selectedAmphoe).toBe('5001');
    expect(next.selectedProvince).toBe('50');
  });

  it('preserves entryFromAllTambon=false when selecting from A5', () => {
    const a5: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const next = adminReducer(a5, { type: 'SELECT_TAMBON', id: '500101' });
    expect(next.entryFromAllTambon).toBe(false);
  });

  it('preserves entryFromAllTambon=true when selecting from A6 (All Tambons path)', () => {
    const a6: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: true, entryFromAllAmphoe: false };
    const next = adminReducer(a6, { type: 'SELECT_TAMBON', id: '500201' });
    expect(next.entryFromAllTambon).toBe(true);
    expect(next.selectedAmphoe).toBe('5002');
  });

  it('clears entryFromAllAmphoe (selecting a tambon always exits amphoe scope)', () => {
    const withinAllAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: true };
    const next = adminReducer(withinAllAmphoe, { type: 'SELECT_TAMBON', id: '500101' });
    expect(next.entryFromAllAmphoe).toBe(false);
  });
});

// ─── A7 → A4/A6: DESELECT_TAMBON ─────────────────────────────────────────────

describe('DESELECT_TAMBON', () => {
  describe('when entryFromAllTambon=false (normal drill path → back to A4)', () => {
    const withTambon: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '500101', entryFromAllTambon: false, entryFromAllAmphoe: false };

    it('goes back to amphoe level and clears tambon', () => {
      const next = adminReducer(withTambon, { type: 'DESELECT_TAMBON' });
      expect(next.activeLevel).toBe('amphoe');
      expect(next.selectedTambon).toBe('');
    });

    it('preserves province and amphoe', () => {
      const next = adminReducer(withTambon, { type: 'DESELECT_TAMBON' });
      expect(next.selectedProvince).toBe('50');
      expect(next.selectedAmphoe).toBe('5001');
    });

    it('keeps entryFromAllTambon=false', () => {
      const next = adminReducer(withTambon, { type: 'DESELECT_TAMBON' });
      expect(next.entryFromAllTambon).toBe(false);
    });
  });

  describe('when entryFromAllTambon=true (All Tambons path → back to A6)', () => {
    const withTambon: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '5001', selectedTambon: '500101', entryFromAllTambon: true, entryFromAllAmphoe: false };

    it('stays at tambon level (not amphoe)', () => {
      const next = adminReducer(withTambon, { type: 'DESELECT_TAMBON' });
      expect(next.activeLevel).toBe('tambon');
    });

    it('clears tambon and amphoe (back to A6-province-filter)', () => {
      const next = adminReducer(withTambon, { type: 'DESELECT_TAMBON' });
      expect(next.selectedTambon).toBe('');
      expect(next.selectedAmphoe).toBe('');
    });

    it('preserves province', () => {
      const next = adminReducer(withTambon, { type: 'DESELECT_TAMBON' });
      expect(next.selectedProvince).toBe('50');
    });

    it('keeps entryFromAllTambon=true (still in All Tambons mode)', () => {
      const next = adminReducer(withTambon, { type: 'DESELECT_TAMBON' });
      expect(next.entryFromAllTambon).toBe(true);
    });
  });
});

// ─── RESET ─────────────────────────────────────────────────────────────────────

describe('RESET', () => {
  it('returns to initial state from any depth', () => {
    const deep = apply(init,
      { type: 'SELECT_PROVINCE', id: '50' },
      { type: 'SELECT_AMPHOE', id: '5001' },
      { type: 'SELECT_TAMBON', id: '500101' },
    );
    expect(adminReducer(deep, { type: 'RESET' })).toEqual(initialAdminState);
  });

  it('clears entryFromAllTambon', () => {
    const inAllTambon: AdminState = { activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: true, entryFromAllAmphoe: false };
    expect(adminReducer(inAllTambon, { type: 'RESET' })).toEqual(initialAdminState);
  });

  it('clears entryFromAllAmphoe', () => {
    const inAllAmphoe: AdminState = { activeLevel: 'amphoe', selectedProvince: '', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: true };
    expect(adminReducer(inAllAmphoe, { type: 'RESET' })).toEqual(initialAdminState);
  });
});

// ─── Full navigation flows ─────────────────────────────────────────────────────

describe('full navigation flows', () => {
  it('A1 → A3 → A4 → A5 → A7 forward drill', () => {
    const s1 = adminReducer(init, { type: 'SELECT_PROVINCE', id: '50' });
    expect(s1).toMatchObject({ activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '' });

    const s2 = adminReducer(s1, { type: 'SELECT_AMPHOE', id: '5001' });
    expect(s2).toMatchObject({ activeLevel: 'amphoe', selectedAmphoe: '5001' });

    const s3 = adminReducer(s2, { type: 'DRILL_TO_TAMBON' });
    expect(s3).toMatchObject({ activeLevel: 'tambon', selectedAmphoe: '5001', selectedTambon: '', entryFromAllTambon: false });

    const s4 = adminReducer(s3, { type: 'SELECT_TAMBON', id: '500101' });
    expect(s4).toMatchObject({ activeLevel: 'tambon', selectedTambon: '500101', entryFromAllTambon: false });
  });

  it('full deselect cycle A7 → A4 → A2 → A1', () => {
    const deep = apply(init,
      { type: 'SELECT_PROVINCE', id: '50' },
      { type: 'SELECT_AMPHOE', id: '5001' },
      { type: 'SELECT_TAMBON', id: '500101' },
    );

    const s1 = adminReducer(deep, { type: 'DESELECT_TAMBON' });
    expect(s1).toMatchObject({ activeLevel: 'amphoe', selectedTambon: '', selectedAmphoe: '5001' });

    const s2 = adminReducer(s1, { type: 'DESELECT_AMPHOE' });
    expect(s2).toMatchObject({ activeLevel: 'province', selectedAmphoe: '', selectedProvince: '50' });

    const s3 = adminReducer(s2, { type: 'DESELECT_PROVINCE' });
    expect(s3).toEqual(initialAdminState);
  });

  it('A2 (after amphoe deselect) → re-click province → back to A3', () => {
    const a2 = apply(init,
      { type: 'SELECT_PROVINCE', id: '50' },
      { type: 'SELECT_AMPHOE', id: '5001' },
      { type: 'DESELECT_AMPHOE' },
    );
    expect(a2).toMatchObject({ activeLevel: 'province', selectedProvince: '50', selectedAmphoe: '' });

    const next = adminReducer(a2, { type: 'SELECT_AMPHOE', id: '' });
    expect(next).toMatchObject({ activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '' });
  });

  it('All Tambons from A4 → A6, then tambon select → A7 with derived province+amphoe', () => {
    const a4 = apply(init,
      { type: 'SELECT_PROVINCE', id: '50' },
      { type: 'SELECT_AMPHOE', id: '5001' },
    );

    const a6 = adminReducer(a4, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(a6).toMatchObject({ activeLevel: 'tambon', selectedAmphoe: '', selectedProvince: '50', entryFromAllTambon: true });

    const a7 = adminReducer(a6, { type: 'SELECT_TAMBON', id: '500201' });
    expect(a7).toMatchObject({ activeLevel: 'tambon', selectedProvince: '50', selectedAmphoe: '5002', selectedTambon: '500201', entryFromAllTambon: true });
  });

  it('All Tambons flow: A6 → select tambon (A7) → deselect tambon → back to A6', () => {
    const a6 = apply(init,
      { type: 'SELECT_PROVINCE', id: '50' },
      { type: 'DRILL_TO_ALL_TAMBON' },
    );
    expect(a6.entryFromAllTambon).toBe(true);

    const a7 = adminReducer(a6, { type: 'SELECT_TAMBON', id: '500201' });
    expect(a7).toMatchObject({ selectedTambon: '500201', selectedAmphoe: '5002', entryFromAllTambon: true });

    const backToA6 = adminReducer(a7, { type: 'DESELECT_TAMBON' });
    expect(backToA6).toMatchObject({
      activeLevel: 'tambon',
      selectedProvince: '50',
      selectedAmphoe: '',
      selectedTambon: '',
      entryFromAllTambon: true,
    });
  });

  it('Dismiss All Tambons (A6-province-filter): empty click → SELECT_PROVINCE → A3', () => {
    const a6 = apply(init,
      { type: 'SELECT_PROVINCE', id: '51' },
      { type: 'DRILL_TO_ALL_TAMBON' },
    );
    expect(a6.entryFromAllTambon).toBe(true);

    // handleTambonDeselect dispatches SELECT_PROVINCE when selectedTambon='' and entryFromAllTambon=true
    const a3 = adminReducer(a6, { type: 'SELECT_PROVINCE', id: '51' });
    expect(a3).toMatchObject({
      activeLevel: 'amphoe',
      selectedProvince: '51',
      selectedAmphoe: '',
      selectedTambon: '',
      entryFromAllTambon: false,
    });
  });

  it('Dismiss All Tambons (A6-no-filter): empty click → DESELECT_PROVINCE → A1', () => {
    const a6NoFilter = adminReducer(init, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(a6NoFilter).toMatchObject({ selectedProvince: '', entryFromAllTambon: true });

    // handleTambonDeselect dispatches DESELECT_PROVINCE when selectedTambon='' and entryFromAllTambon=true and no province
    const a1 = adminReducer(a6NoFilter, { type: 'DESELECT_PROVINCE' });
    expect(a1).toEqual(initialAdminState);
  });

  it('All Tambons from A1 (no province) → A6-no-filter → select tambon → deselect → back to A6', () => {
    const a6NoFilter = adminReducer(init, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(a6NoFilter).toMatchObject({ activeLevel: 'tambon', selectedProvince: '', entryFromAllTambon: true });

    const a7 = adminReducer(a6NoFilter, { type: 'SELECT_TAMBON', id: '630101' });
    expect(a7).toMatchObject({ selectedProvince: '63', selectedAmphoe: '6301', selectedTambon: '630101', entryFromAllTambon: true });

    const backToA6 = adminReducer(a7, { type: 'DESELECT_TAMBON' });
    expect(backToA6).toMatchObject({
      activeLevel: 'tambon',
      selectedProvince: '63',
      selectedAmphoe: '',
      selectedTambon: '',
      entryFromAllTambon: true,
    });
  });

  // ─── All Amphoe flows (AA1 = unfiltered all-amphoe view, mirrors A6 one level up) ───

  it('All Amphoe from A1 → AA1, then amphoe select → derived province, stays at amphoe level (no drill)', () => {
    const aa1 = adminReducer(init, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(aa1).toMatchObject({ activeLevel: 'amphoe', selectedProvince: '', selectedAmphoe: '', entryFromAllAmphoe: true });

    const selected = adminReducer(aa1, { type: 'SELECT_AMPHOE', id: '5001' });
    expect(selected).toMatchObject({
      activeLevel: 'amphoe',
      selectedProvince: '50',
      selectedAmphoe: '5001',
      selectedTambon: '',
      entryFromAllAmphoe: true,
    });
  });

  it('All Amphoe flow: AA1 → select amphoe → deselect amphoe → back to AA1', () => {
    const aa1 = adminReducer(init, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(aa1.entryFromAllAmphoe).toBe(true);

    const selected = adminReducer(aa1, { type: 'SELECT_AMPHOE', id: '5001' });
    expect(selected).toMatchObject({ selectedProvince: '50', selectedAmphoe: '5001', entryFromAllAmphoe: true });

    const backToAA1 = adminReducer(selected, { type: 'DESELECT_AMPHOE' });
    expect(backToAA1).toMatchObject({
      activeLevel: 'amphoe',
      selectedProvince: '',
      selectedAmphoe: '',
      selectedTambon: '',
      entryFromAllAmphoe: true,
    });
  });

  it('All Amphoe from a normal A4 state (province+amphoe selected) → AA1 clears both', () => {
    const a4 = apply(init,
      { type: 'SELECT_PROVINCE', id: '50' },
      { type: 'SELECT_AMPHOE', id: '5001' },
    );
    const aa1 = adminReducer(a4, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(aa1).toMatchObject({ activeLevel: 'amphoe', selectedProvince: '', selectedAmphoe: '', entryFromAllAmphoe: true });
  });

  it('cross-flag: All Amphoe (AA1) → DRILL_TO_ALL_TAMBON swaps flags (never both true)', () => {
    const aa1 = adminReducer(init, { type: 'DRILL_TO_ALL_AMPHOE' });
    const a6 = adminReducer(aa1, { type: 'DRILL_TO_ALL_TAMBON' });
    expect(a6).toMatchObject({ entryFromAllAmphoe: false, entryFromAllTambon: true });
  });

  it('cross-flag: All Tambons (A6) → DRILL_TO_ALL_AMPHOE swaps flags (never both true)', () => {
    const a6 = adminReducer(init, { type: 'DRILL_TO_ALL_TAMBON' });
    const aa1 = adminReducer(a6, { type: 'DRILL_TO_ALL_AMPHOE' });
    expect(aa1).toMatchObject({ entryFromAllTambon: false, entryFromAllAmphoe: true });
  });
});

// ─── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('never mutates input state', () => {
    const state: AdminState = { activeLevel: 'amphoe', selectedProvince: '50', selectedAmphoe: '', selectedTambon: '', entryFromAllTambon: false, entryFromAllAmphoe: false };
    const frozen = Object.freeze(state);
    expect(() => adminReducer(frozen, { type: 'SELECT_AMPHOE', id: '5001' })).not.toThrow();
  });

  it('never mutates input state for DRILL_TO_ALL_AMPHOE', () => {
    const frozen = Object.freeze({ ...initialAdminState });
    expect(() => adminReducer(frozen, { type: 'DRILL_TO_ALL_AMPHOE' })).not.toThrow();
  });
});
