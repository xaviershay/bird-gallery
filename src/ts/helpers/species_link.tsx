import { Observation } from "../types";

export function speciesUrl(id: string, options: {format?: string} = {}) {
   let path = `/species/${id}`
   if (options.format) {
    path += "." + options.format
   }
   return path
}

export default function speciesLink(observation: Observation): React.ReactNode {
  return <a href={speciesUrl(observation.speciesId)}>{observation.name}</a>;
}
