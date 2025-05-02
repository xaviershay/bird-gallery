import { Species, Observation } from "../types";
import { speciesUrl } from "../helpers/species_link";
import formatLocationName from "../helpers/format_location_name";
import { formatDate } from "../helpers/format_date";
import { ThumbnailStrip } from "./thumbnail_strip";

interface SpeciesViewProps {
  observations: Array<Observation>;
  species: Species;
}

export const SpeciesView = (data: SpeciesViewProps) => {
  const { observations, species } = data;
  const observationCount = observations.length;
  const scriptContent = `
    urlF = (id) => ("/location/" + id);
    initMap("${speciesUrl(species.id, { format: "json" })}", urlF);
  `;

  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-feather"></i>
          {species.name}
        </h2>
        <ThumbnailStrip photos={species.photos} />
        <div id="map"></div>
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Location</th>
              <th>Seen</th>
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
                <td>{formatDate(o.seenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <script src="/js/map.js"></script>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }}></script>
    </>
  );
};
