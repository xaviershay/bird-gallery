CREATE TABLE observation (
  id INTEGER PRIMARY KEY,
  species_id TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  count INTEGER NULL,
  seen_at DATETIME NOT NULL
) STRICT;

CREATE TABLE family (
    id CHAR(8) PRIMARY KEY,
    common_name TEXT NOT NULL
) STRICT;

CREATE TABLE species (
    id CHAR(8) PRIMARY KEY,
    common_name TEXT NOT NULL,
    scientific_name TEXT NOT NULL,
    taxonomic_order NUMBER NOT NULL,
    common_name_codes TEXT NOT NULL,
    family_id CHAR(8) NOL NULL
) STRICT;

CREATE TABLE location (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    state TEXT NOT NULL,
    county TEXT NOT NULL
) STRICT;