import { Species } from "../types";
import speciesLink from "../helpers/species_link";

interface MissingPhotosViewProps {
  species: Species[],
  region: string | null,
  county: string | null,
  stats: {
    regionCount: Record<string, number>
  }
}

export const MissingPhotosView = (props: MissingPhotosViewProps) => {
  const { region, county, stats, species } = props;

  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-camera-retro"></i>
          Birds Missing Photos
        </h2>
        <nav>
          <table>
            <tr>
              <th></th>
              <th>Melbourne</th>
              <th>Victoria, AU</th>
              <th>World</th>
            </tr>
            <tr>
              <th>Life</th>
              <td>
                <a className={county == 'melbourne' ? 'active' : ''} href={`/report/nophotos?county=melbourne`}>{stats.regionCount['melbourne']}</a>
              </td>
              <td>
                <a className={region == 'au-vic' ? 'active' : ''} href={`/report/nophotos?region=au-vic`}>{stats.regionCount['au-vic']}</a>
              </td>
              <td>
                <a className={region == null && county == null ? 'active' : ''} href={`/report/nophotos`}>{stats.regionCount['']}</a>
              </td>
            </tr>
          </table>
        </nav>
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {species.map((o, index) => (
              <tr key={o.id}>
                <td>{index + 1}</td>
                <td>{speciesLink(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}