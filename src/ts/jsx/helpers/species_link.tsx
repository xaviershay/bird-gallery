import { Observation } from "../../types";

export default function speciesLink(observation: Observation): React.ReactNode {
  return <a href={`/species/${observation.speciesId}`}>{observation.name}</a>;
}
