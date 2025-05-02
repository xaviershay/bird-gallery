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

      const photoMetadata = {
        fileName: fileName + ".jpg",
        height: metadata.ExifImageHeight,
        width: metadata.ExifImageWidth,
        tags: tagsArray,
        rating: metadata.Rating,
        timeTaken: metadata.DateTimeOriginal,
        exposureTime: metadata.ExposureTime,
        fNumber: metadata.FNumber,
        iso: metadata.ISO,
        zoom: metadata.FocalLengthIn35mmFormat,
        name: name
      };

      fs.writeFileSync(metadataPath, JSON.stringify(photoMetadata, null, 2));
      console.log(`Metadata for ${file} written to ${metadataPath}`);
  }
});
