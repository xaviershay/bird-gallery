import { Species, Observation } from "../types";

interface SpeciesViewProps {
  observations: Array<Observation>;
  species: Species;
}

export const SpeciesView = (data: SpeciesViewProps) => {
  const { observations, species } = data;
  const observationCount = observations.length;

  return (
    <>
    <h3>{species.name}</h3>

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
              <td><a href={`/location/${o.location.id}`}>{o.location.name}</a></td>
              <td>{o.seenAt.toISOString().split("T")[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}