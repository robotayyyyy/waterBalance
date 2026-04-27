-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Optional: Enable additional PostGIS extensions
-- CREATE EXTENSION IF NOT EXISTS postgis_topology;
-- CREATE EXTENSION IF NOT EXISTS postgis_raster;
-- CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
-- CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;

-- Verify PostGIS installation
SELECT PostGIS_version();
