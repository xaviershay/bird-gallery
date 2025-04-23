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

DROP VIEW observation_wide;
CREATE VIEW IF NOT EXISTS observation_wide AS
  SELECT observation.*,
    species.common_name,
    -- family.common_name as family_name,
    location.name as location_name,
    location.lat,
    location.lng,
    location.state,
    location.county
  FROM
    observation
      INNER JOIN location ON location_id = location.id
      INNER JOIN species ON species_id = species.id
      -- INNER JOIN family ON family_id = family.id
    ;