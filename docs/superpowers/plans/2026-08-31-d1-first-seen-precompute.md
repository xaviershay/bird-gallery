# D1 Rows-Read Reduction: Precomputed First-Seen/First-Photo Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut D1 "rows read" billing cost (currently ~2B/month against a 5M free-tier limit) by replacing live per-request window-function scans over `observation_wide` with small precomputed summary tables refreshed once at data-load time.

**Architecture:** The dataset is static between deploys (data only changes via a manual `bin/load-data-local`/`bin/load-data-remote` reload). Four new summary tables (`species_first_seen`, `species_first_photo`, `species_year_first_seen`, `species_year_first_photo`) hold one row per species (or species+year) recording its earliest sighting/photo. They are populated by a single SQL file run at the end of the load pipeline — no triggers, no incremental maintenance. The three hottest query paths (confirmed via `wrangler d1 insights` — see Context below) are rewritten to join against these small tables instead of computing `ROW_NUMBER() OVER (PARTITION BY species_id ...)` across the full joined+deduped view on every request.

**Tech Stack:** Cloudflare D1 (SQLite), TypeScript, Vitest + `@cloudflare/vitest-pool-workers`.

**Spec:** No separate spec file — this plan's Context section below is the spec, distilled from a live investigation of production `wrangler d1 insights` data earlier in the same working session.

## Context (why these specific changes)

Ran `npx wrangler d1 insights birds --time-period 30d --sort-by reads --sort-type sum --limit 15 --json` against production. Top cost queries (30-day totals):

| Query | Runs | Avg rows/run | Total rows |
|---|---|---|---|
| `fetchLocationFilterCounts` Q1 (life sightings) | 30,927 | 24,840 | 768M |
| `fetchLocationFilterCounts` Q3 (year sightings) | 30,696 | 25,000 | 767M |
| `fetchHeaderStats` (every page header) | 51,589 | 14,460 | 746M |
| `fetchLocationFilterCounts` Q2 (life photos) | 29,580 | 16,002 | 473M |
| `fetchLocationFilterCounts` Q4 (year photos) | 29,222 | 15,958 | 466M |
| trip_report firsts-photographed | 3,918 | 80,135 | 314M |
| trip_report firsts-seen | 3,965 | 72,164 | 286M |

These seven queries alone account for ~3.8B of the ~4.3B rows read across the top-15. Everything else (photo lookups, species pages, etc.) is comparatively small. This plan targets exactly these three call sites: `fetchLocationFilterCounts`, `fetchHeaderStats`, `fetchTripReportStats`.

Verified locally with `node:sqlite`'s `EXPLAIN QUERY PLAN` (Node 24, against a copy of the local miniflare D1 file) that the per-call cost is NOT due to missing indexes on join columns — SQLite already auto-builds covering indexes for the `photo` join at query time. The cost is a full `SCAN observation` (correctly required, since `ROW_NUMBER() OVER (PARTITION BY species_id ...)` needs global ranking before any `WHERE location_id = ?` filter can apply) repeated ~7x through `DISTINCT`, `ORDER BY`, and two `COUNT(DISTINCT)` temp b-trees. Precomputing removes the need to do this ranking live at all.

## Out of scope (deliberately deferred, do not implement here)

- `fetchGlobalFilterCounts` (`src/ts/model/filter_counts.ts`) — powers `/firsts` sidebar region/county breakdowns. Not in the top-15 cost list (that page is a single fixed URL, well-amortized by the 180s cache — unlike `/location/<id>` and `/trip-report/<id>` which have unbounded distinct URLs from crawling). Its per-row-count semantics are also genuinely combinatorial (arbitrary year × state × county), unlike the tables built here.
- `fetchFirsts` (`src/ts/model/observation.ts`) and the `view=firsts` branch of `fetchLocationObservations` (`src/ts/model/location.ts`) — also not in the top-15, and support arbitrary year/region/county filter combinations that can't be served by a simple precomputed table without a fallback path. Revisit only if a future `d1 insights` check shows them as hot.
- `fetchSpeciesObservations` (`src/ts/model/species.ts`) has a `ROW_NUMBER() OVER (PARTITION BY species_id ...)` whose `row_num` output is never actually filtered on (dead computation) — harmless bug, unrelated to this plan, worth a one-line follow-up cleanup separately.
- `fetchBirdingOpportunitiesTags` (`src/ts/model/report.ts`) isLifer/isPhotoLifer could be simplified against `species_first_seen`/`species_first_photo` once they exist, but wasn't in the top-15 either. Optional future cleanup.

## Global Constraints

- Every schema/query change must keep `npx vitest run test/index.spec.ts` fully green (39 tests as of this plan, including 6 added earlier this session specifically to pin the behavior these changes touch: 2 in `/location/1`, 2 in `/firsts filter counts`, 2 in `header stats`).
- No triggers. Summary tables are recomputed wholesale (`DELETE` + `INSERT ... SELECT`) from `observation`/`photo` once per data load, driven by a single shared SQL file (`src/sql/populate_summary_tables.sql`) used by both the production load pipeline and the test harness — never duplicate this logic in TypeScript.
- Don't touch anything listed under "Out of scope" above in this pass.

---

### Task 1: Add summary tables and supporting indexes to the schema

**Files:**
- Modify: `src/sql/schema.sql`
- Test: `test/index.spec.ts` (existing suite — schema is loaded fresh by every test via `execSql(schemaSql)`, so this task's correctness check is just "the full suite still passes with the new schema")

**Interfaces:**
- Produces: tables `species_first_seen(species_id TEXT PRIMARY KEY, first_seen_at TEXT NOT NULL, first_seen_observation_id TEXT NOT NULL)`, `species_first_photo(species_id TEXT PRIMARY KEY, first_photo_at TEXT NOT NULL, first_photo_observation_id TEXT NOT NULL)`, `species_year_first_seen(species_id TEXT NOT NULL, year TEXT NOT NULL, first_seen_at TEXT NOT NULL, PRIMARY KEY(species_id, year))`, `species_year_first_photo(species_id TEXT NOT NULL, year TEXT NOT NULL, first_photo_at TEXT NOT NULL, PRIMARY KEY(species_id, year))`. Indexes `idx_observation_location_id`, `idx_photo_observation_id`. All consumed by Tasks 2, 5, 6, 7.

- [ ] **Step 1: Run the existing suite to confirm a green baseline**

Run: `npx vitest run test/index.spec.ts`
Expected: `Tests  39 passed (39)`

- [ ] **Step 2: Add an index on `observation.location_id`, right after that table's definition**

In `src/sql/schema.sql`, find:
```sql
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
```
Add immediately after the closing `) STRICT;`:
```sql

CREATE INDEX idx_observation_location_id ON observation(location_id);
```

- [ ] **Step 3: Add an index on `photo.observation_id`, right after that table's definition**

In `src/sql/schema.sql`, find:
```sql
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
```
Add immediately after the closing `);`:
```sql

CREATE INDEX idx_photo_observation_id ON photo(observation_id);
```

- [ ] **Step 4: Add the four summary tables**

In `src/sql/schema.sql`, find the `trip_report_checklist` table block:
```sql
CREATE TABLE trip_report_checklist (
  trip_report_id TEXT NOT NULL,
  checklist_id INTEGER NOT NULL,
  PRIMARY KEY (trip_report_id, checklist_id),
  FOREIGN KEY (trip_report_id) REFERENCES trip_report(id)
) STRICT;
```
Add immediately after it (before the `DROP VIEW IF EXISTS observation_wide;` line):
```sql

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
```

- [ ] **Step 5: Run the suite again to confirm the schema change alone breaks nothing**

Run: `npx vitest run test/index.spec.ts`
Expected: `Tests  39 passed (39)` (new tables are empty and unused so far — this just confirms the schema loads cleanly)

- [ ] **Step 6: Commit**

```bash
git add src/sql/schema.sql
git commit -m "Add precomputed first-seen/first-photo summary tables and join indexes"
```

---

### Task 2: Create the shared summary-table population SQL

**Files:**
- Create: `src/sql/populate_summary_tables.sql`

**Interfaces:**
- Consumes: tables from Task 1 (`species_first_seen`, `species_first_photo`, `species_year_first_seen`, `species_year_first_photo`), plus existing `observation`/`photo` tables.
- Produces: a raw multi-statement SQL string, semicolon-terminated per statement, safe to split the same way `test/index.spec.ts`'s `execSql` already splits `schema.sql` (`.split(';').map(s => s.trim()).filter(s => s.length > 0)`). Consumed by Task 3 (production load pipeline) and Task 4 (test harness).

- [ ] **Step 1: Write the file**

```sql
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
```

- [ ] **Step 2: Sanity-check it runs standalone against the local dev DB**

Run: `npx wrangler d1 execute birds --local --file=src/sql/populate_summary_tables.sql`
Expected: four `DELETE`/`INSERT` pairs report success (0 rows affected is fine — local dev DB's `observation` table may already be loaded from a prior `bin/load-data-local` run, or empty; either way, no SQL errors)

- [ ] **Step 3: Commit**

```bash
git add src/sql/populate_summary_tables.sql
git commit -m "Add shared SQL to populate first-seen/first-photo summary tables"
```

---

### Task 3: Wire the population SQL into the production load pipeline

**Files:**
- Modify: `src/scripts/load.ts:388-397`

**Interfaces:**
- Consumes: `src/sql/populate_summary_tables.sql` (Task 2), via `readFileSync` (already imported at the top of `load.ts`).
- Produces: the generated `out/load.sql` (via `bin/generate-load-sql`) now ends with the four summary-table DELETE/INSERT blocks, after all `observation`/`photo`/`trip_report` data is loaded.

- [ ] **Step 1: Insert the file read between the closing of the main IIFE and the final metadata bump**

In `src/scripts/load.ts`, find:
```ts
    // Insert checklist associations
    for (const checklistId of checklistIds) {
      console.log(generateSQL(
        `INSERT INTO trip_report_checklist (trip_report_id, checklist_id)
         VALUES (?, ?);`,
        [report.id, checklistId]
      ));
    }
  }
})();

console.log(generateSQL(
  `INSERT INTO metadata (id, value)
   VALUES ("version", ?)
   ON CONFLICT (id) DO UPDATE SET value = excluded.value;`,
   [new Date().toISOString()]
))
```
Replace with:
```ts
    // Insert checklist associations
    for (const checklistId of checklistIds) {
      console.log(generateSQL(
        `INSERT INTO trip_report_checklist (trip_report_id, checklist_id)
         VALUES (?, ?);`,
        [report.id, checklistId]
      ));
    }
  }
})();

// Recompute derived "first sighting" / "first photo" summary tables from
// the observation/photo data just loaded above. Kept as a single shared
// SQL file (also used by test/index.spec.ts) rather than duplicated logic.
console.log(readFileSync('src/sql/populate_summary_tables.sql', 'utf-8'));

console.log(generateSQL(
  `INSERT INTO metadata (id, value)
   VALUES ("version", ?)
   ON CONFLICT (id) DO UPDATE SET value = excluded.value;`,
   [new Date().toISOString()]
))
```

- [ ] **Step 2: Generate load SQL and confirm the summary blocks appear at the end**

Run: `bin/generate-load-sql && tail -40 out/load.sql`
Expected: output ends with the four `DELETE FROM species_...` / `INSERT INTO species_...` blocks from Task 2, after the metadata line is NOT expected to appear before them (metadata insert is emitted by the line right after the `readFileSync` call, so it will actually appear AFTER the summary blocks in `out/load.sql` — that's fine, ordering between "bump version" and "recompute summaries" doesn't matter since both must complete before the deploy is considered done).

- [ ] **Step 3: Load locally and confirm no SQL errors**

Run: `bin/load-data-local`
Expected: script completes with `set -ex` tracing, no SQL error output from the `wrangler d1 execute --local --file=out/load.sql` step

- [ ] **Step 4: Spot check the summary tables got populated**

Run: `npx wrangler d1 execute birds --local --json --command "SELECT COUNT(*) FROM species_first_seen"`
Expected: a count roughly equal to the distinct species count in `data/MyEBirdData.csv` (not zero)

- [ ] **Step 5: Commit**

```bash
git add src/scripts/load.ts
git commit -m "Populate first-seen/first-photo summary tables at data-load time"
```

---

### Task 4: Wire the population SQL into the test harness

**Files:**
- Modify: `test/index.spec.ts:1-14`

**Interfaces:**
- Consumes: `src/sql/populate_summary_tables.sql` (Task 2), imported the same way `schema.sql` already is (`?raw` Vite import, per the existing `import schemaSql from '../src/sql/schema.sql?raw';` line).
- Produces: `execSql` now refreshes all four summary tables after every batch of statements it runs — a single change point, so every existing and future test fixture gets correct summary data with no per-test changes.

- [ ] **Step 1: Add the import and update `execSql`**

In `test/index.spec.ts`, find:
```ts
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import schemaSql from '../src/sql/schema.sql?raw'; // Import SQL as raw string

async function execSql(sql: string) {
  const statements = sql
    .split(';')
    .map(sql => sql.trim())
    .filter(sql => sql.length > 0)
    .map(sql => env.DB.prepare(sql));

  // Execute the statements in a batch
  await env.DB.batch(statements);
}
```
Replace with:
```ts
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import schemaSql from '../src/sql/schema.sql?raw'; // Import SQL as raw string
import summarySql from '../src/sql/populate_summary_tables.sql?raw';

function toStatements(sql: string) {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => env.DB.prepare(s));
}

async function execSql(sql: string) {
  // Execute the statements in a batch
  await env.DB.batch(toStatements(sql));

  // Every insert/update to observation or photo data needs the derived
  // species_first_seen/species_first_photo/species_year_first_* tables
  // refreshed to match — same rule production's load pipeline follows.
  // Running this unconditionally (even right after schema.sql, when the
  // tables are empty) is harmless and keeps this a single change point.
  await env.DB.batch(toStatements(summarySql));
}
```

- [ ] **Step 2: Run the full suite to confirm this alone changes nothing**

Run: `npx vitest run test/index.spec.ts`
Expected: `Tests  39 passed (39)` (summary tables are now populated after every fixture insert, but no query reads them yet)

- [ ] **Step 3: Commit**

```bash
git add test/index.spec.ts
git commit -m "Refresh summary tables in test harness after every fixture insert"
```

---

### Task 5: Rewrite `fetchHeaderStats` to read from the summary tables

**Files:**
- Modify: `src/ts/model/header_stats.ts`
- Test: `test/index.spec.ts` — `describe('header stats', ...)` (already written, asserts `'seen <!-- -->2<!-- --> different species'` and `'photographed <!-- -->1<!-- -->.'` for a 2-species fixture with one photo, and that a repeat sighting doesn't inflate the count)

**Interfaces:**
- Consumes: `species_first_seen`, `species_first_photo` (Task 1/4).
- Produces: same `fetchHeaderStats(env: Env): Promise<HeaderStats>` signature and `{seenCount, photoCount}` shape as before — no caller changes needed.

- [ ] **Step 1: Confirm the header stats tests currently pass against the OLD implementation**

Run: `npx vitest run test/index.spec.ts -t "header stats"`
Expected: `Tests  2 passed (2)`

- [ ] **Step 2: Replace the query**

In `src/ts/model/header_stats.ts`, find:
```ts
export async function fetchHeaderStats(
  env: Env,
): Promise<HeaderStats> {
  let query = `
  SELECT
    COUNT(distinct species_id) as seenCount,
    COUNT(distinct CASE WHEN has_photo THEN species_id ELSE NULL END) as photoCount
  FROM observation_wide
  `;

  const statement = env.DB.prepare(query);
  const result = await statement.first<HeaderStats>();
  
  return result ?? {seenCount: 0, photoCount: 0};
}
```
Replace with:
```ts
export async function fetchHeaderStats(
  env: Env,
): Promise<HeaderStats> {
  const query = `
  SELECT
    (SELECT COUNT(*) FROM species_first_seen) as seenCount,
    (SELECT COUNT(*) FROM species_first_photo) as photoCount
  `;

  const statement = env.DB.prepare(query);
  const result = await statement.first<HeaderStats>();

  return result ?? {seenCount: 0, photoCount: 0};
}
```

- [ ] **Step 3: Run the header stats tests again to confirm they pass against the NEW implementation**

Run: `npx vitest run test/index.spec.ts -t "header stats"`
Expected: `Tests  2 passed (2)`

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run test/index.spec.ts`
Expected: `Tests  39 passed (39)`

- [ ] **Step 5: Commit**

```bash
git add src/ts/model/header_stats.ts
git commit -m "Read header stats from precomputed summary tables instead of live scan"
```

---

### Task 6: Rewrite `fetchLocationFilterCounts`

**Files:**
- Modify: `src/ts/model/filter_counts.ts:218-321` (the `fetchLocationFilterCounts` function only — leave `fetchGlobalFilterCounts` above it untouched, per Out of Scope)
- Test: `test/index.spec.ts` — `describe('/location/1', ...)` includes `'only counts species seen at the location in All/Seen column'` (pre-existing) plus `'excludes a species from the firsts count when its lifetime-first sighting was elsewhere'` and `'only shows species first seen at this location under view=firsts'` (added earlier this session)

**Interfaces:**
- Consumes: `species_first_seen`, `species_first_photo`, `species_year_first_seen`, `species_year_first_photo` (Task 1/4), plus raw `observation`/`photo` tables directly (no longer `observation_wide`).
- Produces: same `fetchLocationFilterCounts(locationId: number, env: Env): Promise<Record<string, number>>` signature and the same `Filter.create(...).toQueryString()`-keyed result shape as before — `nav_link_builder.tsx` and `location.tsx` need no changes.

- [ ] **Step 1: Confirm the three location-count tests currently pass against the OLD implementation**

Run: `npx vitest run test/index.spec.ts -t "/location/1"`
Expected: `Tests  5 passed (5)` (renders / renders for a specific year / only counts species.../ excludes a species.../ only shows species...)

- [ ] **Step 2: Replace the function body**

In `src/ts/model/filter_counts.ts`, find the entire `fetchLocationFilterCounts` function (from its `/**` doc comment through its closing `}`):
```ts
/**
 * Fetches filter counts for a specific location page
 * Includes period breakdowns and "firsts" vs regular view counts
 */
export async function fetchLocationFilterCounts(
  locationId: number,
  env: Env
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // Query 1: Overall counts (all time) for sightings and photos
  let query = `
      SELECT
        COUNT(DISTINCT species_id) as allSightings,
        COUNT(DISTINCT CASE WHEN has_photo THEN species_id END) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstSightings,
        COUNT(CASE WHEN has_photo AND row_num = 1 THEN 1 END) as allFirstPhotos
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
      )
      WHERE location_id = ?
    `;

  let statement = env.DB.prepare(query);
  let result = await statement.bind(locationId).first<any>();

  counts[Filter.create({ type: ObsType.Sighting }).toQueryString()] =
    result.allSightings;
  counts[Filter.create({ type: ObsType.Sighting, view: "firsts" }).toQueryString()] =
    result.allFirstSightings;

  // Query 2: Photo-only overall counts
  query = `
      SELECT
        COUNT(DISTINCT species_id) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstPhotos
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE has_photo
      )
      WHERE
        location_id = ?
    `;

  statement = env.DB.prepare(query);
  result = await statement.bind(locationId).first<any>();

  counts[Filter.create({ type: ObsType.Photo }).toQueryString()] =
    result.allPhotos;
  counts[Filter.create({ type: ObsType.Photo, view: "firsts" }).toQueryString()] =
    result.allFirstPhotos;

  // Query 3: Year-grouped sightings counts
  query = `
      SELECT
        STRFTIME("%Y", seen_at) as year,
        COUNT(DISTINCT species_id) as allSightings,
        COUNT(DISTINCT CASE WHEN has_photo THEN species_id END) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstSightings,
        COUNT(CASE WHEN has_photo AND row_num = 1 THEN 1 END) as allFirstPhotos
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id, STRFTIME("%Y", seen_at) ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
      )
      WHERE location_id = ?
      GROUP BY 1
    `;
  statement = env.DB.prepare(query);
  let results = await statement.bind(locationId).all<any>();

  results.results.forEach((result : any) => {
    counts[
      Filter.create({ type: ObsType.Sighting, period: result.year }).toQueryString()
    ] = result.allSightings;
    counts[
      Filter.create({ type: ObsType.Sighting, period: result.year, view: "firsts" }).toQueryString()
    ] = result.allFirstSightings;
  });

  // Query 4: Year-grouped photo counts
  query = `
      SELECT
        STRFTIME("%Y", seen_at) as year,
        COUNT(DISTINCT species_id) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstPhotos
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id, STRFTIME("%Y", seen_at) ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE has_photo
      )
      WHERE location_id = ?
      GROUP BY 1
    `;
  statement = env.DB.prepare(query);
  results = await statement.bind(locationId).all<any>();

  results.results.forEach((result : any) => {
    counts[Filter.create({ type: ObsType.Photo, period: result.year }).toQueryString()] =
      result.allPhotos;
    counts[
      Filter.create({ type: ObsType.Photo, period: result.year, view: "firsts" }).toQueryString()
    ] = result.allFirstPhotos;
  });

  return counts;
}
```
Replace with:
```ts
/**
 * Fetches filter counts for a specific location page
 * Includes period breakdowns and "firsts" vs regular view counts
 */
export async function fetchLocationFilterCounts(
  locationId: number,
  env: Env
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // Query 1: Overall sightings counts (all time)
  let query = `
      SELECT
        COUNT(DISTINCT o.species_id) as allSightings,
        COUNT(DISTINCT CASE WHEN sfs.species_id IS NOT NULL THEN o.species_id END) as allFirstSightings
      FROM observation o
      LEFT JOIN species_first_seen sfs
        ON sfs.species_id = o.species_id AND sfs.first_seen_observation_id = o.id
      WHERE o.location_id = ?
    `;

  let statement = env.DB.prepare(query);
  let result = await statement.bind(locationId).first<any>();

  counts[Filter.create({ type: ObsType.Sighting }).toQueryString()] =
    result.allSightings;
  counts[Filter.create({ type: ObsType.Sighting, view: "firsts" }).toQueryString()] =
    result.allFirstSightings;

  // Query 2: Overall photo counts (all time)
  query = `
      SELECT
        COUNT(DISTINCT o.species_id) as allPhotos,
        COUNT(DISTINCT CASE WHEN sfp.species_id IS NOT NULL THEN o.species_id END) as allFirstPhotos
      FROM observation o
      INNER JOIN photo p ON p.observation_id = o.id
      LEFT JOIN species_first_photo sfp
        ON sfp.species_id = o.species_id AND sfp.first_photo_observation_id = o.id
      WHERE o.location_id = ?
    `;

  statement = env.DB.prepare(query);
  result = await statement.bind(locationId).first<any>();

  counts[Filter.create({ type: ObsType.Photo }).toQueryString()] =
    result.allPhotos;
  counts[Filter.create({ type: ObsType.Photo, view: "firsts" }).toQueryString()] =
    result.allFirstPhotos;

  // Query 3: Year-grouped sightings counts
  query = `
      SELECT
        STRFTIME('%Y', o.seen_at) as year,
        COUNT(DISTINCT o.species_id) as allSightings,
        COUNT(DISTINCT CASE WHEN syfs.first_seen_at = o.seen_at THEN o.species_id END) as allFirstSightings
      FROM observation o
      LEFT JOIN species_year_first_seen syfs
        ON syfs.species_id = o.species_id AND syfs.year = STRFTIME('%Y', o.seen_at)
      WHERE o.location_id = ?
      GROUP BY 1
    `;
  statement = env.DB.prepare(query);
  let results = await statement.bind(locationId).all<any>();

  results.results.forEach((result: any) => {
    counts[
      Filter.create({ type: ObsType.Sighting, period: result.year }).toQueryString()
    ] = result.allSightings;
    counts[
      Filter.create({ type: ObsType.Sighting, period: result.year, view: "firsts" }).toQueryString()
    ] = result.allFirstSightings;
  });

  // Query 4: Year-grouped photo counts
  query = `
      SELECT
        STRFTIME('%Y', o.seen_at) as year,
        COUNT(DISTINCT o.species_id) as allPhotos,
        COUNT(DISTINCT CASE WHEN syfp.first_photo_at = o.seen_at THEN o.species_id END) as allFirstPhotos
      FROM observation o
      INNER JOIN photo p ON p.observation_id = o.id
      LEFT JOIN species_year_first_photo syfp
        ON syfp.species_id = o.species_id AND syfp.year = STRFTIME('%Y', o.seen_at)
      WHERE o.location_id = ?
      GROUP BY 1
    `;
  statement = env.DB.prepare(query);
  results = await statement.bind(locationId).all<any>();

  results.results.forEach((result: any) => {
    counts[Filter.create({ type: ObsType.Photo, period: result.year }).toQueryString()] =
      result.allPhotos;
    counts[
      Filter.create({ type: ObsType.Photo, period: result.year, view: "firsts" }).toQueryString()
    ] = result.allFirstPhotos;
  });

  return counts;
}
```

Note: the original also selected `allPhotos`/`allFirstPhotos` in Query 1 and `allSightings`-equivalent duplication elsewhere that were never read into `counts` — this rewrite drops those unused columns as a side effect of the restructure. If a reviewer diffing behavior wants to double check, grep the original for `result.allPhotos` right after Query 1 in git history: it isn't there.

- [ ] **Step 3: Run the location tests again to confirm they pass against the NEW implementation**

Run: `npx vitest run test/index.spec.ts -t "/location/1"`
Expected: `Tests  5 passed (5)`

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run test/index.spec.ts`
Expected: `Tests  39 passed (39)`

- [ ] **Step 5: Commit**

```bash
git add src/ts/model/filter_counts.ts
git commit -m "Rewrite fetchLocationFilterCounts to join against summary tables"
```

---

### Task 7: Rewrite the firsts-seen/firsts-photographed queries in `fetchTripReportStats`

**Files:**
- Modify: `src/ts/model/trip_report.ts:48-101`
- Test: `test/index.spec.ts` — `describe('/trip-report', ...)`, specifically `'calculates firsts seen correctly'` and `'calculates firsts photographed correctly'` (pre-existing)

**Interfaces:**
- Consumes: `species_first_seen`, `species_first_photo` (Task 1/4), plus the existing `trip_report_observation` view (unchanged).
- Produces: same `fetchTripReportStats(env: Env, id: string): Promise<TripReportStats>` signature and `TripReportStats` shape as before.

- [ ] **Step 1: Confirm the two firsts tests currently pass against the OLD implementation**

Run: `npx vitest run test/index.spec.ts -t "calculates firsts"`
Expected: `Tests  2 passed (2)`

- [ ] **Step 2: Replace the two queries**

In `src/ts/model/trip_report.ts`, find:
```ts
  // Calculate firsts seen
  const firstsSeenQuery = `
    SELECT COUNT(*) as count
    FROM (
      SELECT species_id, MIN(seen_at) as first_seen
      FROM observation
      GROUP BY species_id
    ) all_firsts
    INNER JOIN trip_report_observation tro
      ON all_firsts.species_id = tro.species_id
      AND all_firsts.first_seen = tro.seen_at
    WHERE tro.trip_report_id = ?;
  `;
  const firstsSeenResult = await env.DB.prepare(firstsSeenQuery).bind(id).first<any>();

  // Calculate firsts photographed
  const firstsPhotographedQuery = `
    SELECT COUNT(*) as count
    FROM (
      SELECT species_id, MIN(seen_at) as first_photo
      FROM observation_wide
      WHERE has_photo = 1
      GROUP BY species_id
    ) all_first_photos
    INNER JOIN trip_report_observation tro
      ON all_first_photos.species_id = tro.species_id
      AND all_first_photos.first_photo = tro.seen_at
    WHERE tro.trip_report_id = ?
      AND tro.has_photo = 1;
  `;
  const firstsPhotographedResult = await env.DB.prepare(firstsPhotographedQuery).bind(id).first<any>();
```
Replace with:
```ts
  // Calculate firsts seen
  const firstsSeenQuery = `
    SELECT COUNT(*) as count
    FROM trip_report_observation tro
    INNER JOIN species_first_seen sfs
      ON sfs.species_id = tro.species_id
      AND sfs.first_seen_observation_id = tro.id
    WHERE tro.trip_report_id = ?;
  `;
  const firstsSeenResult = await env.DB.prepare(firstsSeenQuery).bind(id).first<any>();

  // Calculate firsts photographed
  const firstsPhotographedQuery = `
    SELECT COUNT(*) as count
    FROM trip_report_observation tro
    INNER JOIN species_first_photo sfp
      ON sfp.species_id = tro.species_id
      AND sfp.first_photo_observation_id = tro.id
    WHERE tro.trip_report_id = ?
      AND tro.has_photo = 1;
  `;
  const firstsPhotographedResult = await env.DB.prepare(firstsPhotographedQuery).bind(id).first<any>();
```

- [ ] **Step 3: Run the firsts tests again to confirm they pass against the NEW implementation**

Run: `npx vitest run test/index.spec.ts -t "calculates firsts"`
Expected: `Tests  2 passed (2)`

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run test/index.spec.ts`
Expected: `Tests  39 passed (39)`

- [ ] **Step 5: Commit**

```bash
git add src/ts/model/trip_report.ts
git commit -m "Rewrite trip report firsts stats to join against summary tables"
```

---

### Task 8: Local query-plan validation, then production rollout

**Files:**
- None modified — this task is verification and deployment only.

**Interfaces:**
- Consumes: all of the above.
- Produces: confidence the rewrite actually reduces rows-read before it hits the production D1 free-tier budget, plus the production data/schema update itself.

- [ ] **Step 1: Confirm the full local suite is green**

Run: `npx vitest run test/index.spec.ts`
Expected: `Tests  39 passed (39)`

- [ ] **Step 2: Re-run the local EXPLAIN QUERY PLAN check against the new queries**

Copy the local miniflare D1 file and check the new `fetchLocationFilterCounts` Query 1 plan with `node:sqlite` (same technique used earlier this session):

```bash
cp .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite /tmp/birds-check.sqlite
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/tmp/birds-check.sqlite', { enableDoubleQuotedStringLiterals: true });
const plan = db.prepare(\`EXPLAIN QUERY PLAN
  SELECT
    COUNT(DISTINCT o.species_id) as allSightings,
    COUNT(DISTINCT CASE WHEN sfs.species_id IS NOT NULL THEN o.species_id END) as allFirstSightings
  FROM observation o
  LEFT JOIN species_first_seen sfs
    ON sfs.species_id = o.species_id AND sfs.first_seen_observation_id = o.id
  WHERE o.location_id = ?
\`).all(1);
for (const row of plan) console.log(row.detail);
"
```
Expected: `SEARCH observation USING INDEX idx_observation_location_id (location_id=?)` (not `SCAN observation`) — confirms the new index is actually being used and the query no longer scans the whole table.

- [ ] **Step 3: Deploy code**

Run: `bin/deploy`
Expected: deploy succeeds (this ships the new query code; the OLD schema/data is still live until the next steps)

- [ ] **Step 4: Apply the new schema to production D1**

Run: `npx wrangler d1 execute birds --remote --file=src/sql/schema.sql --yes`
Expected: succeeds — note this is the existing full DROP+CREATE schema script, already part of the documented `bin/load-data-remote` flow

- [ ] **Step 5: Reload production data (repopulates observation/photo AND the new summary tables)**

Run: `bin/load-data-remote`
Expected: succeeds; this both reloads the base data and runs `populate_summary_tables.sql` per Task 3's wiring

- [ ] **Step 6: Smoke-test production**

Visit a few `/location/<id>` pages and the home page on https://birds.xaviershay.com and confirm species counts/firsts still look correct against what you know of your own data.

- [ ] **Step 7: Re-check D1 insights after a few days of real traffic**

Run: `npx wrangler d1 insights birds --time-period 7d --sort-by reads --sort-type sum --limit 15 --json`
Expected: `fetchLocationFilterCounts`, `fetchHeaderStats`, and the trip-report firsts queries no longer dominate the top-15, and their `avgRowsRead` values are dramatically lower (low hundreds, not tens of thousands) — confirms the fix landed for real, not just in theory.

---

## Self-Review Notes

- **Spec coverage:** every query identified in the Context table (fetchLocationFilterCounts Q1-Q4, fetchHeaderStats, trip-report firsts-seen/firsts-photographed) has a task. Out-of-scope items are explicitly listed with rationale so they aren't silently forgotten.
- **Type consistency:** `fetchLocationFilterCounts`, `fetchHeaderStats`, and `fetchTripReportStats` all keep their existing exported signatures — no caller (`filter_counts.ts`'s own callers in `controller/location.ts`, `controller/helpers.ts`, `model/trip_report.ts`'s callers in `controller/trip_report.ts`) needs any change.
- **Test safety net:** all three rewritten call sites are covered by tests added earlier this session specifically because they were gaps (`fetchLocationFilterCounts`'s firsts-specific counts and `view=firsts` behavior, `fetchHeaderStats`'s actual numbers) plus one pre-existing test (`fetchLocationFilterCounts`'s dedup behavior) and two pre-existing tests (`fetchTripReportStats`'s firsts-seen/firsts-photographed edge cases). No task in this plan touches a code path without a passing test exercising it both before and after.
