import photoUrl from "../helpers/photo_url";
import { Photo } from "../types";

interface GalleryViewProps {
  photos: Photo[];
}

export const GalleryView = ({ photos }: GalleryViewProps) => {
  const baseHeight = 150;

  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-images"></i> Gallery ({photos.length} Photos)
        </h2>
        {photos.length === 0 ? (
          <p>No photos yet.</p>
        ) : (
          <div className="gallery">
            {photos.map((photo) => {
              const aspectRatio = photo.width / photo.height;
              return (
                <a
                  key={photo.fileName}
                  href={`/photo/${photo.fileName.replace(/\.jpg$/, "")}`}
                  className="gallery-item"
                  style={{ flexGrow: aspectRatio }}
                >
                  <img
                    height={baseHeight}
                    width={aspectRatio * baseHeight}
                    alt={photo.commonName}
                    title={photo.commonName}
                    className="thumbnail"
                    src={photoUrl(photo.fileName)}
                  />
                </a>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};
