-- ============================================================
-- Basin forecast tables for SWAT model output data
-- Two forecast models: 7days (Week/) and 6months (Month/)
-- Three levels: watershed, subbasin_l1 (SB_CODE), subbasin_l2 (Sbswat)
-- Two basins: Ping (MB_CODE=06), Yom (MB_CODE=08)
-- Total: 6 tables (denormalized, matching existing forecast table pattern)
-- ============================================================

-- ============================================================
-- WATERSHED LEVEL (whole basin: Ping or Yom)
-- Source: Bonwr_Aggregated.csv
-- ============================================================

CREATE TABLE IF NOT EXISTS basin_watershed_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL,
    mb_name_t     VARCHAR(50),
    rainfall      NUMERIC(15,6),
    reservoir     NUMERIC(15,6),
    watersupply   NUMERIC(15,6),
    water_demand  NUMERIC(15,6),
    water_balance NUMERIC(15,6),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bw7_date_sim ON basin_watershed_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_bw7_mb_code  ON basin_watershed_7days(mb_code);

-- --

CREATE TABLE IF NOT EXISTS basin_watershed_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL,
    mb_name_t     VARCHAR(50),
    rainfall      NUMERIC(15,6),
    reservoir     NUMERIC(15,6),
    watersupply   NUMERIC(15,6),
    water_demand  NUMERIC(15,6),
    water_balance NUMERIC(15,6),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bw6_date_sim ON basin_watershed_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_bw6_mb_code  ON basin_watershed_6months(mb_code);

-- ============================================================
-- SUB-BASIN L1 (official Thai sub-basin zones, SB_CODE)
-- Source: Sbonwr_Aggregated.csv
-- Map: Swat_Results/map/*real sub shapefiles
-- ============================================================

CREATE TABLE IF NOT EXISTS basin_subbasin_l1_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    sb_code       VARCHAR(4) NOT NULL,
    sb_name_t     VARCHAR(100),
    mb_code       VARCHAR(2),
    mb_name_t     VARCHAR(50),
    rainfall      NUMERIC(15,6),
    reservoir     NUMERIC(15,6),
    watersupply   NUMERIC(15,6),
    water_demand  NUMERIC(15,6),
    water_balance NUMERIC(15,6),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bl17_date_sim ON basin_subbasin_l1_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_bl17_mb_code  ON basin_subbasin_l1_7days(mb_code);
CREATE INDEX IF NOT EXISTS idx_bl17_sb_code  ON basin_subbasin_l1_7days(sb_code);

-- --

CREATE TABLE IF NOT EXISTS basin_subbasin_l1_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    sb_code       VARCHAR(4) NOT NULL,
    sb_name_t     VARCHAR(100),
    mb_code       VARCHAR(2),
    mb_name_t     VARCHAR(50),
    rainfall      NUMERIC(15,6),
    reservoir     NUMERIC(15,6),
    watersupply   NUMERIC(15,6),
    water_demand  NUMERIC(15,6),
    water_balance NUMERIC(15,6),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bl16_date_sim ON basin_subbasin_l1_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_bl16_mb_code  ON basin_subbasin_l1_6months(mb_code);
CREATE INDEX IF NOT EXISTS idx_bl16_sb_code  ON basin_subbasin_l1_6months(sb_code);

-- ============================================================
-- SUB-BASIN L2 (SWAT fine-grained sub-watersheds, Sbswat)
-- Source: Analysis_Sbswat.csv
-- Map: Swat_Results/Month|Week/<Basin>/TablesOut/subs.shp
-- ============================================================

CREATE TABLE IF NOT EXISTS basin_subbasin_l2_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    sbswat        INTEGER NOT NULL,
    mb_code       VARCHAR(2),
    mb_name_t     VARCHAR(50),
    rainfall      NUMERIC(15,6),
    reservoir     NUMERIC(15,6),
    watersupply   NUMERIC(15,6),
    water_demand  NUMERIC(15,6),
    water_balance NUMERIC(15,6),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bl27_date_sim ON basin_subbasin_l2_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_bl27_mb_code  ON basin_subbasin_l2_7days(mb_code);
CREATE INDEX IF NOT EXISTS idx_bl27_sbswat   ON basin_subbasin_l2_7days(sbswat);

-- --

CREATE TABLE IF NOT EXISTS basin_subbasin_l2_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    sbswat        INTEGER NOT NULL,
    mb_code       VARCHAR(2),
    mb_name_t     VARCHAR(50),
    rainfall      NUMERIC(15,6),
    reservoir     NUMERIC(15,6),
    watersupply   NUMERIC(15,6),
    water_demand  NUMERIC(15,6),
    water_balance NUMERIC(15,6),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bl26_date_sim ON basin_subbasin_l2_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_bl26_mb_code  ON basin_subbasin_l2_6months(mb_code);
CREATE INDEX IF NOT EXISTS idx_bl26_sbswat   ON basin_subbasin_l2_6months(sbswat);

-- ============================================================
-- Verify
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE 'Basin tables created:';
    RAISE NOTICE '  basin_watershed_7days, basin_watershed_6months';
    RAISE NOTICE '  basin_subbasin_l1_7days, basin_subbasin_l1_6months';
    RAISE NOTICE '  basin_subbasin_l2_7days, basin_subbasin_l2_6months';
END $$;
