# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal bird sighting gallery built with Cloudflare Workers, D1 (SQLite), and R2 object storage. The application displays bird observations from eBird exports along with photos hosted on Cloudflare R2. Deployed to https://birds.xaviershay.com

## Common Commands

### Development
- `bin/dev` - Start local development server using Wrangler
- `bin/test` - Run Vitest test suite

### Data Management
- `bin/generate-load-sql` - Generate SQL statements from CSV exports and photo metadata
- `bin/load-data-local` - Load data into local development database
- `bin/load-data-remote` - Load data into production D1 database
- `bin/extract-photo-metadata` - Extract EXIF data from photos in data/photos
- `bin/generate-thumbnails` - Generate thumbnail versions of photos
- `bin/sync-photos` - Sync photos to R2 bucket

### Deployment
- `bin/deploy` - Deploy code to Cloudflare Workers
- `npx wrangler d1 execute birds --remote --file=src/sql/schema.sql` - Initialize remote database schema

## Architecture

### Request Flow
Entry point is `src/ts/routes.ts`, which exports the default Cloudflare Worker handler. The main `fetch()` function:
1. Fetches the current version from metadata table (for cache busting)
2. Checks Cloudflare Cache API for cached response (keyed by URL + version)
3. Routes requests to appropriate controllers based on URL path
4. Controllers query D1 database and return JSX-rendered HTML responses
5. Responses are cached with version key

### MVC Structure
- **Controllers** (`src/ts/controller/`): Handle routing logic, accept requests, call models, return HTML via JSX views
  - `base.ts` - Shared utilities (`respondWith()`, CORS headers)
  - `home.ts`, `species.ts`, `location.ts`, `firsts.ts`, `photo.ts`, `report.ts` - Route handlers
- **Models** (`src/ts/model/`): Database query logic
  - `observation.ts` - Bird sighting queries
  - `photo.ts` - Photo queries (by observation, distinct per species, recent good photos)
  - `filter.ts` - Filter state management (type, region, county, period, view)
  - `header_stats.ts` - Statistics for page headers
  - `report.ts` - Report generation
- **Views** (`src/ts/view/`): JSX components using React DOM Server for HTML generation
  - `layout.tsx` - Base HTML layout with header/footer
  - Individual page components render to static HTML strings

### Database Schema
SQLite database with the following core tables (see `src/sql/schema.sql`):
- `observation` - Bird sightings (links to species, location, checklist)
- `species` - Species metadata (common name, scientific name, taxonomic order)
- `location` - Location details (lat/lng, state, county)
- `photo` - Photo metadata (EXIF data, rating, dimensions)
- `observation_wide` - View joining observations with species, location, and photo availability

### Data Pipeline
The application operates on exported data that is committed to the repository:
1. Export eBird data manually to `data/MyEBirdData.csv`
2. Store taxonomy data in `data/ebird-taxonomy.csv`
3. Copy photos to `data/photos/`
4. Run `bin/extract-photo-metadata` to extract EXIF data to `data/metadata/`
5. Run `bin/generate-load-sql` which uses `src/scripts/load.ts` to parse CSVs and photo metadata, generating SQL INSERT statements
6. Load data to database with `bin/load-data-local` or `bin/load-data-remote`
7. Sync photos to R2 with `bin/sync-photos`

### Types
Core TypeScript interfaces are in `src/ts/types.ts`:
- `Observation` - Bird sighting with location and date
- `Photo` - Photo metadata including EXIF data
- `Species` - Species information
- `Location` - Geographic location
- `ObsType` - Enum for Sighting vs Photo observations
- D1 database type definitions

### Filtering
The `Filter` class (`src/ts/model/filter.ts`) manages query parameters:
- Type (sighting vs photo)
- Region (state/province)
- County
- Period (year)
- View (display mode)

Filters are created from URL query strings and converted back to query strings for links.

### Caching Strategy
Responses are cached in Cloudflare's Cache API with a version-based cache key. The version is stored in the `metadata` table and bumped on each deployment/data change. This allows instant cache invalidation across all pages by updating a single database value.

## Testing

Uses Vitest with `@cloudflare/vitest-pool-workers` to test in a Cloudflare Workers environment. Configuration in `vitest.config.mts` references `wrangler.toml` for environment setup.

Test files are in `test/ts/helpers/` for helper functions.
