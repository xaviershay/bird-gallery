import { Observation, Species } from "../types";

export function speciesUrl(id: string, options: {format?: string} = {}) {
   let path = `/species/${id}`
   if (options.format) {
    path += "." + options.format
   }
   return path
}

export default function speciesLink(object: Observation | Species): React.ReactNode {
  if ('speciesId' in object) {
    return <a href={speciesUrl(object.speciesId)}>{object.name}</a>;
  }
  return <a href={speciesUrl(object.id)}>{object.name}</a>;
}
