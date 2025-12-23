import { formatDate } from "../helpers/format_date";
import formatLocationName from "../helpers/format_location_name";
import { MapView } from "./components/map";

interface LocationSummaryView {
  id: number;
  name: string;
  lat: number;
  lng: number;
  speciesCount: number;
  lastSeenAt: Date;
}

interface LocationsViewProps {
  locations: LocationSummaryView[];
}

export const LocationsView = ({ locations }: LocationsViewProps) => {
  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-location-dot"></i> Locations
        </h2>
        <p>Map shows unique species seen in the area.</p>
        <MapView
          dataUrl="/report/locations.geojson"
          urlBuilder="(id) => ('/location/' + id)"
          computeUniqueSpecies={true}
        />
        <table className="locations-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Location</th>
              <th>Species</th>
              <th className="date">Last Vist</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc, index) => (
              <tr key={loc.id}>
                <td>{locations.length - index}</td>
                <td>
                  <a href={`/location/${loc.id}`}>{formatLocationName(loc.name)}</a>
                </td>
                <td>{loc.speciesCount}</td>
                <td className="date">{formatDate(loc.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
};
