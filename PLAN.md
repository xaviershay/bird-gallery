# Trip Report Feature - Implementation Plan

## Overview
Implement a trip report feature similar to eBird's trip reports (e.g., https://ebird.org/tripreport/407549) that groups observations from a specific date range into a cohesive report with statistics, photos, and maps.

## Data Model

### 1. Database Schema Changes (`src/sql/schema.sql`)

#### New Table: `trip_report`
```sql
DROP TABLE IF EXISTS trip_report;
CREATE TABLE trip_report (
  id TEXT PRIMARY KEY,  -- slug for URL (e.g., 'tasmania-2025')
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  start_date TEXT NOT NULL,  -- ISO date format (YYYY-MM-DD)
  end_date TEXT NOT NULL,    -- ISO date format (YYYY-MM-DD)
  created_at TEXT NOT NULL
) STRICT;
```

#### New Junction Table: `trip_report_checklist`
```sql
DROP TABLE IF EXISTS trip_report_checklist;
CREATE TABLE trip_report_checklist (
  trip_report_id TEXT NOT NULL,
  checklist_id INTEGER NOT NULL,
  PRIMARY KEY (trip_report_id, checklist_id),
  FOREIGN KEY (trip_report_id) REFERENCES trip_report(id),
  FOREIGN KEY (checklist_id) REFERENCES observation(checklist_id)
) STRICT;
```

#### New View: `trip_report_observation`
```sql
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

### 2. Data Source Files

Create individual YAML files in `data/trip-reports/` directory. Each trip report is a separate file named `{id}.yaml`.

**Example: `data/trip-reports/tasmania-2025.yaml`**
```yaml
id: tasmania-2025
title: Tasmania November 2025
start_date: 2025-11-15
end_date: 2025-11-22
description: |
  A week-long birding trip to Tasmania, exploring the diverse habitats of
  Australia's island state. Highlights included endemic species like the
  Tasmanian Native-hen and Black Currawong, as well as coastal seabirds
  and woodland species.

  The trip covered multiple regions including Hobart, Bruny Island, and
  the central highlands, with a focus on photography and documenting
  first sightings.
```

**Example: `data/trip-reports/example-trip.yaml`**
```yaml
id: example-trip
title: Example Trip
start_date: 2025-01-01
end_date: 2025-01-07
description: |
  Another example trip report with multiple paragraphs.

  This demonstrates how YAML handles multi-line descriptions elegantly.
```

**YAML Benefits:**
- Multi-line descriptions with `|` block scalar
- No escaping quotes or commas
- More readable and maintainable
- Easy to hand-edit
- Supports comments with `#`
- One file per trip makes organization simple
- Easy to add/remove trips without touching other data

### 3. Data Loading (`src/scripts/load.ts`)

**Add dependency:**
```bash
npm install js-yaml
npm install --save-dev @types/js-yaml
```

Add logic to:
1. Read all `.yaml` files from `data/trip-reports/` directory
2. Parse each YAML file
3. Generate SQL INSERT statements for `trip_report` table
4. For each trip report:
   - Query observations between start_date and end_date
   - Extract unique checklist_ids from those observations
   - Generate SQL INSERT statements for `trip_report_checklist` junction table

**Implementation approach:**
```typescript
import * as yaml from 'js-yaml';

// After loading observations
const tripReportsDir = 'data/trip-reports';
const tripReportFiles = readdirSync(tripReportsDir).filter(f => f.endsWith('.yaml'));
const tripReports = [];

for (const file of tripReportFiles) {
  const filePath = path.join(tripReportsDir, file);
  const tripReportYaml = readFileSync(filePath, 'utf-8');
  const report = yaml.load(tripReportYaml) as any;
  tripReports.push(report);
}

for (const report of tripReports) {
  // Insert trip report
  console.log(generateSQL(
    `INSERT INTO trip_report (id, title, description, start_date, end_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [report.id, report.title, report.description, report.start_date, report.end_date, new Date().toISOString()]
  ));

  // Find all unique checklist IDs within date range
  const checklistIds = new Set<number>();
  for (const [obsId, checklistId, , , , seenAt] of observationSQLStatements) {
    const obsDate = new Date(seenAt).toISOString().split('T')[0];
    if (obsDate >= report.start_date && obsDate <= report.end_date) {
      checklistIds.add(checklistId);
    }
  }

  // Insert checklist associations
  for (const checklistId of checklistIds) {
    console.log(generateSQL(
      `INSERT INTO trip_report_checklist (trip_report_id, checklist_id)
       VALUES (?, ?)`,
      [report.id, checklistId]
    ));
  }
}
```

## Backend Implementation

### 4. TypeScript Types (`src/ts/types.ts`)

```typescript
export interface TripReport {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface TripReportStats {
  totalSpecies: number;
  totalObservations: number;
  totalChecklists: number;
  totalLocations: number;
  firstsSeen: number;      // Species seen for first time (life birds)
  firstsPhotographed: number;  // Species photographed for first time
  speciesWithPhotos: number;
  totalPhotos: number;
}

export interface TripReportObservation extends Observation {
  photos: Photo[];  // Photos for this observation
}
```

### 5. Model Layer (`src/ts/model/trip_report.ts`)

Create new model file with functions:

```typescript
/**
 * Fetch a single trip report by ID
 */
export async function fetchTripReport(
  env: Env,
  tripReportId: string
): Promise<TripReport | null>;

/**
 * Fetch all trip reports, ordered by start_date DESC
 */
export async function fetchAllTripReports(
  env: Env
): Promise<TripReport[]>;

/**
 * Fetch all observations for a trip report, grouped by species
 * Returns observations with their associated photos
 */
export async function fetchTripReportObservations(
  env: Env,
  tripReportId: string
): Promise<TripReportObservation[]>;

/**
 * Calculate statistics for a trip report
 */
export async function fetchTripReportStats(
  env: Env,
  tripReportId: string
): Promise<TripReportStats>;
```

**Key queries:**

**Observations query (grouped by species, showing all locations and photos):**
```sql
SELECT
  o.species_id as speciesId,
  o.common_name as name,
  GROUP_CONCAT(DISTINCT o.location_id) as locationIds,
  GROUP_CONCAT(DISTINCT o.location_name) as locationNames,
  MIN(o.seen_at) as firstSeenAt,
  MAX(o.seen_at) as lastSeenAt,
  COUNT(DISTINCT o.checklist_id) as checklistCount,
  SUM(o.count) as totalCount,
  MAX(o.has_photo) as hasPhoto,
  GROUP_CONCAT(DISTINCT photo.file_name) as photoFileNames
FROM trip_report_observation o
LEFT JOIN photo ON o.id = photo.observation_id
WHERE o.trip_report_id = ?
GROUP BY o.species_id
ORDER BY o.taxonomic_order;
```

**Stats query - total species:**
```sql
SELECT COUNT(DISTINCT species_id) as totalSpecies
FROM trip_report_observation
WHERE trip_report_id = ?;
```

**Stats query - firsts seen:**
```sql
-- For each species in the trip, check if this was their first observation ever
SELECT COUNT(*) as firstsSeen
FROM (
  SELECT DISTINCT tro.species_id,
    (SELECT MIN(seen_at) FROM observation WHERE species_id = tro.species_id) as global_first_seen,
    MIN(tro.seen_at) as trip_first_seen
  FROM trip_report_observation tro
  WHERE tro.trip_report_id = ?
  GROUP BY tro.species_id
) firsts
WHERE trip_first_seen = global_first_seen;
```

**Stats query - firsts photographed:**
```sql
-- For each species in the trip with photos, check if this was their first photo
SELECT COUNT(*) as firstsPhotographed
FROM (
  SELECT DISTINCT tro.species_id,
    (SELECT MIN(taken_at) FROM photo
     INNER JOIN observation ON photo.observation_id = observation.id
     WHERE observation.species_id = tro.species_id) as global_first_photo,
    MIN(photo.taken_at) as trip_first_photo
  FROM trip_report_observation tro
  INNER JOIN photo ON tro.id = photo.observation_id
  WHERE tro.trip_report_id = ?
  GROUP BY tro.species_id
) firsts
WHERE trip_first_photo = global_first_photo;
```

### 6. Controller Layer (`src/ts/controller/trip_report.ts`)

Create new controller with two actions:

```typescript
/**
 * GET /trip-report - List all trip reports
 */
export async function handleTripReportIndex(
  request: Request,
  env: Env
): Promise<Response>;

/**
 * GET /trip-report/:id - Show specific trip report
 * GET /trip-report/:id.geojson - GeoJSON for map
 */
export async function handleTripReportShow(
  request: Request,
  env: Env
): Promise<Response>;
```

**Index action:**
- Fetch all trip reports
- Render `TripReportIndexView` with list of reports

**Show action:**
- Parse trip report ID from URL
- Fetch trip report metadata
- Fetch trip report observations
- Fetch trip report stats
- If `.geojson` extension, return GeoJSON for map
- Otherwise render `TripReportShowView` with:
  - Trip report metadata (title, description, dates)
  - Statistics (total species, firsts, photos, etc.)
  - Combined observation list (grouped by species, showing all photos)
  - Map showing all locations

### 7. Routing (`src/ts/routes.ts`)

Add new route handler:

```typescript
import { handleTripReportIndex, handleTripReportShow } from "./controller/trip_report";

// In handleRequest function:
case "trip-report":
  if (!path[1]) {
    return handleTripReportIndex(request, env);
  } else {
    return handleTripReportShow(request, env);
  }
```

## Frontend Implementation

### 8. View Components

#### `src/ts/view/trip_report_index.tsx`
Display list of all trip reports:
- Title (linked to trip report)
- Date range
- Brief description (truncated)
- Key stats (species count, firsts, etc.)

#### `src/ts/view/trip_report_show.tsx`
Display detailed trip report:

**Header:**
- Title (h2)
- Date range
- Full description

**Statistics section:**
- Total species
- Total checklists
- Total locations
- Firsts seen (life birds during trip)
- Firsts photographed (first photos during trip)
- Species with photos
- Total photos

**Map:**
- Show all locations visited during trip
- Use `MapView` component
- Link to location pages

**Species List Table:**
Similar to firsts view but:
- Show ALL observations from the trip, not just firsts
- Group by species (one row per species)
- Columns:
  - # (species count)
  - Name (linked to species page)
  - Locations (comma-separated list, linked)
  - First Seen (date of first observation on trip, linked to checklist)
  - Photos (thumbnail strip if available, or count)
- Sort by taxonomic order
- Include location grouping like firsts view

**Table structure:**
```tsx
<table className="bird-list">
  <thead>
    <tr>
      <th>#</th>
      <th>Name</th>
      <th>Locations</th>
      <th>First Seen</th>
      <th>Photos</th>
    </tr>
  </thead>
  <tbody>
    {observations.map((obs, index) => (
      <tr key={obs.speciesId}>
        <td>{index + 1}</td>
        <td><a href={`/species/${obs.speciesId}`}>{obs.name}</a></td>
        <td>
          {obs.locations.map((loc, i) => (
            <>
              {i > 0 && ', '}
              <a href={`/location/${loc.id}`}>{formatLocationName(loc.name)}</a>
            </>
          ))}
        </td>
        <td>
          <a href={`https://ebird.org/checklist/S${obs.checklistId}`}>
            {formatDate(obs.firstSeenAt)}
          </a>
        </td>
        <td>
          {obs.photos.length > 0 ? (
            <div className="photo-thumbnails">
              {obs.photos.map(photo => (
                <a href={`/photo/${photo.fileName}`}>
                  <img src={thumbnailUrl(photo)} className="inline-thumbnail" />
                </a>
              ))}
            </div>
          ) : (
            <span>{obs.checklistCount} checklist{obs.checklistCount !== 1 ? 's' : ''}</span>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### 9. CSS Styling (`src/static/css/custom.css`)

Add styles for:
```css
/* Trip Report Styles */
.trip-report-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.trip-report-stat {
  text-align: center;
  padding: 1rem;
  background-color: var(--bg);
  border-radius: var(--standard-border-radius);
}

.trip-report-stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--accent);
}

.trip-report-stat-label {
  font-size: 0.9rem;
  color: var(--text-light);
}

.trip-report-description {
  margin: 1rem 0;
  line-height: 1.6;
}

.trip-report-date-range {
  color: var(--text-light);
  font-style: italic;
  margin-bottom: 1rem;
}

.inline-thumbnail {
  max-height: 60px;
  max-width: 80px;
  margin: 2px;
  border-radius: 4px;
}

.photo-thumbnails {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.trip-report-list {
  list-style: none;
  padding: 0;
}

.trip-report-item {
  margin-bottom: 2rem;
  padding: 1rem;
  background-color: var(--bg);
  border-radius: var(--standard-border-radius);
}

.trip-report-item h3 {
  margin-top: 0;
}
```

## Testing Considerations

### 10. Test Data
Create sample trip report in `data/trip-reports/test-trip-2025.yaml`:
```yaml
id: test-trip-2025
title: Test Trip Report
start_date: 2025-04-01
end_date: 2025-04-07
description: |
  A test trip to verify the trip report feature works correctly.
```

### 11. Unit Tests
Add tests to `test/index.spec.ts`:
- Test `/trip-report` index returns list
- Test `/trip-report/:id` show returns report details
- Test `/trip-report/:id.geojson` returns valid GeoJSON
- Test stats calculations are correct
- Test firsts calculations work correctly

## Migration & Deployment

### 12. Deployment Steps
1. Add trip report YAML files to repository
2. Update schema.sql with new tables
3. Run schema update on remote database:
   ```bash
   npx wrangler d1 execute birds --remote --file=src/sql/schema.sql
   ```
4. Generate and run data load SQL:
   ```bash
   bin/generate-load-sql > load.sql
   bin/load-data-remote
   ```
5. Deploy code:
   ```bash
   bin/deploy
   ```

## Navigation Integration

### 13. Add to Main Navigation
Update home page or add trip reports link to header:
- Add link to `/trip-report` in navigation
- Consider adding recent trip reports to home page

## Future Enhancements (Not in Initial Scope)

1. **Manual checklist exclusion**: UI to exclude specific checklists from a trip report
2. **Daily summaries**: Break down observations by day within the trip
3. **Species notes**: Add trip-specific notes/highlights for species
4. **Export**: Generate PDF or shareable HTML version
5. **eBird import**: Automatically sync trip reports from eBird
6. **Weather/conditions**: Track weather and birding conditions by day
7. **Location details**: Show detailed stats per location visited

## File Checklist

### New Files to Create:
- [ ] `data/trip-reports/*.yaml` - Individual trip report files
- [ ] `src/ts/model/trip_report.ts` - Model functions
- [ ] `src/ts/controller/trip_report.ts` - Controller actions
- [ ] `src/ts/view/trip_report_index.tsx` - Index view
- [ ] `src/ts/view/trip_report_show.tsx` - Show view

### Files to Modify:
- [ ] `src/sql/schema.sql` - Add tables and views
- [ ] `src/scripts/load.ts` - Add trip report loading
- [ ] `src/ts/types.ts` - Add TypeScript interfaces
- [ ] `src/ts/routes.ts` - Add routing
- [ ] `src/static/css/custom.css` - Add styles
- [ ] `test/index.spec.ts` - Add tests

## Implementation Order

1. **Phase 1 - Data Layer**
   - Update schema.sql
   - Create individual trip report YAML files with test data
   - Update load.ts script
   - Test data loading locally

2. **Phase 2 - Backend**
   - Add TypeScript types
   - Implement model functions
   - Implement controller
   - Add routing
   - Test with curl/browser

3. **Phase 3 - Frontend**
   - Create index view
   - Create show view
   - Add CSS styling
   - Add navigation links

4. **Phase 4 - Polish**
   - Add unit tests
   - Optimize queries
   - Deploy to production
   - Document in CLAUDE.md
