export default function photoUrl(fileName: string, opts : {thumbnail: boolean} = {thumbnail: true}) {
  return `https://bird-gallery.xaviershay.com/${opts.thumbnail ? "thumbnails" : "photos"}/${fileName}`;
}
