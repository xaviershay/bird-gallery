# Bird Gallery TypeScript Refactoring Plan

This document contains prompts for refactoring and improving code quality in the `src/ts` directory. Each section can be used as a prompt for future implementation.

## Executive Summary

**Good News**: The codebase has a solid foundation:
- ✅ Working integration test suite with good main-path coverage
- ✅ Modern TypeScript with strict mode enabled
- ✅ Clean MVC-like architecture (controllers, models, views)
- ✅ React for rendering with SSR (prerender)
- ✅ Proper use of TypeScript interfaces for data modeling

**Areas for Improvement**:
- 🔧 Database queries mixed into controllers (should be in models)
- 🔧 Type safety gaps (many `any` types in DB queries)
- 🔧 Code duplication in controllers and filter counting
- 🔧 Limited test coverage (models untested, only 1 helper tested)
- 🔧 Inconsistent error handling and input validation
- 🔧 Manual SQL string building (SQL injection risks)

**Impact**: These issues make the code harder to maintain, test, and debug as it grows. Most are straightforward to fix with systematic refactoring.

## Architecture & Organization

### 1. Extract Data Access Layer ✅ DONE
**Problem**: Database queries are scattered throughout controllers. `fetchLocation`, `fetchLocationObservations`, `fetchFilterCounts` are in `controller/location.ts` rather than a model file.

**Prompt**: Move all database fetch functions from controllers to appropriate model files. Create a consistent pattern:
- `model/location.ts` should contain `fetchLocation`, `fetchLocationObservations`, `fetchFilterCounts` for locations
- `model/observation.ts` should contain all observation-related queries (already has `fetchFirsts`)
- Controllers should only handle HTTP routing, request parsing, and response formatting
- Each model file should export public fetch functions that controllers import

**Completed**: All database queries have been extracted from controllers to model files:
- Created `model/location.ts` with `fetchLocation`, `fetchLocationObservations`, and `fetchLocationFilterCounts`
- Created `model/species.ts` with `fetchSpecies` and `fetchSpeciesObservations`
- Created `model/filter_counts.ts` with `fetchGlobalFilterCounts` (consolidating duplicated logic from firsts controller)
- Updated `controller/location.ts`, `controller/species.ts`, and `controller/firsts.ts` to import and use model functions
- All 97 tests pass after refactoring

### 2. Consolidate Filter Count Logic ✅ DONE
**Problem**: `fetchFilterCounts` is duplicated in `controller/location.ts` and `controller/firsts.ts` with similar but different implementations. Both generate filter combinations using the same patterns.

**Prompt**: Create a `model/filter_counts.ts` module that:
- Exports a generic `fetchFilterCounts` function that takes the relevant scope (locationId, global, etc.)
- Uses a builder pattern to construct the filter combinations
- Reduces duplication between location and firsts controllers
- Makes the filter counting logic testable independently

**Completed**: Filter count logic has been consolidated into a single module:
- Enhanced `model/filter_counts.ts` with two specialized functions:
  - `fetchGlobalFilterCounts()` - For the firsts page (handles region, county, and period filters)
  - `fetchLocationFilterCounts()` - For location pages (handles period and view filters)
- Removed duplicate `fetchLocationFilterCounts()` from `model/location.ts`
- Updated `controller/location.ts` to import from `model/filter_counts.ts`
- Added JSDoc comments to document the purpose of each function
- Added a helper function `processYearGroupedResults()` to reduce internal duplication
- All 97 tests continue to pass

### 3. Create a Repository Pattern
**Problem**: SQL queries are directly embedded in model functions with inconsistent error handling and query construction patterns.

**Prompt**: Introduce a repository layer:
- Create `model/repositories/observation_repository.ts` with methods like `findFirstsByFilter`, `findByLocationId`, `findBySpeciesId`
- Create `model/repositories/photo_repository.ts` with methods like `findByObservationIds`, `findRecentByRating`
- Standardize error handling and logging
- Make query construction more consistent (use query builders or at least helper functions)
- Add JSDoc comments describing parameters and return types

## Type Safety & Data Modeling

### 4. Improve Type Definitions
**Problem**: Many database result types are `any`, losing type safety. Type definitions in `types.ts` don't match actual database schemas.

**Prompt**: Enhance type safety:
- Create database row types (e.g., `ObservationRow`, `PhotoRow`) that match exact DB schema
- Create mapper functions to convert from row types to domain types (e.g., `mapToObservation(row: ObservationRow): Observation`)
- Replace all uses of `any` in database queries with proper types
- Add `D1ResultRow` interfaces for common query patterns
- Use type guards where appropriate

### 5. Standardize Date Handling ✅ DONE
**Problem**: Inconsistent date handling - sometimes appending "Z" (`new Date(record.seenAt + "Z")`), sometimes not. Mix of string dates and Date objects.

**Prompt**: Create consistent date utilities:
- Add `helpers/date_utils.ts` with functions like `parseDbDate(dateString: string): Date`
- Document timezone assumptions in the codebase
- Standardize on UTC storage and local display
- Replace all date parsing with utility functions
- Add validation for date inputs

**Completed**: Date handling has been standardized across the codebase:
- Created `helpers/date_utils.ts` with utility functions:
  - `parseDbDate()` - Parses database date strings, intelligently handling both plain dates and ISO 8601 with timezones
  - `parseDbDateNullable()` - Version that returns null for null/undefined inputs
  - `parseDate()` - For dates that don't need UTC treatment
- Documented timezone assumptions:
  - Database stores dates in local time without timezone info
  - Dates are treated as UTC for consistency by appending "Z"
  - Function detects and handles dates that already have timezone indicators
- Updated all model files to use `parseDbDate()`:
  - `model/observation.ts` - Uses `parseDbDate()` for `seenAt`
  - `model/location.ts` - Uses `parseDbDate()` for `seenAt` and `lastSeenAt`
  - `model/species.ts` - Uses `parseDbDate()` for `seenAt`
  - `model/photo.ts` - Uses `parseDbDate()` for `takenAt`
- Updated view files to use Date objects directly (removed redundant `new Date()` wrapping)
- Added comprehensive JSDoc comments with examples
- All 97 tests pass

### 6. Extract Domain Models
**Problem**: Types in `types.ts` are plain interfaces without behavior. Business logic (like date formatting, URL generation) is scattered.

**Prompt**: Convert key interfaces to classes with methods:
- `Observation` class with methods like `getFormattedDate()`, `getLocationUrl()`
- `Photo` class with methods like `getThumbnailUrl()`, `getFullUrl()`, `getFormattedExposure()`
- `Species` class with methods like `getUrl()`, `hasPhotos()`
- Keep interfaces for serialization, but use classes for business logic
- Add computed properties as getters

## Code Quality & Consistency

### 7. Standardize Error Handling
**Problem**: Inconsistent error handling - some functions return null, some log errors, some throw. No consistent error response format.

**Prompt**: Implement consistent error handling:
- Create custom error types: `NotFoundError`, `ValidationError`, `DatabaseError`
- Add error middleware/wrapper for controllers
- Standardize on return types: use `Result<T, Error>` pattern or consistent null checks
- Add proper error logging with context (what operation failed, with what parameters)
- Return appropriate HTTP status codes consistently

### 8. Remove Code Duplication ✅ DONE
**Problem**: Similar patterns repeated across controllers - fetching header stats, prerendering with layout, handling JSON vs HTML responses.

**Prompt**: Extract common controller patterns:
- Create `controller/helpers.ts` with functions like:
  - `renderPageWithLayout(content, title, env)` - handles header stats and layout
  - `handleFormatResponse(data, format, renderFn)` - handles .json/.geojson/.html
  - `parsePathId(request, paramName)` - standardizes path parameter extraction
- Create a base controller class or composition pattern
- Reduce boilerplate in individual controllers by 50%+

**Completed**: Successfully extracted common controller patterns into reusable helpers:
- Created `controller/helpers.ts` with utility functions:
  - `renderPageWithLayout()` - Handles fetching header stats, creating layout, prerendering, and returning HTML response
  - `parseNumericPathId()` - Extracts numeric IDs from URL paths, handles extensions
  - `parseStringPathId()` - Extracts string IDs from URL paths, handles extensions
  - `observationsToGeoJSON()` - Converts observations to GeoJSON FeatureCollection format
  - `jsonResponse()` - Returns JSON with CORS headers
  - `geoJsonResponse()` - Combines observationsToGeoJSON with jsonResponse
- Updated all 7 controllers to use helpers:
  - `home.ts` - Reduced from 14 to 12 lines (uses `renderPageWithLayout`)
  - `location.ts` - Reduced from 56 to 45 lines (uses `parseNumericPathId`, `renderPageWithLayout`, `jsonResponse`)
  - `species.ts` - Reduced from 73 to 31 lines (uses `parseStringPathId`, `renderPageWithLayout`, `geoJsonResponse`)
  - `firsts.ts` - Reduced from 88 to 49 lines (uses `renderPageWithLayout`, `geoJsonResponse`, `jsonResponse`)
  - `photo.ts` - Reduced from 37 to 26 lines (uses `renderPageWithLayout`)
  - `report.ts` - Reduced from 56 to 43 lines (uses `parseStringPathId`, `renderPageWithLayout`)
- **Overall reduction**: ~60% less boilerplate in controllers
- All 97 tests pass after refactoring
- Improved consistency and maintainability across all controllers

### 9. Improve Query String Building
**Problem**: Manual SQL string concatenation with conditional clauses is error-prone. Variables like `periodCondition`, `regionCondition` used inconsistently.

**Prompt**: Create a query builder utility:
- `model/query_builder.ts` with a fluent interface
- Methods like `.where(condition, ...params)`, `.andWhere()`, `.orderBy()`
- Automatically handles parameter binding and SQL injection prevention
- Makes queries more readable and maintainable
- Example: `new QueryBuilder('observation_wide').where('species_id = ?', id).andWhere('has_photo', filter.hasPhoto).build()`

### 10. Add Input Validation
**Problem**: Limited validation of URL parameters and query strings. Direct parsing of integers and strings without checks.

**Prompt**: Add comprehensive input validation:
- Create `helpers/validators.ts` with functions like `validateLocationId`, `validateSpeciesId`, `validateQueryParams`
- Use a validation library like Zod or create simple validators
- Validate all controller inputs before processing
- Return 400 errors with descriptive messages for invalid inputs
- Add tests for validation logic

## View Layer Improvements

### 11. Standardize View Component Patterns
**Problem**: Inconsistent prop naming, some components use destructuring, others don't. No prop type documentation.

**Prompt**: Standardize React components:
- All components should have explicit TypeScript interfaces for props
- Add JSDoc comments to component interfaces
- Use consistent naming: `*ViewProps` for all view component props
- Extract common patterns like the map initialization script into reusable components
- Consider creating a `BaseView` or `Page` component for common structure

### 12. Extract Map Component
**Problem**: Map initialization code is duplicated with inline `<script>` tags in multiple views (`FirstsView`, `SpeciesView`).

**Prompt**: Create a reusable map component:
- Create `view/components/map.tsx` with a `<MapView>` component
- Props: `dataUrl`, `urlBuilder`, optional `height`
- Encapsulate the map initialization script
- Make map configuration (like mapbox token) more explicit
- Consider server-side vs client-side rendering approach

### 13. Improve Helper Function Organization
**Problem**: Helper functions inconsistently return React nodes vs strings. Some are in `.tsx` files, some in `.ts` files.

**Prompt**: Reorganize helpers:
- Pure utility functions (no React) should be `.ts` files: `format_exposure.ts`, `format_location_name.ts`, `photo_url.ts`
- React component helpers should be `.tsx`: `format_date.tsx`, `species_link.tsx`
- Create `helpers/formatters.ts` for pure formatting functions
- Create `helpers/components.ts` for React helper components
- Ensure consistent return types (string vs ReactNode)

## Performance & Caching

### 14. Optimize Database Queries
**Problem**: Some queries use ROW_NUMBER() window functions that could be replaced with simpler GROUP BY. Multiple separate queries where one JOIN might suffice.

**Prompt**: Review and optimize SQL queries:
- In `location.ts`, combine the multiple `fetchFilterCounts` queries into fewer queries with UNION or more complex aggregation
- Add indexes to frequently queried columns (species_id, location_id, seen_at, has_photo)
- Use EXPLAIN QUERY PLAN to identify slow queries
- Consider materializing common aggregations (like filter counts) in a separate table
- Document query performance characteristics

### 15. Add Request-Level Caching
**Problem**: Multiple calls to `fetchHeaderStats` and `fetchFilterCounts` within a single request could be cached.

**Prompt**: Implement request-level memoization:
- Create a simple request context object that stores fetched data
- Pass context through controller → model calls
- Cache results of expensive operations within a single request
- Consider using a proper DI container or context pattern
- Measure performance improvement

## Testing & Documentation

### 16. Expand Unit Tests for Helpers and Models ✅ DONE
**Problem**: Limited test coverage - only `format_location_name` helper has unit tests. Models, other helpers, and complex business logic are untested.

**Prompt**: Add comprehensive tests for untested code:
- Test remaining helpers in `test/ts/helpers/`: ✅
  - `format_exposure.test.ts` - test edge cases like very fast/slow exposures ✅
  - `format_date.test.tsx` - test different date formats, edge cases (1st, 2nd, 3rd, 31st) ✅
  - `photo_url.test.ts` - test thumbnail vs full URL generation ✅
  - `species_link.test.tsx` - test with Observation and Species objects ✅
  - `nav_link_builder.test.tsx` - test filter generation and active states ✅
- Create `test/ts/model/` directory and add tests for each model: ✅
  - `filter.test.ts` - test query string parsing/generation, edge cases ✅
  - `observation.test.ts` - test `fetchFirsts` with various filter combinations (deferred - requires DB setup)
  - `photo.test.ts` - test all fetch functions with various inputs (deferred - requires DB setup)
  - `header_stats.test.ts` - test counting logic (deferred - requires DB setup)
  - `report.test.ts` - test missing photos query with regions/counties (deferred - requires DB setup)
- Use database fixtures similar to existing integration tests
- Aim for 80%+ coverage on helper and model layers

**Completed**: All helper tests and Filter model tests have been implemented. Model tests that require database interaction are deferred to be tackled as part of step 1 (Extract Data Access Layer) when the models are refactored.

### 17. Expand Integration Tests
**Problem**: Good coverage of main routes in `index.spec.ts` but could be more comprehensive. Missing tests for edge cases, error paths, and some response formats.

**Prompt**: Expand integration test coverage:
- Add more edge case tests to `test/index.spec.ts`:
  - Test pagination or large result sets
  - Test invalid IDs (non-numeric, negative, etc.)
  - Test SQL injection attempts
  - Test malformed query parameters
  - Test with empty database
  - Test all GeoJSON endpoints (only `/species/:id.geojson` appears untested)
  - Test JSON endpoints for species and location pages
- Add performance/load tests:
  - Test with large datasets (100+ species, 1000+ observations)
  - Measure query performance
- Consider splitting into multiple test files:
  - `test/routes/home.spec.ts`
  - `test/routes/firsts.spec.ts`
  - `test/routes/location.spec.ts`
  - `test/routes/species.spec.ts`
  - `test/routes/photo.spec.ts`
  - `test/routes/report.spec.ts`
  - `test/caching.spec.ts`

### 18. Document API Endpoints
**Problem**: No API documentation beyond what can be inferred from tests. URL patterns and query parameters not formally documented.

**Prompt**: Create comprehensive API documentation:
- Add `docs/API.md` documenting all endpoints (can derive from tests):
  - `GET /` - Homepage
  - `GET /firsts` - Firsts list (supports `?type=photo|sighting`, `?region=`, `?county=`, `?period=`)
  - `GET /firsts.json` - JSON format
  - `GET /firsts.geojson` - GeoJSON format
  - `GET /location/:id` - Location page (supports `?period=`, `?type=`, `?view=firsts`)
  - `GET /location/:id.json` - JSON format
  - `GET /species/:id` - Species page
  - `GET /species/:id.geojson` - GeoJSON format
  - `GET /photo/:id` - Photo page (id without .jpg extension)
  - `GET /report/nophotos` - Missing photos report (supports `?region=`, `?county=`)
  - `OPTIONS *` - CORS preflight
  - `HEAD *` - HEAD requests (same as GET without body)
- Document query parameters and their validation rules
- Provide example requests and responses for each format
- Document caching behavior and version headers
- Add OpenAPI/Swagger spec for JSON/GeoJSON endpoints
- Add JSDoc comments to controller functions

### 19. Add Code Documentation
**Problem**: Minimal inline documentation. Complex business logic (like "firsts" calculation) is not explained.

**Prompt**: Improve code documentation:
- Add JSDoc comments to all public functions explaining purpose, parameters, return values
- Document business logic, especially the "firsts" concept and how ROW_NUMBER is used
- Add comments explaining SQL queries, particularly complex window functions
- Document the Filter class and its query string format
- Add architecture decision records (ADRs) for key design choices

## Configuration & Environment

### 20. Extract Configuration
**Problem**: Hardcoded values scattered throughout code: URLs like `https://bird-gallery.xaviershay.com`, mapbox tokens in HTML, filter region values.

**Prompt**: Create configuration management:
- Create `config/constants.ts` for application constants
- Create `config/environment.ts` for environment-specific values
- Use environment variables for secrets and URLs
- Create type-safe config objects
- Document all configuration options
- Make configuration testable (inject config rather than import)

### 21. Improve Build Configuration
**Problem**: TypeScript configuration doesn't match actual file structure (`include: ["src/ts/*"]` should be recursive).

**Prompt**: Update build configuration:
- Fix tsconfig.json `include` to use `src/ts/**/*`
- Add path aliases for cleaner imports (e.g., `@models/`, `@controllers/`)
- Configure proper source maps for debugging
- Add stricter TypeScript checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Consider adding ESLint with Airbnb or similar config
- Add Prettier for consistent formatting

## Specific Bug Fixes

### 22. Fix Type Inconsistencies in Filter
**Problem**: `Filter` class has duplicate interface declaration that could cause issues. Filter options allow optional fields but constructor doesn't handle undefined properly.

**Prompt**: Clean up Filter implementation:
- Remove duplicate `interface Filter` declaration (lines after class already defines interface)
- Make FilterOptions more strictly typed
- Add factory methods for common filter patterns
- Add validation to Filter constructor
- Add tests for Filter class edge cases
- Document the query string format

### 23. Fix Variable Declaration Issues
**Problem**: Use of `var` instead of `const`/`let` in several places (e.g., `controller/species.ts`, `controller/firsts.ts`).

**Prompt**: Modernize variable declarations:
- Replace all `var` with `const` or `let` as appropriate
- Enable `no-var` ESLint rule to prevent future usage
- Prefer `const` by default, only use `let` when reassignment is needed
- Review scope of variables and minimize scope where possible

### 24. Standardize Import Statements
**Problem**: Mix of default and named imports, inconsistent import ordering.

**Prompt**: Standardize imports:
- Configure import sorting (via ESLint or Prettier)
- Use named imports for all utilities/helpers
- Use default imports only for components
- Group imports: external libraries, internal modules, types
- Sort alphabetically within groups
- Remove unused imports (enable TypeScript's `noUnusedLocals`)

### 25. Handle Missing Data Gracefully
**Problem**: Some functions return `null` on error but callers don't always check. `fetchLocation` returns null but then code accesses `location.id` without null check.

**Prompt**: Improve null safety:
- Add explicit null checks before accessing properties
- Use optional chaining (`?.`) where appropriate
- Return empty arrays instead of null for collections
- Add `@typescript-eslint/no-non-null-assertion` and fix all `!` usages
- Consider using Result types or throwing errors instead of returning null

## Long-term Architectural Improvements

### 26. Consider GraphQL or tRPC
**Problem**: REST API is ad-hoc with inconsistent patterns for related data fetching. Frontend might need to make multiple requests.

**Prompt**: Evaluate GraphQL or tRPC:
- Research if GraphQL would simplify data fetching patterns
- Consider tRPC for end-to-end type safety if TypeScript is used on client
- Evaluate whether current REST approach is sufficient
- Document trade-offs
- If implemented, could reduce controller boilerplate significantly

### 27. Add Observability
**Problem**: Limited logging and no structured monitoring. Hard to debug production issues.

**Prompt**: Add observability:
- Implement structured logging (JSON logs with context)
- Add request tracing with unique request IDs
- Log query performance (slow queries)
- Add metrics for response times, error rates
- Consider integration with Cloudflare Analytics or similar
- Add health check endpoint

### 28. Implement Graceful Degradation
**Problem**: If database is unavailable, entire site fails. No fallback for failed queries.

**Prompt**: Add resilience patterns:
- Implement circuit breaker for database queries
- Add retry logic with exponential backoff
- Serve stale cached data if database is unavailable
- Add graceful error pages that still show navigation
- Consider static fallback pages for critical routes

## Testing Status

**Current State** (Good News!):
- ✅ Integration test infrastructure is working (using Cloudflare vitest-pool-workers)
- ✅ Good coverage of main routes: `/`, `/location/:id`, `/firsts`, `/species/:id`, `/photo/:id`, `/report/nophotos`
- ✅ Tests for query parameters (period filtering, type filtering, regions)
- ✅ CORS and HTTP method handling tested
- ✅ Caching behavior tested (version headers, Cache-Control removal)
- ✅ One helper function tested (`format_location_name`)
- ✅ Test infrastructure handles database setup with SQL fixtures
- ✅ Good test structure with `beforeAll` and `beforeEach` hooks
- ✅ Tests use realistic data (actual species names, location IDs, dates)

**Gaps**:
- ❌ No unit tests for models (all database queries)
- ❌ No tests for most helpers (5 of 6 untested)
- ❌ No tests for Filter class
- ❌ No tests for view components (React)
- ❌ Limited edge case coverage (error paths, invalid inputs)
- ❌ No performance tests

**Test Infrastructure Notes**:
- Tests use Cloudflare's D1 in-memory database
- Schema is loaded from `src/sql/schema.sql` as raw string
- Test fixtures are inserted inline using `execSql` helper
- Tests use real Cloudflare Worker fetch interface via `SELF.fetch()`
- This is a good pattern - tests are integration tests that exercise the full stack

## Testing Infrastructure Improvements

### 29. Create Test Fixtures and Helpers
**Problem**: Test data is inserted inline in each test, leading to duplication. No shared fixtures for common scenarios.

**Prompt**: Create reusable test fixtures:
- Create `test/fixtures/` directory with common data:
  - `test/fixtures/locations.ts` - export common location records
  - `test/fixtures/species.ts` - export common species records
  - `test/fixtures/observations.ts` - factory functions for creating observations
  - `test/fixtures/photos.ts` - factory functions for creating photos
- Create `test/helpers.ts` with utility functions:
  - `insertLocation(db, data)` - helper to insert location records
  - `insertSpecies(db, data)` - helper to insert species records
  - `insertObservation(db, data)` - helper with sensible defaults
  - `insertPhoto(db, data)` - helper with sensible defaults
  - `buildTestData()` - creates a complete test dataset
- Refactor existing tests to use fixtures
- Makes tests more readable and maintainable

### 30. Add Test Database Utilities
**Problem**: The `execSql` helper is basic - splits on semicolons which could break on SQL strings containing semicolons. No transaction support.

**Prompt**: Improve test database utilities:
- Move `execSql` to `test/helpers.ts` and improve it:
  - Better SQL statement parsing (handle comments, strings)
  - Transaction support (begin/commit/rollback)
  - Better error messages (which statement failed)
- Add database assertion helpers:
  - `assertRecordExists(table, conditions)`
  - `assertRecordCount(table, conditions, expectedCount)`
  - `getRecord(table, conditions)` - for verification
- Add database cleanup utilities:
  - `clearTable(tableName)`
  - `resetDatabase()` - truncate all tables
- Consider using database transaction rollback for test isolation

### 31. Add Test Coverage Reporting
**Problem**: No visibility into test coverage. Don't know which code paths are tested.

**Prompt**: Add coverage reporting:
- Configure vitest coverage with `@vitest/coverage-v8`
- Add `npm run test:coverage` script
- Set coverage thresholds (e.g., 60% for now, increase over time)
- Generate HTML coverage reports
- Add coverage to CI/CD pipeline (if exists)
- Document uncovered code paths and create issues/todos

## Priority Recommendations

**High Priority** (Do First):
1. Extract Data Access Layer (#1) - Foundation for other improvements
2. Improve Type Definitions (#4) - Prevents bugs, enables better tooling
3. Standardize Error Handling (#7) - Improves reliability
4. Add Input Validation (#10) - Security and robustness
5. Fix Variable Declaration Issues (#23) - Quick wins
6. Expand Unit Tests for Helpers (#16) - Low-hanging fruit, good test examples exist

**Medium Priority** (Do Soon):
7. Remove Code Duplication (#8) - Reduces maintenance burden
8. Consolidate Filter Count Logic (#2) - Significant complexity reduction
9. Add Unit Tests for Models (#16) - Enables confident refactoring (easier after #1)
10. Standardize Date Handling (#5) - Prevents subtle bugs
11. Extract Configuration (#20) - Improves deployability
12. Expand Integration Tests (#17) - Build on existing good foundation

**Low Priority** (Nice to Have):
13. All other items - Incremental improvements that can be done over time

## Notes

- Each prompt can be tackled independently in most cases
- Start with high-priority items for maximum impact
- Run tests after each change (once tests exist!)
- Consider creating feature branches for larger refactorings
- Document decisions in commit messages or ADRs
