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
          <i className="fa-solid fa-plane-departure"></i> {tripReport.title}
        </h2>
        <p className="trip-dates">
          {formatDate(tripReport.startDate)} - {formatDate(tripReport.endDate)}
        </p>

        <div className="trip-description">
          {tripReport.description.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <div className="trip-stats-summary">
          <h3>Summary Statistics</h3>
          <ul>
            <li><strong>{stats.totalSpecies}</strong> species observed</li>
            <li><strong>{stats.totalObservations}</strong> total observations</li>
            <li><strong>{stats.totalChecklists}</strong> checklists submitted</li>
            <li><strong>{stats.totalLocations}</strong> unique locations visited</li>
            {stats.firstsSeen > 0 && (
              <li><strong>{stats.firstsSeen}</strong> life firsts seen</li>
            )}
            {stats.firstsPhotographed > 0 && (
              <li><strong>{stats.firstsPhotographed}</strong> life firsts photographed</li>
            )}
          </ul>
        </div>

        <MapView
          dataUrl={`/trip-report/${tripReport.id}.geojson`}
          urlBuilder={`(id) => ("/location/" + id)`}
        />

        <h3>Species List ({uniqueSpecies.length})</h3>
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Location</th>
              <th>Date</th>
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
                <td>
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
