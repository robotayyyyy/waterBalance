-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Rivers table (LINESTRING geometry)
CREATE TABLE IF NOT EXISTS rivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    geometry GEOMETRY(LINESTRING, 4326) NOT NULL,
    river_order INTEGER,
    length_km NUMERIC(10,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Basins/Watersheds table (POLYGON geometry)
CREATE TABLE IF NOT EXISTS basins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    area_km2 NUMERIC(10,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Spatial indexes for performance (GIST indexes are essential for spatial queries)
CREATE INDEX IF NOT EXISTS idx_rivers_geom ON rivers USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_basins_geom ON basins USING GIST(geometry);

-- Regular indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rivers_name ON rivers(name);
CREATE INDEX IF NOT EXISTS idx_basins_name ON basins(name);

-- Insert test data
-- Test River: A winding river in Central Texas
INSERT INTO rivers (name, geometry, river_order) VALUES (
    'Colorado River',
    ST_GeomFromText('LINESTRING(-97.7431 30.2672, -97.7200 30.2800, -97.6950 30.2950, -97.6700 30.3100, -97.6500 30.3300)', 4326),
    3
);

INSERT INTO rivers (name, geometry, river_order) VALUES (
    'Tributary Creek',
    ST_GeomFromText('LINESTRING(-97.7800 30.2400, -97.7600 30.2550, -97.7431 30.2672)', 4326),
    1
);

-- Test Basin: Watershed area containing the rivers
INSERT INTO basins (name, geometry) VALUES (
    'Upper Colorado Basin',
    ST_GeomFromText('POLYGON((-97.8000 30.2200, -97.6200 30.2200, -97.6200 30.3600, -97.8000 30.3600, -97.8000 30.2200))', 4326)
);

INSERT INTO basins (name, geometry) VALUES (
    'Lower Colorado Basin',
    ST_GeomFromText('POLYGON((-97.7500 30.3500, -97.6000 30.3500, -97.6000 30.4200, -97.7500 30.4200, -97.7500 30.3500))', 4326)
);

-- Calculate and update river lengths
UPDATE rivers SET length_km = ST_Length(geometry::geography) / 1000;

-- Calculate and update basin areas
UPDATE basins SET area_km2 = ST_Area(geometry::geography) / 1000000;

-- Verify PostGIS is working
DO $$
BEGIN
    RAISE NOTICE 'PostGIS Version: %', PostGIS_Version();
    RAISE NOTICE 'Rivers created: %', (SELECT COUNT(*) FROM rivers);
    RAISE NOTICE 'Basins created: %', (SELECT COUNT(*) FROM basins);
END $$;
