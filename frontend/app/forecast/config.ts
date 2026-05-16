// Feature flags (baked at build time via NEXT_PUBLIC_* env vars)

// Show/hide geographic IDs in sidebars and table. Defaults to false.
export const SHOW_ID = process.env.NEXT_PUBLIC_SHOW_ID === 'true';

// Enable sub-basin L2 level. Defaults to false.
export const ENABLE_L2 = process.env.NEXT_PUBLIC_ENABLE_SUBBASIN_L2 === 'true';

// Enable "Show all Tambon" drill button in admin map sidebar. Defaults to false.
export const ENABLE_ADMIN_TAMBON = process.env.NEXT_PUBLIC_ENABLE_ADMIN_TAMBON === 'true';
