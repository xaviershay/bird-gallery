export default function photoUrl(fileName: string, opts : {thumbnail: boolean} = {thumbnail: true}) {
  // TODO: Use public URL in production
  return `https://pub-d3c0b0e6227e4c07b89da4dca3c164ef.r2.dev/${opts.thumbnail ? "thumbnails" : "photos"}/${fileName}`;
}
