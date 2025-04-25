import { Species, Observation } from "../types";
import { speciesUrl } from "./helpers/species_link";

interface SpeciesViewProps {
  observations: Array<Observation>;
  species: Species;
}

export const SpeciesView = (data: SpeciesViewProps) => {
  const { observations, species } = data;
  const observationCount = observations.length;
  const scriptContent = `
    initMap("${speciesUrl(species.id, { format: "json" })}");
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
                <a href={`/location/${o.location.id}`}>{o.location.name}</a>
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
