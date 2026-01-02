import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { format, parse as parseDate } from 'date-fns';
import * as yaml from 'js-yaml';

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
const taxonomyRecords = parse(taxonomyData, { columns: true, skip_empty_lines: true, bom: true });

// Create a lookup map for taxonomy data
const taxonomyMap = new Map(
  taxonomyRecords.map((record: any) => {
    const primaryComName = record['PRIMARY_COM_NAME'];
    const speciesCode = record['SPECIES_CODE'];
    const scientificName = record['SCI_NAME'];
    const taxonOrderRaw = record['TAXON_ORDER'];
    const commonNameCodes = record['REPORT_AS'];
    const familyCode = record['FAMILY'];
    const category = record['CATEGORY'];

    return [
      primaryComName.toLowerCase(),
      {
        speciesId: speciesCode,
        scientificName,
        taxonomicOrder: parseInt(taxonOrderRaw),
        commonNameCodes,
        familyId: familyCode,
        category,
      },
    ];
  })
);

// Create sets to store unique location and species records
// Add 'hotspot' boolean to the tuple
const uniqueLocations: Map<number, [number, string, number, number, string, string, number]> = new Map();
const uniqueSpecies: Map<string, [string, string, string, number, string, string]> = new Map();
const observationSQLStatements : any[] = [];

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
      'ML Catalog Numbers': mlCatalogNumbers,
      'Observation Details': observationDetails
    } = record;

    // The 2025 taxonomy update broke something: https://www.aba.org/the-2025-e-bird-clements-taxonomy-update/
    // Checklists record the bird as "Eurasian Whimbrel" but this name does not exist in the taxonomy!
    // (true as of 2025-11-10)
    const replacement: Record<string, string> = {
      //'Eurasian Whimbrel': 'Whimbrel (White-rumped)'
    };
    const key = replacement[commonName] ?? commonName;
    const timeParsed = time && time.trim() 
      ? format(parseDate(time, 'hh:mm a', new Date()), 'HH:mm:ss') 
      : '00:00:00';
    const seenAt = `${date}T${timeParsed}`;
    const submissionId = parseInt(submissionIdRaw.replace(/^S/, ''));
    let locationId = parseInt(locationIdRaw.replace(/^L/, ''));
    // Merge location 39704816 into 919153
    if (locationId === 39704816) {
      locationId = 919153;
    }
    const taxonomyEntry : any = taxonomyMap.get(key.toLowerCase());

    if (!taxonomyEntry) {
      console.error(`Taxonomy entry not found for common name: ${commonName}`);
      continue;
    }

    if (!(taxonomyEntry.category == "species" || taxonomyEntry.category == "domestic" || taxonomyEntry.category == "form" || taxonomyEntry.category == "issf")) {
      continue;
    }

    if (submissionId == 220837850 && taxonomyEntry.category == "domestic") {
      // This checklist included two exotic escapees, which don't count in eBird
      // totals, but this data isn't present in the export.
      // Since this situation won't happen often, hard code it here until an
      // alternative solution is available.
      continue;
    }

    if (submissionId == 247953720 && taxonomyEntry.category == "domestic") {
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
      // Determine if this is a hotspot: if the name contains GPS coordinates, it's NOT a hotspot
      // eBird GPS locations are like "40.1234,-75.1234" or similar
      const gpsPattern = /\s*\(\s*-?\d+(\.\d+)?(\s*,\s*-?\d+(\.\d+)?)+\s*\)\s*$/;
      //const gpsPattern = /^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$/;
      const isHotspot = gpsPattern.test(locationName.trim()) ? 0 : 1;
      uniqueLocations.set(locationId, [locationId, locationName, parseFloat(lat), parseFloat(lng), state, county, isHotspot]);
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
        mlCatalogNumbers || null,
        observationDetails || null
      ]
    );
  }

  // Prepare bulk insert SQL for unique locations
  if (uniqueLocations.size > 0) {
    const locationValues = Array.from(uniqueLocations.values())
      .map(() => '(?, ?, ?, ?, ?, ?, ?)')
      .join(",\n");
    const locationParams = Array.from(uniqueLocations.values()).flat();
    console.log(generateSQL(
      `INSERT INTO location (id, name, lat, lng, state, county, hotspot) VALUES
      ${locationValues}
       ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       lat = excluded.lat,
       lng = excluded.lng,
       state = excluded.state,
       county = excluded.county,
       hotspot = excluded.hotspot;`,
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
    const chunkSize = 500; // Configurable chunk size
    for (let i = 0; i < observationSQLStatements.length; i += chunkSize) {
      const chunk = observationSQLStatements.slice(i, i + chunkSize);
      const observationValues = chunk
        .map(() => '(?, ?, ?, ?, ?, ?, ?, ?)')
        .join(",\n");
      const observationParams = chunk.flat();
      console.log(generateSQL(
        `INSERT INTO observation (id, checklist_id, species_id, location_id, count, seen_at, ml_catalog_numbers, comment) VALUES
       ${observationValues}
       ON CONFLICT(id) DO UPDATE SET
       species_id = excluded.species_id,
       location_id = excluded.location_id,
       count = excluded.count,
       seen_at = excluded.seen_at,
       ml_catalog_numbers = excluded.ml_catalog_numbers;`,
        observationParams
      ));
    }
  }

  // Directory containing metadata JSON files
  const metadataDir = 'data/metadata';
  const metadataFiles = readdirSync(metadataDir);
  const photoSQLStatements : any[] = [];

  // Process metadata files
  for (const file of metadataFiles) {
    const filePath = path.join(metadataDir, file);
    const metadata = JSON.parse(readFileSync(filePath, 'utf-8'));


    const { fileName, takenAt, name, height, width, rating, exposureTime, fNumber, iso, zoom, tags, camera, lens } = metadata;
    const photoTime = new Date(takenAt);

    let formattedTags = '';
    if (tags && Array.isArray(tags)) {
      formattedTags = tags
        .filter(tag => tag.startsWith('birdtype/'))
        .map(tag => {
          // Extract the portion after 'birdtype/' and sentence case it
          const tagText = tag.substring(9); // 'birdtype/'.length = 9
          return tagText.charAt(0).toUpperCase() + tagText.slice(1).toLowerCase();
        })
        .join(', ');
    }

    // Find matching observation
    const speciesId = (taxonomyMap.get(name.toLowerCase()) as { speciesId: string } | undefined)?.speciesId;
    
    // Find all observations of the same species that have ML Catalog Numbers
    const potentialMatches = observationSQLStatements.filter(([id, checklistId, obsSpeciesId, locationId, count, seenAt, mlCatalogNum]) => 
      obsSpeciesId === speciesId && mlCatalogNum !== null && mlCatalogNum !== ""
    );
    
    if (potentialMatches.length === 0) {
      // I have a few photos of these that don't match but I'm not going to delete them so just ignore
      if (name !== "Domestic Goose") {
        console.error(`No matching species with ML Catalog Numbers found for photo: ${fileName} (${name})`);
      }
    } else {
      // Calculate time differences and find the closest match
      const matchesWithTimeDiff = potentialMatches.map(observation => {
        const [observationId, checklistId, obsSpeciesId, locationId, count, seenAt, mlCatalogNum] = observation;
        const observationTime = new Date(seenAt);
        const timeDifference = Math.abs(photoTime.getTime() - observationTime.getTime());
        return { observation, timeDifference };
      });
      
      // Sort by time difference
      matchesWithTimeDiff.sort((a, b) => a.timeDifference - b.timeDifference);
      
      // Get the closest match
      const closestMatch = matchesWithTimeDiff[0];
      
      // Check if it's within tolerance
      if (closestMatch.timeDifference <= 6 * 60 * 60 * 1000) { // 6 hour tolerance
        // Check if multiple observations are very close in time
        const closeMatches = matchesWithTimeDiff.filter(match => 
          match.timeDifference <= closestMatch.timeDifference + (15 * 60 * 1000) // within 15 minutes of closest
        );
        
        if (closeMatches.length > 1) {
          // Only report error if observation was within the last month
          const [, , , , , seenAt] = closestMatch.observation;
          const observationTime = new Date(seenAt);
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          
          // Since this isn't necessarily an issue, flag it when first found,
          // but stop reporting over time to not clog up output.
          if (observationTime >= oneMonthAgo) {
            console.error(`Multiple potential matches for photo ${fileName} (${name}):`);
            closeMatches.forEach(match => {
              const [obsId, checklistId, , locationId, , seenAt] = match.observation;
              console.error(`  Observation ${obsId}, Location ${locationId}, Time ${seenAt}, Diff: ${Math.round(match.timeDifference / (60 * 1000))} minutes`);
            });
          }
        }
        
        const matchingObservation = closestMatch.observation;
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
          zoom,
          formattedTags,
          camera,
          lens || null
        ]);
      } else {
        console.error(`No observation within time tolerance for photo: ${fileName} (closest match was ${Math.round(closestMatch.timeDifference / (60 * 60 * 1000))} hours away)`);
      }
    }
  }

  // Prepare bulk insert SQL for photos
  if (photoSQLStatements.length > 0) {
    const photoValues = photoSQLStatements
      .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .join(',\n');
    const photoParams = photoSQLStatements.flat();
    console.log(generateSQL(
      `INSERT INTO photo (file_name, observation_id, taken_at, rating, height, width, exposure, fnumber, iso, zoom, tags, camera, lens) VALUES
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
       zoom = excluded.zoom,
       tags = excluded.tags,
       camera = excluded.camera,
       lens = excluded.lens;`,
      photoParams
    ));
  }

  // Load trip reports from YAML files
  const tripReportsDir = 'data/trip-reports';
  const tripReportFiles = readdirSync(tripReportsDir).filter(f => f.endsWith('.yml'));
  const tripReports = [];

  for (const file of tripReportFiles) {
    const filePath = path.join(tripReportsDir, file);
    const tripReportYaml = readFileSync(filePath, 'utf-8');
    const report = yaml.load(tripReportYaml) as any;
    // Derive id from filename (remove .yml extension)
    report.id = file.replace(/\.yml$/, '');
    tripReports.push(report);
  }

  // Delete existing trip report data
  console.log("DELETE FROM trip_report_checklist;");
  console.log("DELETE FROM trip_report;");

  // Insert trip reports and their checklists
  for (const report of tripReports) {
    // Ensure dates are strings (YAML may parse them as Date objects)
    const startDate = typeof report.start_date === 'string' ? report.start_date : report.start_date.toISOString().split('T')[0];
    const endDate = typeof report.end_date === 'string' ? report.end_date : report.end_date.toISOString().split('T')[0];

    // Insert trip report
    console.log(generateSQL(
      `INSERT INTO trip_report (id, title, description, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [report.id, report.title, report.description, startDate, endDate, new Date().toISOString()]
    ));

    // Find all checklist IDs for observations within the trip date range
    const checklistIds = new Set<number>();
    for (const [, checklistId, , , , seenAt] of observationSQLStatements) {
      const obsDate = seenAt.split('T')[0]; // Extract date portion
      if (obsDate >= startDate && obsDate <= endDate) {
        checklistIds.add(checklistId);
      }
    }

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
