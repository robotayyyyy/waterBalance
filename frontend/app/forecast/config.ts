// Feature flags (baked at build time via NEXT_PUBLIC_* env vars)

// Show/hide geographic IDs in sidebars and table. Defaults to false.
export const SHOW_ID = process.env.NEXT_PUBLIC_SHOW_ID === 'true';

// Guard: auto-resolve rainfall mode + past date conflict (reset date or fall back to waterbalance).
// Defaults to true — set NEXT_PUBLIC_RAINFALL_GUARD=false to disable.
export const ENABLE_RAINFALL_GUARD = process.env.NEXT_PUBLIC_RAINFALL_GUARD !== 'false';
