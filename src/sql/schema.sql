DROP TABLE IF EXISTS metadata;
CREATE TABLE metadata (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

DROP TABLE IF EXISTS observation;
CREATE TABLE observation (
  id TEXT PRIMARY KEY,
  checklist_id INTEGER,
  species_id TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  count INTEGER NULL,
  seen_at TEXT NOT NULL,
  ml_catalog_numbers TEXT,
  comment TEXT
) STRICT;

CREATE INDEX idx_observation_location_id ON observation(location_id);
CREATE INDEX idx_observation_checklist_id ON observation(checklist_id);

-- TODO: Load this
DROP TABLE IF EXISTS family;
CREATE TABLE family (
    id TEXT PRIMARY KEY,
    common_name TEXT NOT NULL
) STRICT;

DROP TABLE IF EXISTS species;
CREATE TABLE species (
    id TEXT PRIMARY KEY,
    common_name TEXT NOT NULL,
    scientific_name TEXT NOT NULL,
    taxonomic_order INTEGER NOT NULL,
    common_name_codes TEXT NOT NULL,
    family_id TEXT NOT NULL
) STRICT;

DROP TABLE IF EXISTS location;
CREATE TABLE location (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  hotspot INTEGER NOT NULL
) STRICT;

DROP TABLE IF EXISTS photo;
CREATE TABLE photo (
  file_name TEXT PRIMARY KEY,
  observation_id INTEGER NOT NULL,
  taken_at TEXT NOT NULL,
  rating INTEGER NOT NULL,
  height INTEGER NOT NULL,
  width INTEGER NOT NULL,
  iso TEXT NOT NULL,
  fnumber TEXT NOT NULL,
  exposure REAL NOT NULL,
  zoom TEXT NOT NULL,
  tags TEXT NOT NULL,
  camera TEXT NOT NULL,
  lens TEXT
);

CREATE INDEX idx_photo_observation_id ON photo(observation_id);

DROP TABLE IF EXISTS trip_report_checklist;
DROP TABLE IF EXISTS trip_report;
CREATE TABLE trip_report (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE trip_report_checklist (
  trip_report_id TEXT NOT NULL,
  checklist_id INTEGER NOT NULL,
  PRIMARY KEY (trip_report_id, checklist_id),
  FOREIGN KEY (trip_report_id) REFERENCES trip_report(id)
) STRICT;

-- Precomputed "first ever seen" / "first ever photographed" per species.
-- Recomputed wholesale from observation/photo by src/sql/populate_summary_tables.sql
-- every time data is (re)loaded — never written to incrementally.
DROP TABLE IF EXISTS species_first_seen;
CREATE TABLE species_first_seen (
  species_id TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  first_seen_observation_id TEXT NOT NULL
) STRICT;

DROP TABLE IF EXISTS species_first_photo;
CREATE TABLE species_first_photo (
  species_id TEXT PRIMARY KEY,
  first_photo_at TEXT NOT NULL,
  first_photo_observation_id TEXT NOT NULL
) STRICT;

-- Precomputed "first seen this calendar year" / "first photographed this
-- calendar year", per species. Same recomputation rule as above.
DROP TABLE IF EXISTS species_year_first_seen;
CREATE TABLE species_year_first_seen (
  species_id TEXT NOT NULL,
  year TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (species_id, year)
) STRICT;

DROP TABLE IF EXISTS species_year_first_photo;
CREATE TABLE species_year_first_photo (
  species_id TEXT NOT NULL,
  year TEXT NOT NULL,
  first_photo_at TEXT NOT NULL,
  PRIMARY KEY (species_id, year)
) STRICT;

DROP VIEW IF EXISTS observation_wide;
CREATE VIEW observation_wide AS
  SELECT observation.*,
    species.common_name,
    -- family.common_name as family_name,
  location.name as location_name,
  location.lat,
  location.lng,
  location.state,
  location.county,
  location.hotspot,
    strftime("%Y", seen_at) as year,
    EXISTS(SELECT 1 FROM photo WHERE photo.observation_id = observation.id) as has_photo
  FROM
    observation
      INNER JOIN location ON location_id = location.id
      INNER JOIN species ON species_id = species.id
      -- INNER JOIN family ON family_id = family.id
    ;

DROP VIEW IF EXISTS trip_report_observation;
CREATE VIEW trip_report_observation AS
  SELECT
    trc.trip_report_id,
    observation.*,
    species.common_name,
    location.name as location_name,
    location.lat,
    location.lng,
    location.state,
    location.county,
    location.hotspot,
    strftime("%Y", seen_at) as year,
    EXISTS(SELECT 1 FROM photo WHERE photo.observation_id = observation.id) as has_photo
  FROM trip_report_checklist trc
  INNER JOIN observation ON trc.checklist_id = observation.checklist_id
  INNER JOIN location ON observation.location_id = location.id
  INNER JOIN species ON observation.species_id = species.id
  ;