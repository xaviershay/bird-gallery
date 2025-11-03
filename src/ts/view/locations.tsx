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
        <MapView
          dataUrl="/report/locations.geojson"
          urlBuilder="(id) => ('/location/' + id)"
        />
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Location</th>
              <th>Species</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc, index) => (
              <tr key={loc.id}>
                <td>{index + 1}</td>
                <td>
                  <a href={`/location/${loc.id}`}>{formatLocationName(loc.name)}</a>
                </td>
                <td>{loc.speciesCount}</td>
                <td>{formatDate(loc.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
};
