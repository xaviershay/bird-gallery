import * as fs from "fs";
import * as path from "path";
import exifr from "exifr";

const photosDir = path.join(__dirname, "../../data/photos");
const metadataDir = path.join(__dirname, "../../data/metadata");

if (!fs.existsSync(metadataDir)) {
  fs.mkdirSync(metadataDir);
}

fs.readdir(photosDir, async (err, files) => {
  if (err) {
    console.error("Error reading photos directory:", err);
    return;
  }

  for (const file of files) {
    const filePath = path.join(photosDir, file);
    const fileName = path.parse(file).name;
    const metadataPath = path.join(
      metadataDir,
      `${fileName}.json`
    );

      const metadata = await exifr.parse(filePath, {xmp: true});
      if (!metadata) {
        console.error("Error reading metadata:", filePath);
        continue;
      }

      const tagsArray = typeof metadata.TagsList === 'string' ? metadata.TagsList.split(',') : metadata.TagsList;
      const ebirdTag = tagsArray?.find((tag : string) => tag.startsWith("ebird/"));
      if (!ebirdTag) {
        console.error(metadata.TagsList);
        throw new Error(`No "ebird/NAME" tag found in metadata for file: ${filePath}`);
      }
      const name = ebirdTag.split("/")[1];

      // Prefer standard tags with sensible fallbacks across cameras
      const iso =
        metadata.ISO ??
        metadata.PhotographicSensitivity ??
        metadata.ISOSpeedRatings;

      const zoom =
        metadata.FocalLengthIn35mmFormat ??
        metadata.FocalLengthIn35mm ??
        metadata.FocalLengthIn35mmFilm ??
        metadata.FocalLength; // fallback to optical focal length (mm)

      const photoMetadata: Record<string, unknown> = {
        fileName: fileName + ".jpg",
        height: metadata.ExifImageHeight,
        width: metadata.ExifImageWidth,
        tags: tagsArray,
        rating: metadata.Rating,
        takenAt: metadata.DateTimeOriginal,
        exposureTime: metadata.ExposureTime,
        fNumber: metadata.FNumber,
        iso,
        zoom,
        name: name
      };

      // a) Enforce presence: raise if any field is undefined or null
      const missing = Object.entries(photoMetadata)
        .filter(([_, v]) => v === undefined || v === null)
        .map(([k]) => k);
      if (missing.length > 0) {
        throw new Error(
          `Missing required metadata fields for ${filePath}: ${missing.join(", ")}`
        );
      }

      fs.writeFileSync(metadataPath, JSON.stringify(photoMetadata, null, 2));
      console.log(`Metadata for ${file} written to ${metadataPath}`);
  }

  // After processing all photos, check for orphaned metadata files
  cleanupOrphanedMetadataFiles();
});

/**
 * Checks for metadata files that correspond to photos that no longer exist
 * and deletes them.
 */
function cleanupOrphanedMetadataFiles() {
  console.log("Checking for orphaned metadata files...");
  
  try {
    const metadataFiles = fs.readdirSync(metadataDir);
    let deletedCount = 0;
    
    for (const metadataFile of metadataFiles) {
      if (!metadataFile.endsWith('.json')) continue;
      
      const metadataPath = path.join(metadataDir, metadataFile);
      const metadataContent = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      // Check if the photo file exists
      const photoFilename = metadataContent.fileName;
      const photoPath = path.join(photosDir, photoFilename);
      
      if (!fs.existsSync(photoPath)) {
        // Photo doesn't exist anymore, delete the metadata file
        fs.unlinkSync(metadataPath);
        console.log(`Deleted orphaned metadata file: ${metadataFile}`);
        deletedCount++;
      }
    }
    
    console.log(`Cleanup complete. Deleted ${deletedCount} orphaned metadata files.`);
  } catch (err) {
    console.error("Error during orphaned metadata cleanup:", err);
  }
}
