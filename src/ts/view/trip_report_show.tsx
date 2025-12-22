import { TripReport, TripReportStats, Observation } from "../types";
import { formatDate } from "../helpers/format_date";
import speciesLink from "../helpers/species_link";
import formatLocationName from "../helpers/format_location_name";
import { MapView } from "./components/map";

interface TripReportShowViewProps {
  tripReport: TripReport;
  stats: TripReportStats;
  observations: Observation[];
}

export const TripReportShowView = (props: TripReportShowViewProps) => {
  const { tripReport, stats, observations } = props;

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
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Location</th>
              <th className="date">Date</th>
            </tr>
          </thead>
          <tbody>
            {uniqueSpecies.map((obs, index) => (
              <tr key={obs.speciesId}>
                <td>{index + 1}</td>
                <td>{speciesLink(obs)}</td>
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
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
};
