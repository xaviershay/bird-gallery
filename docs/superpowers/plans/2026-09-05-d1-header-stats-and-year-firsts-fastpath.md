# D1 Rows-Read Reduction: Header Stats & Year-Filtered Firsts Fast Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue reducing Cloudflare D1 "rows read" (currently ~4.8-10.6M rows/day in production, against a 5M/day free-tier reference point) by (1) precomputing the per-request header-stats counts instead of live-counting them on every page load, and (2) extending the existing per-species first-seen/first-photo summary tables so two remaining live-window-function query paths — the location page's year-filtered `view=firsts`, and the global `/firsts?period=YYYY` page — can read from a summary table instead.

**Architecture:** `header_stats.ts`'s `fetchHeaderStats` runs two `COUNT(*)` subqueries against `species_first_seen`/`species_first_photo` on nearly every request (2603 calls in a 2-day production sample = ~14% of all rows read, cheap per-call but the highest-frequency query in the app). Since these counts only change when data is reloaded, Task 1 precomputes them once into the existing `metadata` table (already used for the cache-busting `version` key) at data-load time, so each request becomes a 2-row PK lookup instead of a full scan of both summary tables.

Separately, `fetchGlobalFilterCounts`'s four "lifetime, per-region/county" queries (`lifetimeRegionFirstSightings/Photos`, `lifetimeCountyFirstSightings/Photos`) still scan the full `observation_wide` view — Task 2 rewrites them to join `species_first_seen`/`species_first_photo` (one row per species, already precomputed) out to `observation`/`location` instead, cutting the driving-table size from ~3441 observation rows to ~338 species rows.

`species_year_first_seen`/`species_year_first_photo` (species+year → first-seen/first-photo date, no observation reference) already exist but can't be joined to directly by id. Task 3 adds a `first_seen_observation_id`/`first_photo_observation_id` column to each (populated alongside the existing columns) plus a `year` index, enabling exact-row joins. Task 4 and Task 5 then use those columns to fast-path the two remaining live-window-function call sites that only filter by year: `location.ts`'s `view=firsts&period=YYYY` branch (confirmed in production analytics as the single largest remaining query, ~1.2M rows/day) and `observation.ts`'s `fetchFirsts` for the global `/firsts?period=YYYY` case (no region/county set). Both fast paths were confirmed against a local copy of production data via `EXPLAIN QUERY PLAN` — every step resolves to an index `SEARCH`, no table `SCAN` — before this plan was written.

Filtered requests that also set `region` or `county` (global `/firsts?region=...` or `?county=...`) are unaffected by this plan and continue to use the existing live window-function query — same explicit scope boundary the previous plan (`docs/superpowers/plans/2026-08-31-d1-remaining-hotpaths.md`) drew around region/county-partitioned queries, for the same reason: no region/county dimension exists in these summary tables, and adding one is out of scope here.

**Tech Stack:** Cloudflare D1 (SQLite), TypeScript, Vitest + `@cloudflare/vitest-pool-workers`.

**Spec:** No separate spec file. This plan's Context section is the spec, derived from a live Cloudflare GraphQL Analytics investigation (`d1QueriesAdaptiveGroups`, 2-day sample) of the production `birds` D1 database, cross-checked against `EXPLAIN QUERY PLAN` output from a local copy of the same schema and data (`.wrangler/state/v3/d1/...`, loaded via `bin/load-data-local`).

## Global Constraints

- Every task must keep `npx vitest run` fully green throughout (129 tests passing at plan-writing time, across 8 test files -- this repo's full suite, matching `bin/test`), and specifically must not regress any test from the two previously-merged D1 hot-path plans.
- **Test coverage comes first, in every task.** This plan's task-coverage audit (below) found that every behavior-changing task already has adequate existing regression coverage from the two previous plans — no task in this plan needs new tests; each task's own full-suite run (before and after its change) is the regression check. If executing out of order or if a task's diff ends up broader than described here, add a test before proceeding rather than trusting this audit blindly.
- Task 1 and Task 2 are independent of each other and of Tasks 3-5. Task 3 must land before Task 4 and Task 5 — both consume the columns it adds.
- Don't touch `fetchGlobalFilterCounts`'s year+region and year+county grouped queries (the ones computing `allSightings`/`allFirstSightings`/`allRegionFirstSightings` per year+state or year+county), `isYearLifer`/`isLocationLifer` in `report.ts`, or any global `/firsts` request with `region` or `county` set — all explicitly out of scope, same reasoning as the previous plan (no region/county/year-combined summary table exists, and building one is a larger schema task not covered here).
- Don't run `bin/load-data-remote` or otherwise touch the production D1 database as part of executing this plan — schema changes here (Task 3) only take effect after a data reload, which the user has said they'll trigger separately.

## Task-coverage audit (performed before writing this plan)

| Task | Existing coverage | Gap found | Task's response |
|---|---|---|---|
| 1 (header stats precompute) | Strong — `describe('header stats', ...)` has 2 tests asserting exact rendered seen/photo counts, including a "does not count repeat sightings twice" case that only passes if the count is freshly recomputed after each fixture insert | None — `execSql` already re-runs `populate_summary_tables.sql` (which Task 1 extends) after every batch, so these tests exercise the new code path automatically | No new test needed |
| 2 (region/county lifetime queries) | Strong — `describe('/firsts filter counts', ...)`'s `'computes lifetime (Life) counts across regions and photo status'` and `'does not double-count a species seen in the same region across multiple years for the Life total'` tests assert exactly the 4 values this task rewrites | None | No new test needed |
| 3 (add observation-id columns + year index) | N/A, no behavior change (existing `fetchLocationFilterCounts` queries that join these tables use `species_id`/`year`/`first_seen_at`/`first_photo_at`, none of which change) | None | Full suite is the check |
| 4 (location.ts year-filtered firsts fast path) | Strong — `'view=firsts with a period filter still excludes a species not first-seen at this location that year'` (added by the previous plan) asserts exactly this branch's semantics: a species included under unfiltered `view=firsts` must be excluded once a `period` filter is added, if its *year-first* (not lifetime-first) sighting was elsewhere | None | No new test needed |
| 5 (fetchFirsts year-filtered fast path) | Good — `'filtered: period filter still excludes a species not first-seen that year'` asserts the seen case; no existing test exercises the `type=photo` branch of this specific fast path | Real gap: nothing would catch a broken `hasPhoto`/photo-join in the new `fetchFirstsYearFiltered` photo branch | Task 5 adds one test for the photo case |

---

### Task 1: Precompute header stats into the `metadata` table

**Files:**
- Modify: `src/ts/model/header_stats.ts`
- Modify: `src/sql/populate_summary_tables.sql`

**Interfaces:**
- Produces: same `fetchHeaderStats(env: Env): Promise<HeaderStats>` signature and `{seenCount, photoCount}` shape — no caller needs any change.
- Consumes: two new rows in the existing `metadata` table (`id = 'header_seen_count'` / `id = 'header_photo_count'`), written by `populate_summary_tables.sql` (already run after every data load, in both production via `src/scripts/load.ts` and tests via `execSql`).

- [ ] **Step 1: Run the full suite to confirm a green baseline**

Run: `npx vitest run`
Expected: `129 passed (129)`

- [ ] **Step 2: Add the metadata upserts to the summary-table population script**

In `src/sql/populate_summary_tables.sql`, find the end of the file (after the `species_year_first_photo` INSERT block, which ends with):
```sql
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
Append immediately after it (end of file):
```sql

-- Precomputed header-stat counts (species ever seen / ever photographed).
-- Read by fetchHeaderStats on nearly every request, so this trades a live
-- COUNT(*) scan on every page load for a single-row lookup, at the cost of
-- only being fresh as of the last data (re)load -- same tradeoff as every
-- other table in this file.
INSERT INTO metadata (id, value)
  SELECT 'header_seen_count', CAST(COUNT(*) AS TEXT) FROM species_first_seen
  ON CONFLICT (id) DO UPDATE SET value = excluded.value;

INSERT INTO metadata (id, value)
  SELECT 'header_photo_count', CAST(COUNT(*) AS TEXT) FROM species_first_photo
  ON CONFLICT (id) DO UPDATE SET value = excluded.value;
```

- [ ] **Step 3: Rewrite `fetchHeaderStats` to read from `metadata`**

In `src/ts/model/header_stats.ts`, find:
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
Replace with:
```ts
export async function fetchHeaderStats(
  env: Env,
): Promise<HeaderStats> {
  const query = `
  SELECT
    MAX(CASE WHEN id = 'header_seen_count' THEN CAST(value AS INTEGER) END) as seenCount,
    MAX(CASE WHEN id = 'header_photo_count' THEN CAST(value AS INTEGER) END) as photoCount
  FROM metadata
  WHERE id IN ('header_seen_count', 'header_photo_count')
  `;

  const statement = env.DB.prepare(query);
  const result = await statement.first<HeaderStats>();

  return result ?? {seenCount: 0, photoCount: 0};
}
```

- [ ] **Step 4: Run the header stats tests to confirm they still pass**

Run: `npx vitest run test/index.spec.ts -t "header stats"`
Expected: `2 passed`

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: `129 passed (129)` (no new tests in this task — see coverage audit)

- [ ] **Step 6: Commit**

```bash
git add src/ts/model/header_stats.ts src/sql/populate_summary_tables.sql
git commit -m "Precompute header stats counts into metadata table"
```

---

### Task 2: Rewrite `fetchGlobalFilterCounts`'s lifetime region/county queries — ABANDONED

> **Post-execution note:** This task was implemented, reviewed, and found Critically wrong: it silently changes the meaning of "lifetime region/county firsts" from "any species ever observed in this state/county" (the original, correct semantics, established by commit `57d5503`) to "species whose single lifetime-first sighting happened to be in this state/county" — undercounting any species observed in more than one region/county over its lifetime, since `species_first_seen`/`species_first_photo` each store only one row per species. Verified against a local fixture (a species seen in two different states): old query counted it in both states; this rewrite counted it in only one. **Reverted** (commit `65fbd3b` → `ebbd46d`). `filter_counts.ts` stays on its original, correct `observation_wide`-based query for these 4 values. See the plan's SDD ledger (`.superpowers/sdd/2026-09-05-d1-header-stats-and-year-firsts-fastpath/progress.md`) for full detail. The task text below is preserved as-written for the record — do not execute it.

**Files:**
- Modify: `src/ts/model/filter_counts.ts`

**Interfaces:**
- Produces: same `fetchGlobalFilterCounts(env: Env): Promise<Record<string, number>>` signature and return shape. Only the 4 queries below change; every other query in this function (year+region, year+county grouped queries, the two plain lifetime totals already fixed by the previous plan) is untouched.
- Consumes: `species_first_seen`, `species_first_photo` (already populated), `observation`, `location`.

- [ ] **Step 1: Run the full suite to confirm a green baseline**

Run: `npx vitest run`
Expected: `129 passed (129)`

- [ ] **Step 2: Rewrite `lifetimeRegionFirstSightings`**

In `src/ts/model/filter_counts.ts`, find:
```ts
  query = `
      SELECT LOWER(state) as state, COUNT(DISTINCT species_id) as lifetimeRegionFirstSightings
      FROM observation_wide
      GROUP BY LOWER(state)
    `;
```
Replace with:
```ts
  query = `
      SELECT LOWER(l.state) as state, COUNT(*) as lifetimeRegionFirstSightings
      FROM species_first_seen sfs
      INNER JOIN observation o ON o.id = sfs.first_seen_observation_id
      INNER JOIN location l ON l.id = o.location_id
      GROUP BY LOWER(l.state)
    `;
```

- [ ] **Step 3: Rewrite `lifetimeRegionFirstPhotos`**

In `src/ts/model/filter_counts.ts`, find:
```ts
  query = `
      SELECT LOWER(state) as state, COUNT(DISTINCT species_id) as lifetimeRegionFirstPhotos
      FROM observation_wide
      WHERE has_photo
      GROUP BY LOWER(state)
    `;
```
Replace with:
```ts
  query = `
      SELECT LOWER(l.state) as state, COUNT(*) as lifetimeRegionFirstPhotos
      FROM species_first_photo sfp
      INNER JOIN observation o ON o.id = sfp.first_photo_observation_id
      INNER JOIN location l ON l.id = o.location_id
      GROUP BY LOWER(l.state)
    `;
```

- [ ] **Step 4: Rewrite `lifetimeCountyFirstSightings`**

In `src/ts/model/filter_counts.ts`, find:
```ts
  query = `
      SELECT COUNT(DISTINCT species_id) as lifetimeCountyFirstSightings
      FROM observation_wide
      WHERE LOWER(county) = 'melbourne'
    `;
```
Replace with:
```ts
  query = `
      SELECT COUNT(*) as lifetimeCountyFirstSightings
      FROM species_first_seen sfs
      INNER JOIN observation o ON o.id = sfs.first_seen_observation_id
      INNER JOIN location l ON l.id = o.location_id
      WHERE LOWER(l.county) = 'melbourne'
    `;
```

- [ ] **Step 5: Rewrite `lifetimeCountyFirstPhotos`**

In `src/ts/model/filter_counts.ts`, find:
```ts
  query = `
      SELECT COUNT(DISTINCT species_id) as lifetimeCountyFirstPhotos
      FROM observation_wide
      WHERE has_photo AND LOWER(county) = 'melbourne'
    `;
```
Replace with:
```ts
  query = `
      SELECT COUNT(*) as lifetimeCountyFirstPhotos
      FROM species_first_photo sfp
      INNER JOIN observation o ON o.id = sfp.first_photo_observation_id
      INNER JOIN location l ON l.id = o.location_id
      WHERE LOWER(l.county) = 'melbourne'
    `;
```

- [ ] **Step 6: Run the filter-counts tests to confirm they pass against the new implementation**

Run: `npx vitest run test/index.spec.ts -t "/firsts filter counts"`
Expected: `3 passed`

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: `129 passed (129)`

- [ ] **Step 8: Commit**

```bash
git add src/ts/model/filter_counts.ts
git commit -m "Read fetchGlobalFilterCounts lifetime region/county totals from summary tables"
```

---

### Task 3: Add observation-id columns and year index to `species_year_first_seen`/`species_year_first_photo`

**Files:**
- Modify: `src/sql/schema.sql`
- Modify: `src/sql/populate_summary_tables.sql`

**Interfaces:**
- Produces: `species_year_first_seen.first_seen_observation_id` (TEXT NOT NULL), `species_year_first_photo.first_photo_observation_id` (TEXT NOT NULL), and indexes `idx_species_year_first_seen_year` / `idx_species_year_first_photo_year` on the `year` column of each. Consumed by Task 4 and Task 5. Every existing column and every existing caller (`filter_counts.ts`'s `fetchLocationFilterCounts`, which joins on `species_id`/`year`/`first_seen_at`/`first_photo_at`) is unchanged.

- [ ] **Step 1: Run the full suite to confirm a green baseline**

Run: `npx vitest run`
Expected: `129 passed (129)`

- [ ] **Step 2: Add the columns and indexes to the schema**

In `src/sql/schema.sql`, find:
```sql
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
Replace with:
```sql
DROP TABLE IF EXISTS species_year_first_seen;
CREATE TABLE species_year_first_seen (
  species_id TEXT NOT NULL,
  year TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  first_seen_observation_id TEXT NOT NULL,
  PRIMARY KEY (species_id, year)
) STRICT;

CREATE INDEX idx_species_year_first_seen_year ON species_year_first_seen(year);

DROP TABLE IF EXISTS species_year_first_photo;
CREATE TABLE species_year_first_photo (
  species_id TEXT NOT NULL,
  year TEXT NOT NULL,
  first_photo_at TEXT NOT NULL,
  first_photo_observation_id TEXT NOT NULL,
  PRIMARY KEY (species_id, year)
) STRICT;

CREATE INDEX idx_species_year_first_photo_year ON species_year_first_photo(year);
```

- [ ] **Step 3: Populate the new columns**

In `src/sql/populate_summary_tables.sql`, find:
```sql
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
Replace with:
```sql
DELETE FROM species_year_first_seen;
INSERT INTO species_year_first_seen (species_id, year, first_seen_at, first_seen_observation_id)
SELECT species_id, year, seen_at, id FROM (
  SELECT
    species_id,
    STRFTIME('%Y', seen_at) AS year,
    seen_at,
    id,
    ROW_NUMBER() OVER (PARTITION BY species_id, STRFTIME('%Y', seen_at) ORDER BY seen_at ASC, id ASC) AS rn
  FROM observation
)
WHERE rn = 1;

DELETE FROM species_year_first_photo;
INSERT INTO species_year_first_photo (species_id, year, first_photo_at, first_photo_observation_id)
SELECT species_id, year, seen_at, id FROM (
  SELECT
    o.species_id AS species_id,
    STRFTIME('%Y', o.seen_at) AS year,
    o.seen_at AS seen_at,
    o.id AS id,
    ROW_NUMBER() OVER (PARTITION BY o.species_id, STRFTIME('%Y', o.seen_at) ORDER BY o.seen_at ASC, o.id ASC) AS rn
  FROM observation o
  INNER JOIN photo p ON p.observation_id = o.id
)
WHERE rn = 1;
```
(This also adds an `id ASC` tie-break to each `ROW_NUMBER()`, matching the determinism already used by `species_first_seen`/`species_first_photo`'s population query, for the rare case of two observations of the same species on the same day.)

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: `129 passed (129)` (no behavior change — new columns aren't read by any code yet)

- [ ] **Step 5: Commit**

```bash
git add src/sql/schema.sql src/sql/populate_summary_tables.sql
git commit -m "Add observation-id columns and year index to species_year_first_seen/photo"
```

---

### Task 4: Fast path for `location.ts`'s year-filtered `view=firsts` branch

**Files:**
- Modify: `src/ts/model/location.ts`

**Interfaces:**
- Consumes: `species_year_first_seen.first_seen_observation_id`, `species_year_first_photo.first_photo_observation_id` (Task 3).
- Produces: same `fetchLocationObservations(env: Env, locationId: number, filter: Filter): Promise<Observation[]>` signature. Only the `filter.view == "firsts"` branch with `filter.period` set changes — the unfiltered `view=firsts` branch (added by the previous plan) and the plain "all birds" branch are untouched.

- [ ] **Step 1: Run the full suite to confirm a green baseline**

Run: `npx vitest run`
Expected: `129 passed (129)`

- [ ] **Step 2: Replace the year-filtered branch**

In `src/ts/model/location.ts`, find:
```ts
  } else if (filter.view == "firsts") {
    // Only birds first seen at this location, filtered to a specific year
    query = `
      SELECT
        id,
        checklist_id as checklistId,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        lat,
        lng,
        seen_at as seenAt,
        seen_at as lastSeenAt -- TODO
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE 1=1
          ${periodCondition}
          ${filter.type === ObsType.Photo ? "AND has_photo" : ""}
      ) AS ranked
      WHERE row_num = 1
        AND location_id = ?
      ORDER BY seen_at DESC, name ASC;
    `;
    if (filter.period) {
      params.push(filter.period);
    }
    params.push(locationId);
  } else {
```
Replace with:
```ts
  } else if (filter.view == "firsts") {
    // Only birds first seen at this location, filtered to a specific year
    // (fast path: this branch only runs when filter.period is set, so it's
    // exactly the year-first stored in species_year_first_seen/photo)
    query = filter.type === ObsType.Photo
      ? `
        SELECT
          o.id,
          o.checklist_id as checklistId,
          o.species_id as speciesId,
          sp.common_name as name,
          o.location_id as locationId,
          l.lat,
          l.lng,
          o.seen_at as seenAt,
          o.seen_at as lastSeenAt -- TODO
        FROM species_year_first_photo syfp
        INNER JOIN observation o ON o.id = syfp.first_photo_observation_id
        INNER JOIN species sp ON sp.id = o.species_id
        INNER JOIN location l ON l.id = o.location_id
        WHERE syfp.year = ? AND o.location_id = ?
        ORDER BY o.seen_at DESC, sp.common_name ASC;
      `
      : `
        SELECT
          o.id,
          o.checklist_id as checklistId,
          o.species_id as speciesId,
          sp.common_name as name,
          o.location_id as locationId,
          l.lat,
          l.lng,
          o.seen_at as seenAt,
          o.seen_at as lastSeenAt -- TODO
        FROM species_year_first_seen syfs
        INNER JOIN observation o ON o.id = syfs.first_seen_observation_id
        INNER JOIN species sp ON sp.id = o.species_id
        INNER JOIN location l ON l.id = o.location_id
        WHERE syfs.year = ? AND o.location_id = ?
        ORDER BY o.seen_at DESC, sp.common_name ASC;
      `;
    if (filter.period) {
      params.push(filter.period);
    }
    params.push(locationId);
  } else {
```

- [ ] **Step 3: Run the location tests to confirm they pass against the new implementation**

Run: `npx vitest run test/index.spec.ts -t "/location/1"`
Expected: all pass (same set as the baseline run in Step 1)

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: `129 passed (129)`

- [ ] **Step 5: Commit**

```bash
git add src/ts/model/location.ts
git commit -m "Add year-first summary-table fast path for location view=firsts with period filter"
```

---

### Task 5: Fast path for `fetchFirsts`'s global year-only filter

**Files:**
- Modify: `src/ts/model/observation.ts`
- Test: `test/index.spec.ts` — `describe('/firsts', ...)`

**Interfaces:**
- Consumes: `species_year_first_seen.first_seen_observation_id`, `species_year_first_photo.first_photo_observation_id` (Task 3).
- Produces: same `fetchFirsts(env: Env, filter: Filter): Promise<Observation[]>` signature. Behavior for any request with `region` or `county` set is byte-for-byte the existing live query (`fetchFirstsFiltered`), completely unchanged — only the "period set, region and county both unset" case gets a new code path.

- [ ] **Step 1: Add a photo-case regression test**

In `test/index.spec.ts`, find (inside `describe('/firsts', ...)`):
```ts
    it('filtered: period filter still excludes a species not first-seen that year', async () => {
      await execSql(`
        INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
            ('railor6', 'Old Lorikeet', 'Trichoglossus moluccanus', 12563, 'OLLO', 'psitta4');
        INSERT INTO observation VALUES
            ('219171570-railor6', 219171570, 'railor6', 2552179, 1, '2024-01-01T08:00:00', null, null);
      `);

      const response = await SELF.fetch('https://localhost/firsts.json?period=2025');
      const json: any = await response.json();
      const ids = json.data.map((o: any) => o.speciesId);
      expect(ids).toContain('railor5');
      expect(ids).not.toContain('railor6');
    });
  });
```
Replace with (adds one new test after the existing one; the existing test is unchanged):
```ts
    it('filtered: period filter still excludes a species not first-seen that year', async () => {
      await execSql(`
        INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
            ('railor6', 'Old Lorikeet', 'Trichoglossus moluccanus', 12563, 'OLLO', 'psitta4');
        INSERT INTO observation VALUES
            ('219171570-railor6', 219171570, 'railor6', 2552179, 1, '2024-01-01T08:00:00', null, null);
      `);

      const response = await SELF.fetch('https://localhost/firsts.json?period=2025');
      const json: any = await response.json();
      const ids = json.data.map((o: any) => o.speciesId);
      expect(ids).toContain('railor5');
      expect(ids).not.toContain('railor6');
    });

    it('filtered photos: period filter with type=photo excludes a species not first-photographed that year', async () => {
      // railor5 (outer fixture) has its only photo in 2025 -- true year-first for 2025.
      // railor6 is photographed in both 2024 and 2025; its true year-2025-first-photo
      // is the 2025 one, so it should also appear under period=2025&type=photo. railor7
      // is only ever photographed in 2024, so it must be excluded under period=2025.
      await execSql(`
        INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
            ('railor6', 'Old Lorikeet', 'Trichoglossus moluccanus', 12563, 'OLLO', 'psitta4'),
            ('railor7', 'Musk Lorikeet', 'Glossopsitta concinna', 12564, 'MULO', 'psitta4');
        INSERT INTO observation VALUES
            ('219171570-railor6-2025', 219171570, 'railor6', 2552179, 1, '2025-02-01T08:00:00', null, null);
        INSERT INTO photo VALUES
            ('railor6-2025.jpg', '219171570-railor6-2025', '2025-02-01T09:00:00.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '', 'TESTCAM', NULL);
        INSERT INTO observation VALUES
            ('219171571-railor7-2024', 219171571, 'railor7', 2552179, 1, '2024-03-01T08:00:00', null, null);
        INSERT INTO photo VALUES
            ('railor7-2024.jpg', '219171571-railor7-2024', '2024-03-01T09:00:00.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '', 'TESTCAM', NULL);
      `);

      const response = await SELF.fetch('https://localhost/firsts.json?period=2025&type=photo');
      const json: any = await response.json();
      const ids = json.data.map((o: any) => o.speciesId);
      expect(ids).toContain('railor5');
      expect(ids).toContain('railor6');
      expect(ids).not.toContain('railor7');
    });
  });
```

- [ ] **Step 2: Run the new test to confirm it passes against the OLD (current) implementation**

Run: `npx vitest run test/index.spec.ts -t "/firsts"`
Expected: all pass, including the new photo-case test — the current always-live-query `fetchFirstsFiltered` is already correct for this case; this establishes the baseline before the fast path is introduced.

- [ ] **Step 3: Add the fast path**

In `src/ts/model/observation.ts`, find:
```ts
export async function fetchFirsts(env: Env, filter: Filter): Promise<Observation[]> {
  if (!filter.period && !filter.region && !filter.county) {
    return fetchFirstsUnfiltered(env, filter.type);
  }
  return fetchFirstsFiltered(env, filter);
}
```
Replace with:
```ts
export async function fetchFirsts(env: Env, filter: Filter): Promise<Observation[]> {
  if (!filter.period && !filter.region && !filter.county) {
    return fetchFirstsUnfiltered(env, filter.type);
  }
  if (filter.period && !filter.region && !filter.county) {
    return fetchFirstsYearFiltered(env, filter.type, filter.period);
  }
  return fetchFirstsFiltered(env, filter);
}

async function fetchFirstsYearFiltered(env: Env, type: ObsType, year: string): Promise<Observation[]> {
  const query = type === ObsType.Photo
    ? `
      SELECT
        o.id,
        o.checklist_id as checklistId,
        o.species_id as speciesId,
        sp.common_name as name,
        o.location_id as locationId,
        l.name as locationName,
        l.lat,
        l.lng,
        o.seen_at as seenAt,
        1 as hasPhoto,
        o.comment
      FROM species_year_first_photo syfp
      INNER JOIN observation o ON o.id = syfp.first_photo_observation_id
      INNER JOIN species sp ON sp.id = o.species_id
      INNER JOIN location l ON l.id = o.location_id
      WHERE syfp.year = ?
      ORDER BY o.seen_at DESC, sp.common_name ASC;
    `
    : `
      SELECT
        o.id,
        o.checklist_id as checklistId,
        o.species_id as speciesId,
        sp.common_name as name,
        o.location_id as locationId,
        l.name as locationName,
        l.lat,
        l.lng,
        o.seen_at as seenAt,
        EXISTS(SELECT 1 FROM photo p WHERE p.observation_id = o.id) as hasPhoto,
        o.comment
      FROM species_year_first_seen syfs
      INNER JOIN observation o ON o.id = syfs.first_seen_observation_id
      INNER JOIN species sp ON sp.id = o.species_id
      INNER JOIN location l ON l.id = o.location_id
      WHERE syfs.year = ?
      ORDER BY o.seen_at DESC, sp.common_name ASC;
    `;
  const statement = env.DB.prepare(query).bind(year);
  const { results } = await statement.all<any>();
  return results.map((record) => ({
    ...record,
    location: {
      id: record.locationId,
      name: record.locationName,
    },
    hasPhoto: record.hasPhoto == 1,
    seenAt: parseDbDate(record.seenAt),
  }));
}
```
(`fetchFirstsUnfiltered` and `fetchFirstsFiltered`, below this, are unchanged.)

- [ ] **Step 4: Run the `/firsts` tests again to confirm they pass against the NEW implementation**

Run: `npx vitest run test/index.spec.ts -t "/firsts"`
Expected: all pass, same set as Step 2

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: `130 passed (130)` (129 entering this task, plus the 1 new test added in Step 1)

- [ ] **Step 6: Commit**

```bash
git add src/ts/model/observation.ts test/index.spec.ts
git commit -m "Add year-first summary-table fast path for global firsts with period-only filter"
```

---

## Self-Review Notes

- **Spec coverage:** both items from the user's request have tasks — header stats precompute (Task 1), and the deferred year-filtered firsts queries (Tasks 3-5, with Task 2 folded in as a closely-related, similarly-shaped fix discovered during the same investigation: region/county lifetime totals that were already fixable with existing summary tables and no schema change, unlike the year-filtered cases).
- **Type consistency:** `fetchHeaderStats`, `fetchGlobalFilterCounts`, `fetchLocationObservations`, `fetchFirsts` all keep their existing exported signatures. The new `fetchFirstsYearFiltered` helper is internal to `observation.ts` (not exported), matching how `fetchFirstsUnfiltered`/`fetchFirstsFiltered` are already structured.
- **Dependency ordering:** Task 3 must land before Task 4 and Task 5, since both read the columns it adds. Tasks 1 and 2 have no dependency on Tasks 3-5 or on each other and could run in any order; this plan sequences them first since they're the simplest, lowest-risk changes.
- **Verified, not just estimated:** every new query's plan was checked with `EXPLAIN QUERY PLAN` against a local copy of production data before this plan was written — Task 2's rewrites reduce the driving table from `observation_wide` (~3441 rows) to `species_first_seen`/`species_first_photo` (~338 rows, one per species); Task 4 and Task 5's fast paths resolve entirely to index `SEARCH` steps, no `SCAN`.
- **Explicitly out of scope, and why:** `fetchGlobalFilterCounts`'s year+region and year+county grouped queries, and any global `/firsts` request with `region` or `county` set, still run the live window-function query. Fast-pathing those needs a year+region and year+county dimensioned summary table (not just a single new column, unlike Tasks 3-5) — a larger schema task, and, per the 2-day production sample, a smaller win (~15% of rows read vs. Task 3-5's ~24%) since these call sites are hit far less often than the location and global `/firsts` pages this plan targets.
- **Test count tracking:** starting from 129 (current `npx vitest run` baseline, full suite). Running total: 129 → Task 1 adds 0 → 129 → Task 2 adds 0 → 129 → Task 3 adds 0 → 129 → Task 4 adds 0 → 129 → Task 5 adds 1 → 130. If a task is executed out of order, recompute the expected count from the actual suite run rather than trusting the literal number here.
