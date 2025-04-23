import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Helper function to generate SQL statements
function generateSQL(query: string, params: any[]) {
  const formattedParams = params.map((param) =>
    typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param
  );
  return(query.replace(/\?/g, () => formattedParams.shift()));
}

// Load CSV data
const csvFilePath = '/home/xavier/code/bird-gallery-cloudflare/data/MyEBirdData.csv';
const taxonomyFilePath = '/home/xavier/code/bird-gallery-cloudflare/data/ebird-taxonomy.csv';
const csvData = readFileSync(csvFilePath, 'utf-8');
const taxonomyData = readFileSync(taxonomyFilePath, 'utf-8');
const records = parse(csvData, { columns: true, skip_empty_lines: true, relax_column_count: true });
const taxonomyRecords = parse(taxonomyData, { columns: true, skip_empty_lines: true });

// Create a lookup map for taxonomy data
const taxonomyMap = new Map(
  taxonomyRecords.map((record : any) => [
    record['COMMON_NAME'].toLowerCase(),
    {
      speciesId: record['SPECIES_CODE'],
      scientificName: record['SCIENTIFIC_NAME'],
      taxonomicOrder: parseInt(record['TAXON_ORDER']),
      commonNameCodes: record['COM_NAME_CODES'],
      familyId: record['FAMILY_CODE'],
    },
  ])
);

// Create sets to store unique location and species records
const uniqueLocations: Map<number, [number, string, number, number, string, string]> = new Map();
const uniqueSpecies: Map<string, [string, string, string, number, string, string]> = new Map();
const observationSQLStatements = [];

// Process and group records
(async () => {
  for (const record of records) {
    const {
      'Submission ID': submissionIdRaw,
      'Common Name': commonName,
      'Count': count,
      'Location ID': locationIdRaw,
      'State/Province': state,
      County: county,
      Location: locationName,
      Latitude: lat,
      Longitude: lng,
      Date: date,
      Time: time,
    } = record;

    const seenAt = `${date}T${time}`;
    const submissionId = parseInt(submissionIdRaw.replace(/^S/, ''));
    const locationId = parseInt(locationIdRaw.replace(/^L/, ''));
    const taxonomyEntry = taxonomyMap.get(commonName.toLowerCase());

    if (!taxonomyEntry) {
      console.error(`Taxonomy entry not found for common name: ${commonName}`);
      continue;
    }

    const { speciesId, scientificName, taxonomicOrder, familyId, commonNameCodes } : any = taxonomyEntry;
    const observationId = submissionId + '-' + speciesId;

    // Add unique location
    if (!uniqueLocations.has(locationId)) {
      uniqueLocations.set(locationId, [locationId, locationName, parseFloat(lat), parseFloat(lng), state, county]);
    }

    // Add unique species
    if (!uniqueSpecies.has(speciesId)) {
      uniqueSpecies.set(speciesId, [speciesId, commonName, scientificName, taxonomicOrder, commonNameCodes, familyId]);
    }

    // Prepare observation SQL
    observationSQLStatements.push(
      [
        observationId,
        submissionId,
        speciesId,
        locationId,
        count === 'X' ? null : parseInt(count),
        seenAt,
      ]
    );
  }

  // Prepare bulk insert SQL for unique locations
  if (uniqueLocations.size > 0) {
    const locationValues = Array.from(uniqueLocations.values())
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(",\n");
    const locationParams = Array.from(uniqueLocations.values()).flat();
    console.log(generateSQL(
      `INSERT INTO location (id, name, lat, lng, state, county) VALUES
      ${locationValues}
       ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       lat = excluded.lat,
       lng = excluded.lng,
       state = excluded.state,
       county = excluded.county;`,
      locationParams
    ));
  }

  // Prepare bulk insert SQL for unique species
  if (uniqueSpecies.size > 0) {
    const speciesValues = Array.from(uniqueSpecies.values())
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(",\n");
    const speciesParams = Array.from(uniqueSpecies.values()).flat();
    console.log(generateSQL(
      `INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
       ${speciesValues}
       ON CONFLICT(id) DO UPDATE SET
       common_name = excluded.common_name,
       scientific_name = excluded.scientific_name,
       taxonomic_order = excluded.taxonomic_order,
       common_name_codes = excluded.common_name_codes,
       family_id = excluded.family_id;`,
      speciesParams
    ));
  }

  // Prepare bulk insert SQL for observations
  if (observationSQLStatements.length > 0) {
    const observationValues = observationSQLStatements
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(",\n");
    const observationParams = observationSQLStatements.flat();
    console.log(generateSQL(
      `INSERT INTO observation (id, checklist_id, species_id, location_id, count, seen_at) VALUES
       ${observationValues}
       ON CONFLICT(id) DO UPDATE SET
       species_id = excluded.species_id,
       location_id = excluded.location_id,
       count = excluded.count,
       seen_at = excluded.seen_at;`,
      observationParams
    ));
  }
})();