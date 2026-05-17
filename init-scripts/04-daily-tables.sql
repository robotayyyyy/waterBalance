-- ============================================================
-- Daily resolution tables for SWAT model output data
-- Two forecast models: 7days (Week/) and 6months (Month/)
-- Five levels: watershed, subbasin_l1, province, amphoe, tambon
-- (No subbasin_l2 daily — not produced by analysis scripts)
-- Total: 10 tables
-- ============================================================

-- ============================================================
-- WATERSHED LEVEL
-- ============================================================

CREATE TABLE IF NOT EXISTS basin_watershed_daily_7days (
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
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_bwd7_date_sim ON basin_watershed_daily_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_bwd7_mb_code  ON basin_watershed_daily_7days(mb_code);

-- --

CREATE TABLE IF NOT EXISTS basin_watershed_daily_6months (
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
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_bwd6_date_sim ON basin_watershed_daily_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_bwd6_mb_code  ON basin_watershed_daily_6months(mb_code);

-- ============================================================
-- SUB-BASIN L1
-- ============================================================

CREATE TABLE IF NOT EXISTS basin_subbasin_l1_daily_7days (
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
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_bl1d7_date_sim ON basin_subbasin_l1_daily_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_bl1d7_mb_code  ON basin_subbasin_l1_daily_7days(mb_code);
CREATE INDEX IF NOT EXISTS idx_bl1d7_sb_code  ON basin_subbasin_l1_daily_7days(sb_code);

-- --

CREATE TABLE IF NOT EXISTS basin_subbasin_l1_daily_6months (
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
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_bl1d6_date_sim ON basin_subbasin_l1_daily_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_bl1d6_mb_code  ON basin_subbasin_l1_daily_6months(mb_code);
CREATE INDEX IF NOT EXISTS idx_bl1d6_sb_code  ON basin_subbasin_l1_daily_6months(sb_code);

-- ============================================================
-- SUB-BASIN L2 (SWAT fine-grained sub-watersheds, Sbswat)
-- Source: Analysis_Sbswat.csv (daily, no suffix)
-- ============================================================

CREATE TABLE IF NOT EXISTS basin_subbasin_l2_daily_7days (
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
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_bl2d7_date_sim ON basin_subbasin_l2_daily_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_bl2d7_mb_code  ON basin_subbasin_l2_daily_7days(mb_code);
CREATE INDEX IF NOT EXISTS idx_bl2d7_sbswat   ON basin_subbasin_l2_daily_7days(sbswat);

-- --

CREATE TABLE IF NOT EXISTS basin_subbasin_l2_daily_6months (
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
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_bl2d6_date_sim ON basin_subbasin_l2_daily_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_bl2d6_mb_code  ON basin_subbasin_l2_daily_6months(mb_code);
CREATE INDEX IF NOT EXISTS idx_bl2d6_sbswat   ON basin_subbasin_l2_daily_6months(sbswat);

-- ============================================================
-- PROVINCE LEVEL
-- ============================================================

CREATE TABLE IF NOT EXISTS forecast_province_daily_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    province_id   VARCHAR(2) NOT NULL,
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    reservoir     NUMERIC(10,4),
    watersupply   NUMERIC(15,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_fpd7_date_sim    ON forecast_province_daily_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_fpd7_province_id ON forecast_province_daily_7days(province_id);
CREATE INDEX IF NOT EXISTS idx_fpd7_mb_code     ON forecast_province_daily_7days(mb_code);

-- --

CREATE TABLE IF NOT EXISTS forecast_province_daily_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    province_id   VARCHAR(2) NOT NULL,
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    reservoir     NUMERIC(10,4),
    watersupply   NUMERIC(15,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_fpd6_date_sim    ON forecast_province_daily_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_fpd6_province_id ON forecast_province_daily_6months(province_id);
CREATE INDEX IF NOT EXISTS idx_fpd6_mb_code     ON forecast_province_daily_6months(mb_code);

-- ============================================================
-- AMPHOE LEVEL
-- ============================================================

CREATE TABLE IF NOT EXISTS forecast_amphoe_daily_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    amphoe_id     VARCHAR(4) NOT NULL,
    amphoe        VARCHAR(255),
    province_id   VARCHAR(2),
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    reservoir     NUMERIC(10,4),
    watersupply   NUMERIC(15,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_fad7_date_sim    ON forecast_amphoe_daily_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_fad7_amphoe_id   ON forecast_amphoe_daily_7days(amphoe_id);
CREATE INDEX IF NOT EXISTS idx_fad7_mb_code     ON forecast_amphoe_daily_7days(mb_code);

-- --

CREATE TABLE IF NOT EXISTS forecast_amphoe_daily_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    amphoe_id     VARCHAR(4) NOT NULL,
    amphoe        VARCHAR(255),
    province_id   VARCHAR(2),
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    reservoir     NUMERIC(10,4),
    watersupply   NUMERIC(15,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_fad6_date_sim    ON forecast_amphoe_daily_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_fad6_amphoe_id   ON forecast_amphoe_daily_6months(amphoe_id);
CREATE INDEX IF NOT EXISTS idx_fad6_mb_code     ON forecast_amphoe_daily_6months(mb_code);

-- ============================================================
-- TAMBON LEVEL
-- ============================================================

CREATE TABLE IF NOT EXISTS forecast_tambon_daily_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    tambon_id     VARCHAR(6) NOT NULL,
    tambon        VARCHAR(255),
    amphoe_id     VARCHAR(4),
    amphoe        VARCHAR(255),
    province_id   VARCHAR(2),
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    reservoir     NUMERIC(10,4),
    watersupply   NUMERIC(15,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_ftd7_date_sim    ON forecast_tambon_daily_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_ftd7_tambon_id   ON forecast_tambon_daily_7days(tambon_id);
CREATE INDEX IF NOT EXISTS idx_ftd7_mb_code     ON forecast_tambon_daily_7days(mb_code);

-- --

CREATE TABLE IF NOT EXISTS forecast_tambon_daily_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    tambon_id     VARCHAR(6) NOT NULL,
    tambon        VARCHAR(255),
    amphoe_id     VARCHAR(4),
    amphoe        VARCHAR(255),
    province_id   VARCHAR(2),
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    reservoir     NUMERIC(10,4),
    watersupply   NUMERIC(15,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER,
    wb_level      NUMERIC(15,6)
);

CREATE INDEX IF NOT EXISTS idx_ftd6_date_sim    ON forecast_tambon_daily_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_ftd6_tambon_id   ON forecast_tambon_daily_6months(tambon_id);
CREATE INDEX IF NOT EXISTS idx_ftd6_mb_code     ON forecast_tambon_daily_6months(mb_code);

-- ============================================================
-- Verify
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE 'Daily tables created:';
    RAISE NOTICE '  basin_watershed_daily_7days, basin_watershed_daily_6months';
    RAISE NOTICE '  basin_subbasin_l1_daily_7days, basin_subbasin_l1_daily_6months';
    RAISE NOTICE '  basin_subbasin_l2_daily_7days, basin_subbasin_l2_daily_6months';
    RAISE NOTICE '  forecast_province_daily_7days, forecast_province_daily_6months';
    RAISE NOTICE '  forecast_amphoe_daily_7days, forecast_amphoe_daily_6months';
    RAISE NOTICE '  forecast_tambon_daily_7days, forecast_tambon_daily_6months';
END $$;
