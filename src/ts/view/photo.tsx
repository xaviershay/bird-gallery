import { formatExposure } from "../helpers/format_exposure";
import formatLocationName from "../helpers/format_location_name";
import photoUrl from "../helpers/photo_url";
import { Observation, Photo } from "../types";
import { format } from 'date-fns';

interface PhotoViewProps {
  observation: Observation;
  photo: Photo;
}
export const PhotoView = (data: PhotoViewProps) => {
  const { photo, observation } = data;

  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-location-dot"></i>
          {photo.commonName}
        </h2>
        <img src={photoUrl(photo.fileName, {thumbnail: false})} alt={photo.commonName} title={photo.commonName} />
      </section>
      <table>
        <tr>
            <th>Bird</th>
            <td><a href={`/species/${observation.speciesId}`}>{photo.commonName}</a></td>
        </tr>
        <tr>
            <th>Rating</th>
            <td>{'★'.repeat(photo.rating)}</td>
        </tr>
        <tr>
            <th>Taken At</th>
            <td>{format(new Date(photo.takenAt), 'MMMM d, yyyy h:mm a')}</td>
        </tr>
        <tr>
            <th>Location</th>
            <td><a href={`/location/${observation.location.id}`}>{formatLocationName(observation.location.name)}</a></td>
        </tr>
        <tr>
            <th>Camera</th>
            <td>NIKON COOLPIX 950</td>
        </tr>
        <tr>
            <th>Aperture</th>
            <td>F{photo.fNumber}</td>
        </tr>
        <tr>
            <th>Focal</th>
            <td>{photo.zoom}mm</td>
        </tr>
        <tr>
            <th>Exposure</th>
            <td>{formatExposure(photo.exposure)}</td>
        </tr>
        <tr>
            <th>Sensitivity</th>
            <td>{photo.iso} ISO</td>
        </tr>
      </table>
    </>
  );
};
