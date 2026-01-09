import { Species, Observation } from "../types";
import { speciesUrl } from "../helpers/species_link";
import formatLocationName from "../helpers/format_location_name";
import { formatDate } from "../helpers/format_date";
import { ThumbnailStrip } from "./thumbnail_strip";
import { MapView } from "./components/map";

interface SpeciesViewProps {
  observations: Array<Observation>;
  species: Species;
}

export const SpeciesView = (data: SpeciesViewProps) => {
  const { observations, species } = data;
  const observationCount = observations.length;

  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-feather"></i>
          {species.name}
        </h2>
        <ul className="actions">
          <li>
            <a
              id="copy-species-id"
              href="#"
              data-copy={species.id}
              title="Copy species ID to clipboard"
            >
              <i className="fa-solid fa-copy"></i> Copy species ID to clipboard
            </a>
          </li>
        </ul>
        <ThumbnailStrip photos={species.photos} />
        <MapView
          dataUrl={speciesUrl(species.id, { format: "geojson" })}
          urlBuilder="(id) => ('/location/' + id)"
        />
        <table className="species-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Location</th>
              <th className="date">Seen</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((o, index) => (
              <tr key={o.id}>
                <td>{observationCount - index}</td>
                <td>
                  <a href={`/location/${o.location.id}`}>
                    {formatLocationName(o.location.name)}
                  </a>
                </td>
                <td className="date">
                  <a href={`https://ebird.org/checklist/S${o.checklistId}`}>
                    {formatDate(o.seenAt)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Load copy to clipboard script */}
      <script src="/js/copy-to-clipboard.js"></script>
    </>
  );
};
