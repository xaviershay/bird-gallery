import photoUrl from "../helpers/photo_url";
import { Photo } from "../types";

interface ThumbnailStripProps {
  photos: Photo[];
}

export const ThumbnailStrip = ({ photos }: ThumbnailStripProps) => {
  const height = 150;
  return (
    <div className="thumbnails">
      {photos.map((photo) => (
        <a
          key={photo.fileName}
          href={`/photo/${photo.fileName.replace(/\.jpg$/, "")}`}
        >
          <img
            height={height}
            width={(photo.width / photo.height) * height}
            alt={photo.commonName}
            title={photo.commonName}
            className="thumbnail"
            src={photoUrl(photo.fileName)}
          />
        </a>
      ))}
    </div>
  );
};
