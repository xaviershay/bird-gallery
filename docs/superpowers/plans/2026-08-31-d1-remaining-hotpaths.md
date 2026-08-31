# D1 Rows-Read Reduction: Remaining Hot Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue reducing Cloudflare D1 "rows read" cost (the earlier merged plan cut ~90% of the identified cost; this plan addresses the six next-highest-leverage items that were explicitly deferred at the time) by fixing a shared view's inefficiency and extending the precomputed summary tables to more call sites.

**Architecture:** Two SQL views (`observation_wide`, `trip_report_observation`) do a `LEFT JOIN photo` + `SELECT DISTINCT` purely to compute a boolean `has_photo` flag — the `LEFT JOIN` can multiply rows when an observation has more than one photo, and `DISTINCT` then pays to collapse them back down on every single call, for every caller of these views. Swapping to a correlated `EXISTS` subquery removes the duplication at the source, so `DISTINCT` becomes provably unnecessary and both drop out — this benefits every caller of these views uniformly (Task 1). Three other call sites get precomputed-table fast paths added, following the same shape as the previously-merged `fetchLocationFilterCounts`/`fetchHeaderStats`/`fetchTripReportStats` work: `report.ts`'s `isLifer`/`isPhotoLifer` (Task 3), `fetchFirsts` and `location.ts`'s `view=firsts` branch for the common unfiltered case (Task 6), and two of `fetchGlobalFilterCounts`'s eight queries that don't need any new schema (Task 5). Task 2 adds a missing index. Task 4 deletes dead code.

**Tech Stack:** Cloudflare D1 (SQLite), TypeScript, Vitest + `@cloudflare/vitest-pool-workers`.

**Spec:** No separate spec file. This plan's Context section is the spec, distilled from the same production `wrangler d1 insights` investigation as the earlier merged plan (`docs/superpowers/plans/2026-08-31-d1-first-seen-precompute.md`), specifically its "Out of scope" section, which this plan now picks up.

## Context

The earlier merged plan fixed `fetchLocationFilterCounts`, `fetchHeaderStats`, and `fetchTripReportStats`'s firsts queries — together ~90% of identified production D1 cost — by precomputing four summary tables (`species_first_seen`, `species_first_photo`, `species_year_first_seen`, `species_year_first_photo`) at data-load time and joining against them instead of running live `ROW_NUMBER() OVER (PARTITION BY ...)` window functions on every request. It deliberately deferred six items as lower-priority or higher-risk. The user has now asked for all six, with item 2 scoped down to exclude any schema change (its region/county-partitioned queries genuinely can't use the existing summary tables — no state/county dimension in them — and adding one is out of scope here).

The six items, in the order this plan tackles them (foundational/low-risk first):

1. **Fix `observation_wide` and `trip_report_observation` views** (`src/sql/schema.sql`) — remove the `LEFT JOIN photo` + `SELECT DISTINCT` pattern, replace with `EXISTS`. Benefits every remaining caller of these views (`photo.ts`'s five functions, `gallery.ts`, `species.ts`, the filtered fallback in `location.ts`/`observation.ts`, `fetchGlobalFilterCounts`) without touching any of them individually.
2. **Add index on `observation.species_id`** (`src/sql/schema.sql`) — currently unindexed; used by `report.ts`'s correlated subqueries and `species.ts`.
3. **`report.ts`'s `isLifer`/`isPhotoLifer`** — currently a `COUNT(*)` correlated subquery over `observation`, run once per species row on every `/report/opportunities` hit. Replace with `EXISTS`/`NOT EXISTS` against `species_first_seen`/`species_first_photo`. `isYearLifer`/`isLocationLifer` are unbounded-dimension and stay as-is (unchanged, out of scope).
4. **`species.ts`'s dead `ROW_NUMBER()`** — `fetchSpeciesObservations` computes `ROW_NUMBER() OVER (PARTITION BY species_id ...)` but the outer query only ever filters on `species_id = ?` (already applied before the window function could matter) — the `row_num` column is never read. Delete it.
5. **`fetchGlobalFilterCounts` partial simplification** (no schema change) — its two "lifetime" queries (`lifetimeFirstSightings`, `lifetimeFirstPhotos`, both plain `COUNT(DISTINCT species_id)` with no year/state dimension) can read directly from `species_first_seen`/`species_first_photo`. Its other six queries are year/state/county-partitioned and stay as live queries against `observation_wide` (which Task 1 already made cheaper).
6. **Fast path for `fetchFirsts` (`observation.ts`) and `location.ts`'s `view=firsts` branch** — both currently run a live `ROW_NUMBER()` window function unconditionally. When there's no year/region/county filter (the common case: home page, plain `/firsts`, plain `?view=firsts`), the result is exactly what `species_first_seen`/`species_first_photo` already store — read from there instead. Fall back to the existing live query, completely unchanged, whenever any filter is present.

## Global Constraints

- Every task must keep `npx vitest run test/index.spec.ts` fully green throughout, and specifically must not regress any test from the previously-merged plan.
- **Test coverage comes first, in every task.** Before changing any query or schema, add or confirm the test(s) that would catch a regression in that exact change, run them against the OLD code to establish they pass as a baseline, then make the change, then confirm they still pass. This plan's task-coverage audit (below) identified real gaps for Tasks 1, 3, 5's proof (already covered), and 6 — those tasks add tests as their first steps. Tasks 2 and 4 have no behavior change and rely on the full suite staying green.
- Task 1's view changes must not alter any query's output — this is a pure query-plan optimization. Every task downstream of Task 1 (2-6) depends on it being merged first and correct.
- Don't touch `fetchGlobalFilterCounts`'s six region/state/county-partitioned queries, `isYearLifer`/`isLocationLifer` in `report.ts`, or any other item explicitly marked out of scope in the earlier plan and not listed above.

## Task-coverage audit (performed before writing this plan)

| Item | Existing coverage | Gap found | Task's response |
|---|---|---|---|
| 1 (view fix) | None direct — `observation_wide`/`trip_report_observation` are never tested at the SQL layer, and every HTTP-level caller already has its own `DISTINCT`/`GROUP BY`/`row_num=1` that would mask a duplication bug in the view itself | Real gap: nothing would catch the view producing 2 rows for an observation with 2 photos | Task 1 adds 2 direct SQL-layer tests (query `env.DB` directly) before touching the view |
| 2 (index) | N/A, no behavior change | None | Full suite is the check |
| 3 (isLifer/isPhotoLifer) | Good — 4 existing tests assert `isLifer`/`isPhotoLifer`/`isLocationLifer` across region scenarios | All existing fixture species have observations — `isLifer: true` (a species never observed at all) is never exercised | Task 3 adds a species with zero observations and asserts `isLifer: true`, `isPhotoLifer: false` |
| 4 (species.ts cleanup) | Thin — one smoke test checks the page renders, not observation order/content | Real gap, though risk is low since the code being removed is provably dead | Task 4 adds a 2-observation ordering test before removing the dead window function |
| 5 (fetchGlobalFilterCounts partial) | Strong — existing `/firsts filter counts` tests assert `World/Seen` and `World/Photo` values for the Life row, which are exactly `lifetimeFirstSightings`/`lifetimeFirstPhotos` | None | No new test needed; existing tests are the regression guard |
| 6 (firsts fast path) | Partial — `/location/1`'s `view=firsts` tests already pin the unfiltered case well (added in the earlier plan); nothing tests the *filtered* path (`period` combined with `view=firsts`, or `/firsts?period=...`) continuing to work once a fast-path branch is introduced | Real gap on the filtered/fallback side | Task 6 adds a filtered-case test for both `fetchFirsts` and the location `view=firsts` branch |

---

### Task 1: Fix `observation_wide` and `trip_report_observation` views

**Files:**
- Modify: `src/sql/schema.sql`
- Test: `test/index.spec.ts` (new `describe('database views', ...)` block)

**Interfaces:**
- Produces: `observation_wide` and `trip_report_observation` with identical column output and row cardinality (one row per underlying `observation` row) as before, just computed cheaper. No caller of either view needs any change.

- [ ] **Step 1: Add the SQL-layer regression tests**

In `test/index.spec.ts`, find:
```ts
      const content = await response.text();
      expect(content).toContain('seen <!-- -->2<!-- --> different species');
      expect(content).toContain('photographed <!-- -->1<!-- -->.');
    });
  })

  describe('/location/1', () => {
```
Replace with (inserts a new `describe('database views', ...)` block between the end of `describe('header stats', ...)` and the start of `describe('/location/1', ...)`, leaving both of those otherwise untouched):
```ts
      const content = await response.text();
      expect(content).toContain('seen <!-- -->2<!-- --> different species');
      expect(content).toContain('photographed <!-- -->1<!-- -->.');
    });
  })

  describe('database views', () => {
    it('observation_wide has exactly one row per observation, even with multiple photos', async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
            (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne', 1);
        INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
            ('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
        INSERT INTO observation VALUES
            ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null, null);
        INSERT INTO photo VALUES
            ('railor5-a.jpg', '219171569-railor5', '2025-04-01T08:00:00.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '', 'TESTCAM', NULL);
        INSERT INTO photo VALUES
            ('railor5-b.jpg', '219171569-railor5', '2025-04-02T08:00:00.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '', 'TESTCAM', NULL);
      `);

      const result = await env.DB.prepare(
        "SELECT COUNT(*) as c, MAX(has_photo) as hasPhoto FROM observation_wide WHERE id = ?"
      ).bind('219171569-railor5').first<any>();

      expect(result.c).toBe(1);
      expect(result.hasPhoto).toBe(1);
    });

    it('trip_report_observation has exactly one row per observation, even with multiple photos', async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
            (1, 'Alpha Park', -37.70, 144.90, 'AU-VIC', 'Melbourne', 1);
        INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
            ('sp1', 'Species One', 'S1', 1, 'S1', 'fam1');
        INSERT INTO observation VALUES
            ('o1-sp1', 1, 'sp1', 1, 1, '2025-04-02T10:00:00', NULL, NULL);
        INSERT INTO photo VALUES
            ('sp1-a.jpg', 'o1-sp1', '2025-04-02T10:00:00.000Z', 3, 1000, 1500, '200', 'f/5.6', 0.001, '300mm', '', 'Canon', NULL);
        INSERT INTO photo VALUES
            ('sp1-b.jpg', 'o1-sp1', '2025-04-02T11:00:00.000Z', 3, 1000, 1500, '200', 'f/5.6', 0.001, '300mm', '', 'Canon', NULL);
        INSERT INTO trip_report (id, title, description, start_date, end_date, created_at) VALUES
            ('test-trip', 'Test Trip', 'A test trip description', '2025-04-01', '2025-04-07', '2025-01-01T00:00:00');
        INSERT INTO trip_report_checklist (trip_report_id, checklist_id) VALUES
            ('test-trip', 1);
      `);

      const result = await env.DB.prepare(
        "SELECT COUNT(*) as c, MAX(has_photo) as hasPhoto FROM trip_report_observation WHERE id = ?"
      ).bind('o1-sp1').first<any>();

      expect(result.c).toBe(1);
      expect(result.hasPhoto).toBe(1);
    });
  });

  describe('/location/1', () => {
```
(Note the trailing `describe('/location/1', () => {` line — it's reproduced unchanged from the original, since the "find" block above ended there just to anchor the insertion point; do not delete it.)

- [ ] **Step 2: Run the new tests to confirm they pass against the OLD (current) view definitions**

Run: `npx vitest run test/index.spec.ts -t "database views"`
Expected: `2 passed` — the current `DISTINCT`-based views already produce correct output; this establishes the baseline these tests must continue to pass after Step 3.

- [ ] **Step 3: Rewrite the two views**

In `src/sql/schema.sql`, find:
```sql
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
```
Replace with:
```sql
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
```
Note: `LEFT JOIN photo` is removed entirely from both views (no longer needed — `has_photo` no longer depends on a join), and `SELECT DISTINCT` / `SELECT DISTINCT trc.trip_report_id, ...` become plain `SELECT`.

- [ ] **Step 4: Run the new tests again to confirm they still pass against the NEW view definitions**

Run: `npx vitest run test/index.spec.ts -t "database views"`
Expected: `2 passed`

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run test/index.spec.ts`
Expected: `42 passed (42)` (the 40 from the previously-merged plan, plus the 2 new tests added in Step 1)

- [ ] **Step 6: Commit**

```bash
git add src/sql/schema.sql test/index.spec.ts
git commit -m "Fix observation_wide/trip_report_observation to avoid DISTINCT via EXISTS join"
```

---

### Task 2: Add index on `observation.species_id`

**Files:**
- Modify: `src/sql/schema.sql`

**Interfaces:**
- Produces: index `idx_observation_species_id`. Consumed implicitly by Task 3 (report.ts, once rewritten, no longer needs it directly for isLifer/isPhotoLifer since those move to summary-table lookups — but `isYearLifer`/`isLocationLifer`, left unchanged, both still filter `observation` by `species_id = ?` and benefit) and by Task 4 (`fetchSpeciesObservations`, which filters `species_id = ?`).

- [ ] **Step 1: Run the full suite to confirm a green baseline**

Run: `npx vitest run test/index.spec.ts`
Expected: `42 passed (42)` (Task 1 must be merged first — see this plan's dependency ordering note)

- [ ] **Step 2: Add the index**

In `src/sql/schema.sql`, find:
```sql
CREATE INDEX idx_observation_location_id ON observation(location_id);
CREATE INDEX idx_observation_checklist_id ON observation(checklist_id);
```
Replace with:
```sql
CREATE INDEX idx_observation_location_id ON observation(location_id);
CREATE INDEX idx_observation_checklist_id ON observation(checklist_id);
CREATE INDEX idx_observation_species_id ON observation(species_id);
```

- [ ] **Step 3: Run the full suite again**

Run: `npx vitest run test/index.spec.ts`
Expected: `42 passed (42)` (no new tests in this task — pure index addition, no behavior change)

- [ ] **Step 4: Commit**

```bash
git add src/sql/schema.sql
git commit -m "Add index on observation.species_id"
```

---

### Task 3: Rewrite `isLifer`/`isPhotoLifer` in `report.ts`

**Files:**
- Modify: `src/ts/model/report.ts`
- Test: `test/index.spec.ts` — `describe('/report/opportunities', ...)` (add a species with zero observations, plus a new test)

**Interfaces:**
- Consumes: `species_first_seen`, `species_first_photo` (already populated by the earlier-merged plan's `populate_summary_tables.sql`, refreshed in tests by `execSql`'s existing summary refresh).
- Produces: same `fetchBirdingOpportunitiesTags(env: Env, region: string, location: string | null): Promise<SpeciesWithTags[]>` signature and `SpeciesWithTags` shape. `isYearLifer`/`isLocationLifer` computation is untouched.

- [ ] **Step 1: Add a species with zero observations to the fixture, and a test for it**

In `test/index.spec.ts`, find the `describe('/report/opportunities', ...)` block's `beforeEach`:
```ts
    beforeEach(async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
          (919153, 'Melbourne Park', -37.82, 144.98, 'AU-VIC', 'Melbourne', 1),
          (999999, 'Sydney Park', -33.87, 151.21, 'AU-NSW', 'Sydney', 1);
        INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
          ('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 1, 'RL', 'fam1'),
          ('magpie1', 'Australian Magpie', 'Gymnorhina tibicen', 2, 'AM', 'fam1'),
          ('cockat1', 'Sulphur-crested Cockatoo', 'Cacatua galerita', 3, 'SC', 'fam1');
        INSERT INTO observation VALUES
          ('obs1', 1, 'railor5', 919153, 1, '2025-01-10T10:00:00', NULL, NULL);
        INSERT INTO observation VALUES
          ('obs2', 2, 'magpie1', 919153, 1, '2025-01-11T10:00:00', NULL, NULL);
        INSERT INTO observation VALUES
          ('obs3', 3, 'cockat1', 999999, 1, '2025-01-12T10:00:00', NULL, NULL);
        INSERT INTO photo (file_name, observation_id, taken_at, rating, height, width, iso, fnumber, exposure, zoom, tags, camera, lens) VALUES
          ('railor5.jpg', 'obs1', '2025-01-10T10:00:00', 3, 1000, 1500, '200', 'f/5.6', 0.001, '300mm', 'bird', 'Canon', NULL);
        INSERT INTO photo (file_name, observation_id, taken_at, rating, height, width, iso, fnumber, exposure, zoom, tags, camera, lens) VALUES
          ('cockatoo.jpg', 'obs3', '2025-01-12T10:00:00', 3, 1000, 1500, '200', 'f/5.6', 0.001, '300mm', 'bird', 'Canon', NULL);
      `);
    });
```
Replace with (adds a 4th species, `neverseen1`, with no observations at all):
```ts
    beforeEach(async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
          (919153, 'Melbourne Park', -37.82, 144.98, 'AU-VIC', 'Melbourne', 1),
          (999999, 'Sydney Park', -33.87, 151.21, 'AU-NSW', 'Sydney', 1);
        INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
          ('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 1, 'RL', 'fam1'),
          ('magpie1', 'Australian Magpie', 'Gymnorhina tibicen', 2, 'AM', 'fam1'),
          ('cockat1', 'Sulphur-crested Cockatoo', 'Cacatua galerita', 3, 'SC', 'fam1'),
          ('neverseen1', 'Never Seen Bird', 'Nunquam visus', 4, 'NS', 'fam1');
        INSERT INTO observation VALUES
          ('obs1', 1, 'railor5', 919153, 1, '2025-01-10T10:00:00', NULL, NULL);
        INSERT INTO observation VALUES
          ('obs2', 2, 'magpie1', 919153, 1, '2025-01-11T10:00:00', NULL, NULL);
        INSERT INTO observation VALUES
          ('obs3', 3, 'cockat1', 999999, 1, '2025-01-12T10:00:00', NULL, NULL);
        INSERT INTO photo (file_name, observation_id, taken_at, rating, height, width, iso, fnumber, exposure, zoom, tags, camera, lens) VALUES
          ('railor5.jpg', 'obs1', '2025-01-10T10:00:00', 3, 1000, 1500, '200', 'f/5.6', 0.001, '300mm', 'bird', 'Canon', NULL);
        INSERT INTO photo (file_name, observation_id, taken_at, rating, height, width, iso, fnumber, exposure, zoom, tags, camera, lens) VALUES
          ('cockatoo.jpg', 'obs3', '2025-01-12T10:00:00', 3, 1000, 1500, '200', 'f/5.6', 0.001, '300mm', 'bird', 'Canon', NULL);
      `);
    });
```

Then add this new test inside the same `describe('/report/opportunities', ...)` block, alongside the other `it(...)` blocks:
```ts
    it('marks a species with zero observations as a lifer, not a photo lifer', async () => {
      const response = await SELF.fetch('https://localhost/report/opportunities.json?region=AU-VIC-MEL');
      const json: any = await response.json();
      const never = json.find((s: any) => s.id === 'neverseen1');
      expect(never).toBeDefined();
      expect(never.isLifer).toBe(true);
      expect(never.isPhotoLifer).toBe(false);
    });
```

- [ ] **Step 2: Run the report tests to confirm they pass against the OLD implementation (including the new test)**

Run: `npx vitest run test/index.spec.ts -t "/report/opportunities"`
Expected: all pass (the existing tests plus the new one — `isLifer`/`isPhotoLifer` are already correctly computed by the current `COUNT(*)` implementation, this just adds a previously-unexercised case)

- [ ] **Step 3: Rewrite the two fields**

In `src/ts/model/report.ts`, find:
```ts
    SELECT 
      s.id,
      s.common_name as name,
      -- isLifer: no observations anywhere
      (SELECT COUNT(*) FROM observation WHERE species_id = s.id) = 0 as isLifer,
      -- isPhotoLifer: has observations but no photos
      (SELECT COUNT(*) FROM observation WHERE species_id = s.id) > 0 
        AND (SELECT COUNT(*) FROM observation o2 
             INNER JOIN photo ON o2.id = photo.observation_id 
             WHERE o2.species_id = s.id) = 0 as isPhotoLifer,
      -- isYearLifer: no observations this year
```
Replace with:
```ts
    SELECT 
      s.id,
      s.common_name as name,
      -- isLifer: no observations anywhere
      NOT EXISTS (SELECT 1 FROM species_first_seen WHERE species_id = s.id) as isLifer,
      -- isPhotoLifer: has observations but no photos
      EXISTS (SELECT 1 FROM species_first_seen WHERE species_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM species_first_photo WHERE species_id = s.id) as isPhotoLifer,
      -- isYearLifer: no observations this year
```
(The `isYearLifer`/`isLocationLifer` lines below this, and everything else in the file, are unchanged.)

- [ ] **Step 4: Run the report tests again to confirm they pass against the NEW implementation**

Run: `npx vitest run test/index.spec.ts -t "/report/opportunities"`
Expected: all pass, same set as Step 2

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run test/index.spec.ts`
Expected: `43 passed (43)` (42 entering this task, plus the 1 new test added in Step 1)

- [ ] **Step 6: Commit**

```bash
git add src/ts/model/report.ts test/index.spec.ts
git commit -m "Read isLifer/isPhotoLifer from precomputed summary tables"
```

---

### Task 4: Remove dead `ROW_NUMBER()` from `fetchSpeciesObservations`

**Files:**
- Modify: `src/ts/model/species.ts`
- Test: `test/index.spec.ts` — `describe('/species', ...)`

**Interfaces:**
- Produces: same `fetchSpeciesObservations(env: Env, speciesId: string): Promise<Observation[]>` signature and output — the `row_num` column being removed was never read by any caller, so output is unchanged.

- [ ] **Step 1: Add an ordering test**

In `test/index.spec.ts`, find the `describe('/species', ...)` block:
```ts
  describe('/species', () => {
    beforeEach(async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
            (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne', 1);
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null, null);
			`,)
    })
    it('renders species data', async () => {
      const response = await SELF.fetch('https://localhost/species/railor5');
      const content = await response.text();
      expect(content).toContain("Rainbow Lorikeet</h2>");
    });
  });
```
Replace with (adds a new test after the existing one; the `beforeEach` is unchanged):
```ts
  describe('/species', () => {
    beforeEach(async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
            (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne', 1);
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null, null);
			`,)
    })
    it('renders species data', async () => {
      const response = await SELF.fetch('https://localhost/species/railor5');
      const content = await response.text();
      expect(content).toContain("Rainbow Lorikeet</h2>");
    });

    it('lists multiple observations most-recent first', async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
            (9999999, 'Elsewhere Park', -38.0, 145.0, 'AU-VIC', 'Geelong', 1);
        INSERT INTO observation VALUES
            ('219171570-railor5', 219171570, 'railor5', 9999999, 1, '2025-05-01T10:00:00', null, null);
      `);

      const response = await SELF.fetch('https://localhost/species/railor5');
      const content = await response.text();

      // Most recent observation (Elsewhere Park, 2025-05-01) should appear before
      // the older one (Royal Park, 2025-03-18) in the rendered table.
      expect(content.indexOf('Elsewhere Park')).toBeLessThan(content.indexOf('Royal Park'));
    });
  });
```

- [ ] **Step 2: Run the species tests to confirm they pass against the OLD implementation**

Run: `npx vitest run test/index.spec.ts -t "/species"`
Expected: `2 passed`

- [ ] **Step 3: Remove the dead window function**

In `src/ts/model/species.ts`, find:
```ts
  query = `
      SELECT
        id,
        checklist_id as checklistId,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        location_name as locationName,
        lat,
        lng,
        seen_at as seenAt
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE 1=1
      ) AS ranked
      WHERE 1=1
        AND species_id = ?
      ORDER BY seen_at DESC, name ASC;
    `;
```
Replace with:
```ts
  query = `
      SELECT
        id,
        checklist_id as checklistId,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        location_name as locationName,
        lat,
        lng,
        seen_at as seenAt
      FROM observation_wide
      WHERE species_id = ?
      ORDER BY seen_at DESC, name ASC;
    `;
```

- [ ] **Step 4: Run the species tests again to confirm they pass against the NEW implementation**

Run: `npx vitest run test/index.spec.ts -t "/species"`
Expected: `2 passed`

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run test/index.spec.ts`
Expected: `44 passed (44)` (43 entering this task, plus the 1 new test added in Step 1)

- [ ] **Step 6: Commit**

```bash
git add src/ts/model/species.ts test/index.spec.ts
git commit -m "Remove dead ROW_NUMBER window function from fetchSpeciesObservations"
```

---

### Task 5: Simplify `fetchGlobalFilterCounts`'s two lifetime queries

**Files:**
- Modify: `src/ts/model/filter_counts.ts` (only the two lifetime-count queries inside `fetchGlobalFilterCounts` — leave the other six queries in that function, and all of `fetchLocationFilterCounts` below it, untouched)

**Interfaces:**
- Consumes: `species_first_seen`, `species_first_photo`.
- Produces: same `fetchGlobalFilterCounts(env: Env): Promise<Record<string, number>>` signature and return shape.

- [ ] **Step 1: Confirm existing coverage passes against the OLD implementation**

Run: `npx vitest run test/index.spec.ts -t "/firsts filter counts"`
Expected: `2 passed` — the existing `'computes lifetime (Life) counts across regions and photo status'` test asserts `World/Seen` and `World/Photo` values, which are exactly the two queries this task rewrites; no new test needed per the coverage audit.

- [ ] **Step 2: Replace the two lifetime queries**

In `src/ts/model/filter_counts.ts`, find:
```ts
  // Get lifetime first sightings (not per-year)
  query = `
      SELECT COUNT(DISTINCT species_id) as lifetimeFirstSightings
      FROM observation_wide
    `;
  statement = env.DB.prepare(query);
  const lifetimeSightingsResult = await statement.first<any>();
  counts[Filter.create({ type: ObsType.Sighting }).toQueryString()] = 
    lifetimeSightingsResult?.lifetimeFirstSightings ?? 0;
```
Replace with:
```ts
  // Get lifetime first sightings (not per-year)
  query = `SELECT COUNT(*) as lifetimeFirstSightings FROM species_first_seen`;
  statement = env.DB.prepare(query);
  const lifetimeSightingsResult = await statement.first<any>();
  counts[Filter.create({ type: ObsType.Sighting }).toQueryString()] = 
    lifetimeSightingsResult?.lifetimeFirstSightings ?? 0;
```

Then find:
```ts
  // Get lifetime first photos (not per-year)
  query = `
      SELECT COUNT(DISTINCT species_id) as lifetimeFirstPhotos
      FROM observation_wide
      WHERE has_photo
    `;
  statement = env.DB.prepare(query);
  const lifetimePhotosResult = await statement.first<any>();
  counts[Filter.create({ type: ObsType.Photo }).toQueryString()] = 
    lifetimePhotosResult?.lifetimeFirstPhotos ?? 0;
```
Replace with:
```ts
  // Get lifetime first photos (not per-year)
  query = `SELECT COUNT(*) as lifetimeFirstPhotos FROM species_first_photo`;
  statement = env.DB.prepare(query);
  const lifetimePhotosResult = await statement.first<any>();
  counts[Filter.create({ type: ObsType.Photo }).toQueryString()] = 
    lifetimePhotosResult?.lifetimeFirstPhotos ?? 0;
```

Everything else in `fetchGlobalFilterCounts` (the year/state queries, the county queries) and all of `fetchLocationFilterCounts` is unchanged.

- [ ] **Step 3: Run the filter-counts tests again to confirm they pass against the NEW implementation**

Run: `npx vitest run test/index.spec.ts -t "/firsts filter counts"`
Expected: `2 passed`

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run test/index.spec.ts`
Expected: `44 passed (44)` (no new tests in this task — existing coverage already asserts the two rewritten values)

- [ ] **Step 5: Commit**

```bash
git add src/ts/model/filter_counts.ts
git commit -m "Read fetchGlobalFilterCounts lifetime totals from summary tables"
```

---

### Task 6: Fast path for `fetchFirsts` and `location.ts`'s `view=firsts` branch

**Files:**
- Modify: `src/ts/model/observation.ts`
- Modify: `src/ts/model/location.ts`
- Test: `test/index.spec.ts` — new tests in `describe('/firsts', ...)` and `describe('/location/1', ...)`

**Interfaces:**
- Consumes: `species_first_seen`, `species_first_photo`.
- Produces: same `fetchFirsts(env: Env, filter: Filter): Promise<Observation[]>` and `fetchLocationObservations(env: Env, locationId: number, filter: Filter): Promise<Observation[]>` signatures. Behavior for any filtered request (period, region, or county set) is byte-for-byte the existing live query, completely unchanged — only the unfiltered case gets a new code path.

- [ ] **Step 1: Add filtered-case regression tests**

In `test/index.spec.ts`, find the `describe('/firsts', ...)` block:
```ts
  describe('/firsts', () => {
    beforeEach(async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
            (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne', 1);
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null, null);
				INSERT INTO photo VALUES
          ('dscn5570.jpg', '219171569-railor5', '2025-05-03T01:53:50.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '', 'TESTCAM', NULL);
			`,)
    })
    it('renders seen', async () => {
      const response = await SELF.fetch('https://localhost/firsts');
      const content = await response.text();
      expect(content).toContain("Firsts");
      expect(content).not.toContain("thumbnails");
    });
    it('renders photos', async () => {
      const response = await SELF.fetch('https://localhost/firsts?type=photo');
      const content = await response.text();
      expect(content).toContain("Firsts");
      expect(content).toContain("thumbnails");
    });
  });
```
Replace with (adds 2 new tests: one confirming the unfiltered fast path's actual content, one confirming the filtered fallback still works):
```ts
  describe('/firsts', () => {
    beforeEach(async () => {
      await execSql(`
        INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
            (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne', 1);
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null, null);
				INSERT INTO photo VALUES
          ('dscn5570.jpg', '219171569-railor5', '2025-05-03T01:53:50.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '', 'TESTCAM', NULL);
			`,)
    })
    it('renders seen', async () => {
      const response = await SELF.fetch('https://localhost/firsts');
      const content = await response.text();
      expect(content).toContain("Firsts");
      expect(content).not.toContain("thumbnails");
    });
    it('renders photos', async () => {
      const response = await SELF.fetch('https://localhost/firsts?type=photo');
      const content = await response.text();
      expect(content).toContain("Firsts");
      expect(content).toContain("thumbnails");
    });

    it('unfiltered: excludes a species whose lifetime-first sighting is not in this fixture at all', async () => {
      // railor6 is seen twice — the earlier sighting (2024) is its true lifetime-first,
      // so only that one row should appear in the unfiltered firsts list, not the 2025 repeat.
      await execSql(`
        INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
            ('railor6', 'Old Lorikeet', 'Trichoglossus moluccanus', 12563, 'OLLO', 'psitta4');
        INSERT INTO observation VALUES
            ('219171570-railor6-first', 219171570, 'railor6', 2552179, 1, '2024-01-01T08:00:00', null, null);
        INSERT INTO observation VALUES
            ('219171571-railor6-again', 219171571, 'railor6', 2552179, 1, '2025-06-01T08:00:00', null, null);
      `);

      const response = await SELF.fetch('https://localhost/firsts.json');
      const json: any = await response.json();
      const railor6Rows = json.data.filter((o: any) => o.speciesId === 'railor6');
      expect(railor6Rows.length).toBe(1);
      expect(railor6Rows[0].id).toBe('219171570-railor6-first');
    });

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

In `test/index.spec.ts`, find the `describe('/location/1', ...)` block's existing test `'only shows species first seen at this location under view=firsts'` (added in the earlier plan) and add this new test immediately after it, still inside the same `describe('/location/1', ...)` block:
```ts
    it('view=firsts with a period filter still excludes a species not first-seen at this location that year', async () => {
      await execSql(`
        INSERT INTO observation VALUES
            ('219171572-railor5-2024', 219171572, 'railor5', 2552179, 1, '2024-06-01T08:00:00', null, null);
      `);
      // railor5's outer beforeEach observation is 2025-03-18 (Royal Park); this adds an
      // earlier 2024 observation, also at Royal Park, so railor5's lifetime-first is now
      // 2024 — meaning under view=firsts&period=2025, railor5 should NOT appear (its
      // lifetime-first isn't in 2025), while under view=firsts&period=2024 it should.
      const response2024 = await SELF.fetch('https://localhost/location/2552179?view=firsts&period=2024');
      const content2024 = await response2024.text();
      expect(content2024).toContain('Rainbow Lorikeet');

      const response2025 = await SELF.fetch('https://localhost/location/2552179?view=firsts&period=2025');
      const content2025 = await response2025.text();
      expect(content2025).not.toContain('Rainbow Lorikeet');
    });
```

- [ ] **Step 2: Run the targeted tests to confirm they pass against the OLD implementation**

Run: `npx vitest run test/index.spec.ts -t "/firsts"`
Run: `npx vitest run test/index.spec.ts -t "/location/1"`
Expected: all pass (the current always-live-query implementation is already correct for both filtered and unfiltered cases — these tests establish the baseline before the fast path is introduced)

- [ ] **Step 3: Add the fast path to `fetchFirsts`**

In `src/ts/model/observation.ts`, find the entire file content:
```ts
import { Observation, ObsType } from "../types";
import { Filter } from "../model/filter";
import { parseDbDate } from "../helpers/date_utils";

export async function fetchFirsts(env: Env, filter: Filter): Promise<Observation[]> {
  const yearCondition = filter.period ? `AND strftime('%Y', seen_at) = ?` : "";
  const regionCondition = filter.region
    ? `AND LOWER(state) LIKE LOWER(?) || '%'
    `
    : "";
  const countyCondition = filter.county ? `AND LOWER(county) = LOWER(?)` : "";
  const photoCondition = filter.type == ObsType.Photo ? "AND has_photo" : "";
  const query = `
      SELECT
        id,
        checklist_id as checklistId,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        location_name as locationName,
        lat,
        lng,
        seen_at as seenAt,
        has_photo as hasPhoto,
        comment
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE 1=1
          ${yearCondition}
          ${regionCondition}
          ${countyCondition}
          ${photoCondition}
      ) AS ranked
      WHERE row_num = 1
      ORDER BY seen_at DESC, name ASC;
    `;
  let statement = env.DB.prepare(query);
  const params: (string | null)[] = [];
  if (filter.period) {
    params.push(filter.period);
  }
  if (filter.region) {
    params.push(filter.region);
  }
  if (filter.county) {
    params.push(filter.county);
  }
  statement = statement.bind(...params);
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
Replace with:
```ts
import { Observation, ObsType } from "../types";
import { Filter } from "../model/filter";
import { parseDbDate } from "../helpers/date_utils";

export async function fetchFirsts(env: Env, filter: Filter): Promise<Observation[]> {
  if (!filter.period && !filter.region && !filter.county) {
    return fetchFirstsUnfiltered(env, filter.type);
  }
  return fetchFirstsFiltered(env, filter);
}

async function fetchFirstsUnfiltered(env: Env, type: ObsType): Promise<Observation[]> {
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
      FROM species_first_photo sfp
      INNER JOIN observation o ON o.id = sfp.first_photo_observation_id
      INNER JOIN species sp ON sp.id = o.species_id
      INNER JOIN location l ON l.id = o.location_id
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
      FROM species_first_seen sfs
      INNER JOIN observation o ON o.id = sfs.first_seen_observation_id
      INNER JOIN species sp ON sp.id = o.species_id
      INNER JOIN location l ON l.id = o.location_id
      ORDER BY o.seen_at DESC, sp.common_name ASC;
    `;
  const statement = env.DB.prepare(query);
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

async function fetchFirstsFiltered(env: Env, filter: Filter): Promise<Observation[]> {
  const yearCondition = filter.period ? `AND strftime('%Y', seen_at) = ?` : "";
  const regionCondition = filter.region
    ? `AND LOWER(state) LIKE LOWER(?) || '%'
    `
    : "";
  const countyCondition = filter.county ? `AND LOWER(county) = LOWER(?)` : "";
  const photoCondition = filter.type == ObsType.Photo ? "AND has_photo" : "";
  const query = `
      SELECT
        id,
        checklist_id as checklistId,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        location_name as locationName,
        lat,
        lng,
        seen_at as seenAt,
        has_photo as hasPhoto,
        comment
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE 1=1
          ${yearCondition}
          ${regionCondition}
          ${countyCondition}
          ${photoCondition}
      ) AS ranked
      WHERE row_num = 1
      ORDER BY seen_at DESC, name ASC;
    `;
  let statement = env.DB.prepare(query);
  const params: (string | null)[] = [];
  if (filter.period) {
    params.push(filter.period);
  }
  if (filter.region) {
    params.push(filter.region);
  }
  if (filter.county) {
    params.push(filter.county);
  }
  statement = statement.bind(...params);
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

- [ ] **Step 4: Add the fast path to `location.ts`'s `view=firsts` branch**

In `src/ts/model/location.ts`, find:
```ts
  if (filter.view == "firsts") {
    // Only birds first seen at this location
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
  if (filter.view == "firsts" && !filter.period) {
    // Only birds first seen at this location (no year filter: fast path via summary tables)
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
          o.seen_at as lastSeenAt
        FROM species_first_photo sfp
        INNER JOIN observation o ON o.id = sfp.first_photo_observation_id
        INNER JOIN species sp ON sp.id = o.species_id
        INNER JOIN location l ON l.id = o.location_id
        WHERE o.location_id = ?
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
          o.seen_at as lastSeenAt
        FROM species_first_seen sfs
        INNER JOIN observation o ON o.id = sfs.first_seen_observation_id
        INNER JOIN species sp ON sp.id = o.species_id
        INNER JOIN location l ON l.id = o.location_id
        WHERE o.location_id = ?
        ORDER BY o.seen_at DESC, sp.common_name ASC;
      `;
    params.push(locationId);
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

- [ ] **Step 5: Run the targeted tests again to confirm they pass against the NEW implementation**

Run: `npx vitest run test/index.spec.ts -t "/firsts"`
Run: `npx vitest run test/index.spec.ts -t "/location/1"`
Expected: all pass, same sets as Step 2

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run test/index.spec.ts`
Expected: `47 passed (47)` (44 entering this task, plus the 3 new tests added in Step 1: 2 in `/firsts`, 1 in `/location/1`)

- [ ] **Step 7: Commit**

```bash
git add src/ts/model/observation.ts src/ts/model/location.ts test/index.spec.ts
git commit -m "Add summary-table fast path for unfiltered firsts queries"
```

---

## Self-Review Notes

- **Spec coverage:** all six user-specified items have a task (1↔Task 1, 2↔Task 2, 3↔Task 3, 4↔Task 4, 5↔Task 5, 6↔Task 6). Item 2's schema-change exclusion is respected — Task 5 only touches the two schema-independent lifetime queries.
- **Type consistency:** `fetchFirsts`, `fetchLocationObservations`, `fetchBirdingOpportunitiesTags`, `fetchSpeciesObservations`, `fetchGlobalFilterCounts` all keep their existing exported signatures — no caller in any controller needs a change.
- **Dependency ordering:** Task 1 is first because Tasks 3, 5, and 6's live-query fallback paths (and every untouched caller of `observation_wide`) benefit from it being merged first, and because it's the lowest-risk, most mechanical change (proven safe by the earlier-merged plan's identical technique on the query side). Tasks 2-6 are independent of each other and could theoretically run in parallel, but this plan sequences them for a clean linear commit history — a subagent-driven execution may still dispatch them as ordered single-implementer tasks per the skill's "never dispatch multiple implementation subagents in parallel" rule.
- **Test count tracking:** starting from 40 (post-merge baseline: `git log` HEAD at plan-writing time). Running total: 40 → Task 1 adds 2 → 42 → Task 2 adds 0 → 42 → Task 3 adds 1 → 43 → Task 4 adds 1 → 44 → Task 5 adds 0 → 44 → Task 6 adds 3 → 47. Every in-task "Expected" line above was corrected to match this running total during self-review (the first draft had arithmetic errors — each task's full-suite step must count every test added by every task merged so far, not just its own). If a task is executed out of order from this plan's sequence, recompute the expected count from the actual suite run rather than trusting the literal number here — the authoritative signal is always "zero failures," the count is a sanity check on top of that.
