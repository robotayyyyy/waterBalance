// Crop config for the significant land-use (agriculture) overlay.
//
// Keyed by LU_CODE, which matches the `LU_CODE` property carried in the
// {basin}-agriculture PMTiles (see scripts/convert-agriculture-shapefiles.py). Colors are a
// distinguishable categorical palette (Tableau-derived); the legend lets users map colour → crop,
// so exact colour memorization isn't required. Names are bilingual (en/th) from the shapefile.

export type Crop = { code: string; en: string; th: string; color: string };

// Union of all crops across ping + yom (16 distinct LU_CODEs).
export const AGRI_CROPS: Record<string, Crop> = {
  'A101':      { code: 'A101',      en: 'Active paddy field',          th: 'นาข้าว',                 color: '#4E79A7' },
  'A101+A202': { code: 'A101+A202', en: 'Active paddy field+Corn',     th: 'นาข้าว+ข้าวโพด',          color: '#A0CBE8' },
  'A201':      { code: 'A201',      en: 'Mixed field crop',            th: 'พืชไร่ผสม',               color: '#59A14F' },
  'A202':      { code: 'A202',      en: 'Corn',                        th: 'ข้าวโพด',                 color: '#B6992D' },
  'A203':      { code: 'A203',      en: 'Sugarcane',                   th: 'อ้อย',                    color: '#8CD17D' },
  'A204':      { code: 'A204',      en: 'Cassava',                     th: 'มันสำปะหลัง',              color: '#9D7660' },
  'A216':      { code: 'A216',      en: 'Upland rice',                 th: 'ข้าวไร่',                  color: '#F1CE63' },
  'A302':      { code: 'A302',      en: 'Para rubber',                 th: 'ยางพารา',                 color: '#499894' },
  'A304':      { code: 'A304',      en: 'Eucalyptus',                  th: 'ยูคาลิปตัส',               color: '#86BCB6' },
  'A305':      { code: 'A305',      en: 'Teak',                        th: 'สัก',                     color: '#2C6E49' },
  'A401':      { code: 'A401',      en: 'Mixed orchard',               th: 'ไม้ผลผสม',                color: '#E15759' },
  'A402':      { code: 'A402',      en: 'Orange',                      th: 'ส้ม',                     color: '#F28E2B' },
  'A407':      { code: 'A407',      en: 'Mango',                       th: 'มะม่วง',                  color: '#FF9D9A' },
  'A413':      { code: 'A413',      en: 'Longan',                      th: 'ลำไย',                    color: '#D37295' },
  'A407/A413': { code: 'A407/A413', en: 'Mango/Longan',                th: 'มะม่วง/ลำไย',             color: '#B07AA1' },
  'A602':      { code: 'A602',      en: 'Corn(Shifting cultivation)',  th: 'ข้าวโพด(ไร่หมุนเวียน)',   color: '#79706E' },
};

// Crops present in each basin, in legend order (grouped loosely by LUL2 family).
export const AGRI_CROPS_BY_BASIN: Record<'ping' | 'yom', string[]> = {
  ping: ['A101', 'A216', 'A201', 'A202', 'A203', 'A204', 'A304', 'A401', 'A407', 'A413', 'A407/A413', 'A602'],
  yom:  ['A101', 'A101+A202', 'A202', 'A203', 'A204', 'A302', 'A305', 'A401', 'A402', 'A602'],
};

export const AGRI_FALLBACK_COLOR = '#BAB0AC';

// MapLibre fill-color match expression: LU_CODE → crop colour (fallback grey for anything unlisted).
export function agricultureColorExpr(): unknown[] {
  const expr: unknown[] = ['match', ['get', 'LU_CODE']];
  for (const c of Object.values(AGRI_CROPS)) expr.push(c.code, c.color);
  expr.push(AGRI_FALLBACK_COLOR);
  return expr;
}
