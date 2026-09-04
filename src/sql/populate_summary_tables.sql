-- Recomputes the four species_first_* / species_year_first_* summary
-- tables from scratch, from the current contents of observation/photo.
--
-- Run this after (re)loading observation/photo data — in production via
-- src/scripts/load.ts appending this file to the generated load.sql, and
-- in tests via test/index.spec.ts's execSql helper, which runs it after
-- every batch of statements.
--
-- No triggers: the dataset is static between deploys, so this is always
-- run as a full wholesale recompute, never incrementally maintained.

DELETE FROM species_first_seen;
INSERT INTO species_first_seen (species_id, first_seen_at, first_seen_observation_id)
SELECT species_id, seen_at, id FROM (
  SELECT
    species_id,
    seen_at,
    id,
    ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC, id ASC) AS rn
  FROM observation
)
WHERE rn = 1;

DELETE FROM species_first_photo;
INSERT INTO species_first_photo (species_id, first_photo_at, first_photo_observation_id)
SELECT species_id, seen_at, id FROM (
  SELECT
    o.species_id AS species_id,
    o.seen_at AS seen_at,
    o.id AS id,
    ROW_NUMBER() OVER (PARTITION BY o.species_id ORDER BY o.seen_at ASC, o.id ASC) AS rn
  FROM observation o
  INNER JOIN photo p ON p.observation_id = o.id
)
WHERE rn = 1;

DELETE FROM species_year_first_seen;
INSERT INTO species_year_first_seen (species_id, year, first_seen_at)
SELECT species_id, year, seen_at FROM (
  SELECT
    species_id,
    STRFTIME('%Y', seen_at) AS year,
    seen_at,
    ROW_NUMBER() OVER (PARTITION BY species_id, STRFTIME('%Y', seen_at) ORDER BY seen_at ASC) AS rn
  FROM observation
)
WHERE rn = 1;

DELETE FROM species_year_first_photo;
INSERT INTO species_year_first_photo (species_id, year, first_photo_at)
SELECT species_id, year, seen_at FROM (
  SELECT
    o.species_id AS species_id,
    STRFTIME('%Y', o.seen_at) AS year,
    o.seen_at AS seen_at,
    ROW_NUMBER() OVER (PARTITION BY o.species_id, STRFTIME('%Y', o.seen_at) ORDER BY o.seen_at ASC) AS rn
  FROM observation o
  INNER JOIN photo p ON p.observation_id = o.id
)
WHERE rn = 1;

-- Precomputed header-stat counts (species ever seen / ever photographed).
-- Read by fetchHeaderStats on nearly every request, so this trades a live
-- COUNT(*) scan on every page load for a single-row lookup, at the cost of
-- only being fresh as of the last data (re)load -- same tradeoff as every
-- other table in this file.
DELETE FROM metadata WHERE id = 'header_seen_count';
INSERT INTO metadata (id, value)
  SELECT 'header_seen_count', CAST(COUNT(*) AS TEXT) FROM species_first_seen;

DELETE FROM metadata WHERE id = 'header_photo_count';
INSERT INTO metadata (id, value)
  SELECT 'header_photo_count', CAST(COUNT(*) AS TEXT) FROM species_first_photo;
