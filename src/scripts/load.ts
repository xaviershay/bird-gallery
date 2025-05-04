import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { format, parse as parseDate } from 'date-fns';

// Helper function to generate SQL statements
function generateSQL(query: string, params: any[]) {
  const formattedParams = params.map((param) =>
    typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param
  );
  return(query.replace(/\?/g, () => formattedParams.shift()));
}

// Load CSV data
const csvFilePath = 'data/MyEBirdData.csv';
const taxonomyFilePath = 'data/ebird-taxonomy.csv';
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
      category: record['CATEGORY']
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

    const timeParsed = time && time.trim() 
      ? format(parseDate(time, 'hh:mm a', new Date()), 'HH:mm:ss') 
      : '00:00:00';
    const seenAt = `${date}T${timeParsed}`;
    const submissionId = parseInt(submissionIdRaw.replace(/^S/, ''));
    const locationId = parseInt(locationIdRaw.replace(/^L/, ''));
    const taxonomyEntry : any = taxonomyMap.get(commonName.toLowerCase());

    if (!taxonomyEntry) {
      console.error(`Taxonomy entry not found for common name: ${commonName}`);
      continue;
    }

    if (!(taxonomyEntry.category == "species" || taxonomyEntry.category == "domestic")) {
      continue;
    }

    if (submissionId == 220837850 && taxonomyEntry.category == "domestic") {
      // This checklist included two exotic escapees, which don't count in eBird
      // totals, but this data isn't present in the export.
      // Since this situation won't happen often, hard code it here until an
      // alternative solution is available.
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
  console.log("DELETE FROM observation;")
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

  // Directory containing metadata JSON files
  const metadataDir = 'data/metadata';
  const metadataFiles = readdirSync(metadataDir);
  const photoSQLStatements = [];

  // Process metadata files
  for (const file of metadataFiles) {
    const filePath = path.join(metadataDir, file);
    const metadata = JSON.parse(readFileSync(filePath, 'utf-8'));

    const { fileName, takenAt, name, height, width, rating, exposureTime, fNumber, iso, zoom } = metadata;
    const photoTime = new Date(takenAt);

    // Find matching observation
    const matchingObservation = observationSQLStatements.find(([id, checklistId, speciesId, locationId, count, seenAt]) => {
      const observationTime = new Date(seenAt);
      const timeDifference = Math.abs(photoTime.getTime() - observationTime.getTime());
      return (
        (taxonomyMap.get(name.toLowerCase()) as { speciesId: string } | undefined)?.speciesId === speciesId &&
        timeDifference <= 6 * 60 * 60 * 1000 // 6 hour tolerance
      );
    });

    if (matchingObservation) {
      const [observationId] = matchingObservation;
      photoSQLStatements.push([
        fileName,
        observationId,
        takenAt,
        parseInt(rating),
        parseInt(height),
        parseInt(width),
        parseFloat(exposureTime),
        fNumber,
        iso,
        zoom
      ]);
    } else {
      console.error(`No matching observation found for photo: ${fileName}`);
    }
  }

  // Prepare bulk insert SQL for photos
  if (photoSQLStatements.length > 0) {
    const photoValues = photoSQLStatements
      .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .join(',\n');
    const photoParams = photoSQLStatements.flat();
    console.log(generateSQL(
      `INSERT INTO photo (file_name, observation_id, taken_at, rating, height, width, exposure, fnumber, iso, zoom) VALUES
       ${photoValues}
       ON CONFLICT(file_name) DO UPDATE SET
       observation_id = excluded.observation_id,
       taken_at = excluded.taken_at,
       rating = excluded.rating,
       height = excluded.height,
       width = excluded.width,
       exposure = excluded.exposure,
       fnumber = excluded.fnumber,
       iso = excluded.iso,
       zoom = excluded.zoom;`,
      photoParams
    ));
  }
})();