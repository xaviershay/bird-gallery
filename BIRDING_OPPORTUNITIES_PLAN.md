# Birding Opportunities Page - Implementation Plan

## Overview
Enhance the Birding Opportunities page with two major changes:
1. Support URL parameters for region/location selection instead of hardcoded Melbourne
2. Replace exclude list UI with lifer status tagging system

## Current State
- **Hardcoded region**: Always uses `AU-VIC-MEL` (Melbourne)
- **Current approach**: Shows birds recently seen in Melbourne that aren't in an "exclude list"
  - Exclude list is based on either: "birds photographed anywhere" or "birds seen in Melbourne"
  - Controlled by dropdown on the page that changes `?exclude=photos|all` param
- **Files involved**:
  - [src/ts/view/birding_opportunities.tsx](src/ts/view/birding_opportunities.tsx) - React component
  - [src/static/js/birding-opportunities.js](src/static/js/birding-opportunities.js) - Client-side logic
  - [src/static/js/ebird-service.js](src/static/js/ebird-service.js) - eBird API wrapper
  - [src/ts/controller/report.ts](src/ts/controller/report.ts) - Server route handler
  - [src/ts/model/report.ts](src/ts/model/report.ts) - Database queries

## Change 1: URL Parameter Support for Region/Location

### Requirements
- Accept either a **region** OR a **location** parameter
- Region: eBird region code (e.g., `AU-VIC`, `AU-VIC-MEL`, `US-CA`)
- Location: eBird hotspot code (e.g., `L123456`)
- Default: Fall back to Melbourne (`AU-VIC-MEL`) if neither provided
- Only one can be active at a time (location takes precedence if both provided)

### Implementation Steps

#### A. Update TSX Component
**File**: [src/ts/view/birding_opportunities.tsx](src/ts/view/birding_opportunities.tsx)

Changes:
- Update component props to accept `region` and `location` instead of just `excludeMode`
- Update description text to reflect dynamic location
- Remove hardcoded "Melbourne" references
- Pass region/location to JavaScript via HTML data attributes or inline script variables

#### B. Update Server Controller
**File**: [src/ts/controller/report.ts](src/ts/controller/report.ts)

Changes:
- Extract `region` and `location` from URL parameters
- Validate region/location format (basic validation - eBird will validate)
- Pass to view component

#### C. Update Client-Side JavaScript
**File**: [src/static/js/birding-opportunities.js](src/static/js/birding-opportunities.js)

Changes:
- Replace hardcoded `REGION_CODE = "AU-VIC-MEL"` with dynamic value from URL/component
- Extract region/location from URL parameters or window variables
- Use selected region/location for all eBird API calls
- Update map center coordinates based on region (use approximate center for region, or use hotspot coords for location)
- Update description/status messages to mention the selected region/location

#### D. Update ebird-service.js
**File**: [src/static/js/ebird-service.js](src/static/js/ebird-service.js)

No changes needed - it's generic enough to work with any region code

### Data Flow
```
URL: /report/opportunities?region=AU-VIC&exclude=photos
     or /report/opportunities?location=L919153&exclude=photos
          ↓
Controller extracts params
          ↓
View component renders with region/location props
          ↓
JavaScript reads region/location from URL params
          ↓
Fetches observations from eBird API using dynamic region/location
          ↓
Renders map centered on region/location
```

---

## Change 2: Lifer Status Tagging System

### Requirements
Replace the exclude-list approach with a tagging system that shows:
- **Lifer**: Bird not seen anywhere (in the database)
- **Photo Lifer**: Bird seen but not photographed anywhere
- **Lifer This Year**: Bird not seen in current calendar year
- **Lifer At Location**: Bird seen but not at this specific location

**Visibility Rule**: Only show birds matching at least ONE of these tags

### Data Needed
To determine these statuses, we need:
1. **Lifer check**: Is species in `species` table linked to any observation?
2. **Photo lifer check**: Does this species have any photo anywhere?
3. **Lifer this year check**: Has this species been seen in the current year?
4. **Lifer at location check**: Has this species been seen at this specific location/region?

### Implementation Steps

#### A. Create New Server Endpoint
**File**: [src/ts/model/report.ts](src/ts/model/report.ts) and [src/ts/controller/report.ts](src/ts/controller/report.ts)

New function: `fetchBirdingOpportunitiesWithTags()`
- Query: Get recent observations for region/location
- For each species, determine:
  - Has any observation in DB? (determines "Lifer")
  - Has any photo in DB? (determines "Photo Lifer")
  - Has observation in current year? (determines "Lifer This Year")
  - Has observation at this region/location? (determines "Lifer At Location")
- Return data with tags for each species

**SQL Strategy**:
```sql
SELECT 
  DISTINCT s.id,
  s.common_name,
  -- Tags
  (SELECT COUNT(*) FROM observation WHERE species_id = s.id) > 0 as hasAnyObservation,
  (SELECT COUNT(*) FROM observation o 
   INNER JOIN photo ON o.id = photo.observation_id 
   WHERE o.species_id = s.id) > 0 as hasAnyPhoto,
  (SELECT COUNT(*) FROM observation 
   WHERE species_id = s.id 
   AND strftime("%Y", seen_at) = strftime("%Y", "now")) > 0 as hasObservationThisYear,
  (SELECT COUNT(*) FROM observation o
   INNER JOIN location l ON o.location_id = l.id
   WHERE o.species_id = s.id 
   AND ... match on location/region ...) > 0 as hasObservationAtLocation
FROM species
WHERE ... recent observations in region/location ...
ORDER BY name
```

#### B. Update TSX Component
**File**: [src/ts/view/birding_opportunities.tsx](src/ts/view/birding_opportunities.tsx)

Changes:
- Remove the exclude-mode dropdown (no longer needed)
- Update description to explain the tag system
- Update table to show tag badges/indicators
- Show descriptions of what each tag means

#### C. Update Client-Side JavaScript
**File**: [src/static/js/birding-opportunities.js](src/static/js/birding-opportunities.js)

Changes:
- Change endpoint from `/report/opportunities.json?exclude=X` to `/report/opportunities.json?region=X` (or location=X)
- Update `fetchExcludeList()` to `fetchBirdTags()` or similar
- Filter observations to only include birds with at least one tag
- Update `renderResults()` to display tags instead of being part of an exclude list
- Render tag badges with appropriate styling (lifer, photo-lifer, this-year, at-location)

#### D. UI Updates
**Tags/Badges Display**:
- Show inline with species name or in separate columns
- Use distinct colors/icons:
  - 🏆 Lifer (new species)
  - 📸 Photo Lifer (seen but not photographed)
  - 🎉 This Year (year lifer)
  - 📍 Location (location lifer)
- Multiple tags possible on one bird, however when a tag implies other, don't include the implied ones:
  - "Lifer" implies all others
  - "This Year" implies location lifer

Example table row:
```
Species Name                      Seen At
Rainbow Lorikeet                  10th Jan 2025, 2:30 PM
  🏆 Lifer
  
Laughing Kookaburra               10th Jan 2025, 3:45 PM
  📸 Photo Lifer  🎉 This Year
```

### Database Considerations

**No schema changes needed!** All information is derivable from existing tables:
- `species` - list of species
- `observation` - sightings
- `photo` - photos attached to observations
- `location` - location information

The logic is purely in SQL queries and application code.

### Backwards Compatibility
- Old URLs with `?exclude=photos` or `?exclude=all` should still work (could redirect or ignore params)
- The exclude-mode dropdown is completely removed

---

## Implementation Order

1. **Phase 1**: Implement URL parameter support (Change 1)
   - Update controller to parse region/location
   - Update component to accept and display region/location
   - Update JavaScript to use dynamic region/location
   - Update map centering logic
   - Test with different regions/locations

2. **Phase 2**: Implement tag system (Change 2)
   - Create new database query function with tag logic
   - Create new server endpoint that returns bird data with tags
   - Update view component to remove exclude dropdown
   - Update JavaScript to fetch and display tags
   - Update CSS for tag styling
   - Test filtering (show only birds with at least one tag)

3. **Phase 3**: Polish
   - Add help text explaining the tag system
   - Responsive design for tags
   - Performance optimization if needed
   - Update tests

---

## Testing Strategy

### Unit Tests
- [test/index.spec.ts](test/index.spec.ts)
- Test with different region codes
- Test with location hotspots
- Test tag calculation logic
- Test filtering (ensure birds with no tags are hidden)

### Manual Testing
- `/report/opportunities` (default to Melbourne)
- `/report/opportunities?region=AU-VIC`
- `/report/opportunities?region=US-CA` (different country)
- `/report/opportunities?location=L919153` (specific hotspot)
- Verify tags display correctly
- Verify map centers on correct location
- Verify birds with no tags are hidden

---

## Files to Modify

1. [src/ts/view/birding_opportunities.tsx](src/ts/view/birding_opportunities.tsx)
2. [src/ts/controller/report.ts](src/ts/controller/report.ts)
3. [src/ts/model/report.ts](src/ts/model/report.ts)
4. [src/static/js/birding-opportunities.js](src/static/js/birding-opportunities.js)
5. [test/index.spec.ts](test/index.spec.ts) - Update tests for new behavior

Files that may not need changes:
- [src/static/js/ebird-service.js](src/static/js/ebird-service.js) - generic enough already
- Database schema - no changes needed

---

## Notes

- The tag system is **inclusive** (show birds matching ANY tag) not exclusive (exclude birds with certain tags)
- This is a more sophisticated approach than the current simple exclude list
- Gives users more context about why a bird is interesting (e.g., "new to photography" vs "new to location")
- Could be extended in future with more tags or filtering options
