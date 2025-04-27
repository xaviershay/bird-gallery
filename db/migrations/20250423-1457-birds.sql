DROP TABLE observation;
CREATE TABLE observation (
  id TEXT PRIMARY KEY,
  checklist_id INTEGER,
  species_id TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  count INTEGER NULL,
  seen_at TEXT NOT NULL
) STRICT;

-- TODO: Load this
CREATE TABLE IF NOT EXISTS family (
    id TEXT PRIMARY KEY,
    common_name TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS species (
    id TEXT PRIMARY KEY,
    common_name TEXT NOT NULL,
    scientific_name TEXT NOT NULL,
    taxonomic_order INTEGER NOT NULL,
    common_name_codes TEXT NOT NULL,
    family_id TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS location (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    state TEXT NOT NULL,
    county TEXT NOT NULL
) STRICT;

DROP TABLE IF EXISTS photo;
CREATE TABLE photo (
  id TEXT PRIMARY KEY,
  observation_id INTEGER NOT NULL,
  rating INTEGER NOT NULL
);

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
    photo.id IS NOT NULL as has_photo
  FROM
    observation
      INNER JOIN location ON location_id = location.id
      INNER JOIN species ON species_id = species.id
      LEFT JOIN photo ON observation_id = photo.id
      -- INNER JOIN family ON family_id = family.id
    ;