import { TripReport, TripReportStats, Observation, Photo } from "../types";
import { formatDate } from "../helpers/format_date";
import speciesLink from "../helpers/species_link";
import formatLocationName from "../helpers/format_location_name";
import { MapView } from "./components/map";
import photoUrl from "../helpers/photo_url";
import { ThumbnailStrip } from "./thumbnail_strip";

interface TripReportShowViewProps {
  tripReport: TripReport;
  stats: TripReportStats;
  observations: Observation[];
  photos: Photo[];
}

export const TripReportShowView = (props: TripReportShowViewProps) => {
  const { tripReport, stats, observations, photos } = props;

  // Get unique species sorted by name
  const speciesMap = new Map<string, Observation>();
  for (const obs of observations) {
    if (!speciesMap.has(obs.speciesId)) {
      speciesMap.set(obs.speciesId, obs);
    }
  }
  const uniqueSpecies = Array.from(speciesMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Group photos by species
  const photosBySpecies = new Map<string, Photo[]>();
  for (const photo of photos) {
    const speciesPhotos = photosBySpecies.get(photo.commonName) || [];
    speciesPhotos.push(photo);
    photosBySpecies.set(photo.commonName, speciesPhotos);
  }

  return (
    <>
      <section>
        <h2>
          {tripReport.title}
        </h2>
        <div className="trip-stats-summary">
          <p className="trip-dates">
            {formatDate(tripReport.startDate)} - {formatDate(tripReport.endDate)}
          </p>
          <div className="trip-stats">
            <span><strong>{stats.totalSpecies}</strong> species</span>
            {' • '}
            <span><strong>{stats.totalChecklists}</strong> checklists</span>
            {' • '}
            <span><strong>{stats.totalLocations}</strong> locations</span>
            {stats.firstsSeen > 0 && (
              <>
                {' • '}
                <span><strong>{stats.firstsSeen}</strong> lifers</span>
              </>
            )}
            {stats.firstsPhotographed > 0 && (
              <>
                {' • '}
                <span><strong>{stats.firstsPhotographed}</strong> photo firsts</span>
              </>
            )}
          </div>
        </div>

        {photos.length > 0 && (
          <div className="trip-photos-strip">
            <ThumbnailStrip photos={photos} />
          </div>
        )}

        <MapView
          dataUrl={`/trip-report/${tripReport.id}.geojson`}
          urlBuilder={`(id) => ("/location/" + id)`}
        />

        <div className="trip-description">
          {tripReport.description.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>


        <h3>Species List</h3>
        <table className="bird-list trip-report-species-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Location</th>
              <th className="date">Date</th>
            </tr>
          </thead>
          <tbody>
            {uniqueSpecies.map((obs, index) => {
              const speciesPhotos = photosBySpecies.get(obs.name) || [];
              return (
                <tr key={obs.speciesId}>
                  <td>{index + 1}</td>
                  <td className="name-with-photos">
                    {speciesLink(obs)}
                    {speciesPhotos.length > 0 && (
                      <div className="trip-report-photos">
                        {speciesPhotos.map((photo) => (
                          <a key={photo.fileName} href={`/photo/${photo.fileName.replace(/\.[^/.]+$/, '')}`}>
                            <img
                              src={photoUrl(photo.fileName, { thumbnail: true })}
                              alt={photo.commonName}
                              className="trip-report-thumbnail"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <a href={`/location/${obs.locationId}`}>
                      {formatLocationName(obs.location.name)}
                    </a>
                  </td>
                  <td className="date">
                    <a href={`https://ebird.org/checklist/S${obs.checklistId}`}>
                      {formatDate(obs.seenAt)}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
};
