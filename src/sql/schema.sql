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

DROP TABLE IF EXISTS trip_report;
CREATE TABLE trip_report (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

DROP TABLE IF EXISTS trip_report_checklist;
CREATE TABLE trip_report_checklist (
  trip_report_id TEXT NOT NULL,
  checklist_id INTEGER NOT NULL,
  PRIMARY KEY (trip_report_id, checklist_id),
  FOREIGN KEY (trip_report_id) REFERENCES trip_report(id)
) STRICT;

DROP VIEW IF EXISTS observation_wide;
CREATE VIEW observation_wide AS
  SELECT DISTINCT observation.*,
    species.common_name,
    -- family.common_name as family_name,
  location.name as location_name,
  location.lat,
  location.lng,
  location.state,
  location.county,
  location.hotspot,
    strftime("%Y", seen_at) as year,
    photo.file_name IS NOT NULL as has_photo
  FROM
    observation
      INNER JOIN location ON location_id = location.id
      INNER JOIN species ON species_id = species.id
      LEFT JOIN photo ON observation.id = photo.observation_id
      -- INNER JOIN family ON family_id = family.id
    ;

DROP VIEW IF EXISTS trip_report_observation;
CREATE VIEW trip_report_observation AS
  SELECT DISTINCT
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
    photo.file_name IS NOT NULL as has_photo
  FROM trip_report_checklist trc
  INNER JOIN observation ON trc.checklist_id = observation.checklist_id
  INNER JOIN location ON observation.location_id = location.id
  INNER JOIN species ON observation.species_id = species.id
  LEFT JOIN photo ON observation.id = photo.observation_id
  ;