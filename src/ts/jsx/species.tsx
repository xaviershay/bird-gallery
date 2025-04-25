import { Species, Observation } from "../types";
import { speciesUrl } from "../helpers/species_link";
import formatLocationName from "../helpers/format_location_name";

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
      <h3>{species.name}</h3>
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
                <a href={`/location/${o.location.id}`}>{formatLocationName(o.location.name)}</a>
              </td>
              <td>{o.seenAt.toISOString().split("T")[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <script src="/js/map.js"></script>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }}></script>
    </>
  );
};
