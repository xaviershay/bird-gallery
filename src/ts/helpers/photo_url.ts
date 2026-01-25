import { getPhotoUrl } from "../config/environment";

export default function photoUrl(fileName: string, opts : {thumbnail: boolean} = {thumbnail: true}) {
  return getPhotoUrl(fileName, opts.thumbnail ? 'thumbnail' : 'full');
}
