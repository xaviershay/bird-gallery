import photoUrl from "../helpers/photo_url";
import { Photo } from "../types";

interface ThumbnailStripProps {
  photos: Photo[];
}

export const ThumbnailStrip = ({ photos }: ThumbnailStripProps) => {
  return (
    <div className="thumbnails">
      {photos.map((photo) => (
        <img key={photo.fileName} alt={photo.commonName} title={photo.commonName} className="thumbnail" src={photoUrl(photo.fileName)} />
      ))}
    </div>
  );
}
