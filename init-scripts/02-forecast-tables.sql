-- ============================================================
-- Forecast tables for Thailand water simulation data
-- Two forecast models: 7-day and 6-month
-- Three administrative levels: province, amphoe, tambon
-- Total: 6 tables (intentionally denormalized for scientist-managed CSV imports)
-- ============================================================

-- ============================================================
-- TAMBON LEVEL (ADM3 / Sub-district)
-- ============================================================

CREATE TABLE IF NOT EXISTS forecast_tambon_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    tambon_id     VARCHAR(6) NOT NULL,
    tambon       VARCHAR(255),
    amphoe_id     VARCHAR(4),
    amphoe        VARCHAR(255),
    province_id   VARCHAR(2),
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    watersupply   NUMERIC(15,4),
    reservoir     NUMERIC(10,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ft7_date_sim    ON forecast_tambon_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_ft7_province_id ON forecast_tambon_7days(province_id);
CREATE INDEX IF NOT EXISTS idx_ft7_tambon_id   ON forecast_tambon_7days(tambon_id);
CREATE INDEX IF NOT EXISTS idx_ft7_mb_code     ON forecast_tambon_7days(mb_code);

-- --

CREATE TABLE IF NOT EXISTS forecast_tambon_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    tambon_id     VARCHAR(6) NOT NULL,
    tambon       VARCHAR(255),
    amphoe_id     VARCHAR(4),
    amphoe        VARCHAR(255),
    province_id   VARCHAR(2),
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    watersupply   NUMERIC(15,4),
    reservoir     NUMERIC(10,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ft6_date_sim    ON forecast_tambon_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_ft6_province_id ON forecast_tambon_6months(province_id);
CREATE INDEX IF NOT EXISTS idx_ft6_tambon_id   ON forecast_tambon_6months(tambon_id);
CREATE INDEX IF NOT EXISTS idx_ft6_mb_code     ON forecast_tambon_6months(mb_code);

-- ============================================================
-- AMPHOE LEVEL (ADM2 / District)
-- ============================================================

CREATE TABLE IF NOT EXISTS forecast_amphoe_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    amphoe_id     VARCHAR(4) NOT NULL,
    amphoe        VARCHAR(255),
    province_id   VARCHAR(2),
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    watersupply   NUMERIC(15,4),
    reservoir     NUMERIC(10,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fa7_date_sim    ON forecast_amphoe_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_fa7_province_id ON forecast_amphoe_7days(province_id);
CREATE INDEX IF NOT EXISTS idx_fa7_amphoe_id   ON forecast_amphoe_7days(amphoe_id);
CREATE INDEX IF NOT EXISTS idx_fa7_mb_code     ON forecast_amphoe_7days(mb_code);

-- --

CREATE TABLE IF NOT EXISTS forecast_amphoe_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    amphoe_id     VARCHAR(4) NOT NULL,
    amphoe        VARCHAR(255),
    province_id   VARCHAR(2),
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    watersupply   NUMERIC(15,4),
    reservoir     NUMERIC(10,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fa6_date_sim    ON forecast_amphoe_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_fa6_province_id ON forecast_amphoe_6months(province_id);
CREATE INDEX IF NOT EXISTS idx_fa6_amphoe_id   ON forecast_amphoe_6months(amphoe_id);
CREATE INDEX IF NOT EXISTS idx_fa6_mb_code     ON forecast_amphoe_6months(mb_code);

-- ============================================================
-- PROVINCE LEVEL (ADM1)
-- Note: source CSV uses "Daily_Rainfall" column name — normalized to "rainfall" here
-- ============================================================

CREATE TABLE IF NOT EXISTS forecast_province_7days (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    province_id   VARCHAR(2) NOT NULL,
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    watersupply   NUMERIC(15,4),
    reservoir     NUMERIC(10,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fp7_date_sim    ON forecast_province_7days(date_sim);
CREATE INDEX IF NOT EXISTS idx_fp7_province_id ON forecast_province_7days(province_id);
CREATE INDEX IF NOT EXISTS idx_fp7_mb_code     ON forecast_province_7days(mb_code);

-- --

CREATE TABLE IF NOT EXISTS forecast_province_6months (
    id            SERIAL PRIMARY KEY,
    date_sim      DATE NOT NULL,
    mb_code       VARCHAR(2) NOT NULL DEFAULT '',
    province_id   VARCHAR(2) NOT NULL,
    province      VARCHAR(255),
    rainfall      NUMERIC(12,4),
    watersupply   NUMERIC(15,4),
    reservoir     NUMERIC(10,4),
    water_demand  NUMERIC(15,4),
    water_balance NUMERIC(15,4),
    drought_index INTEGER,
    runoff_index  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fp6_date_sim    ON forecast_province_6months(date_sim);
CREATE INDEX IF NOT EXISTS idx_fp6_province_id ON forecast_province_6months(province_id);
CREATE INDEX IF NOT EXISTS idx_fp6_mb_code     ON forecast_province_6months(mb_code);

-- ============================================================
-- Verify
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE 'Forecast tables created:';
    RAISE NOTICE '  forecast_tambon_7days, forecast_tambon_6months';
    RAISE NOTICE '  forecast_amphoe_7days, forecast_amphoe_6months';
    RAISE NOTICE '  forecast_province_7days, forecast_province_6months';
END $$;
