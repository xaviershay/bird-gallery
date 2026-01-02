import { Observation } from "../../types";
import speciesLink from "../../helpers/species_link";
import { formatDate } from "../../helpers/format_date";
import formatLocationName from "../../helpers/format_location_name";

interface FirstsTableProps {
  observations: Observation[];
  showComment: boolean;
  totalCount?: number;
  firstDateLabel: string;
}

export const FirstsTable = (props: FirstsTableProps) => {
  const { observations, showComment, totalCount = observations.length, firstDateLabel } = props;

  return (
    <table className="bird-list">
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th className="date">{firstDateLabel}</th>
          {showComment && <th>Comment</th>}
        </tr>
      </thead>
      <tbody>
        {observations.flatMap((o, index) => {
          const location = o.location;
          const rows = [];

          const prevLocation = index > 0 ? observations[index - 1].location : null;
          if (!prevLocation || prevLocation.id !== location.id) {
            rows.push(
              <tr key={`location-${location.id}-${index}`} className="group-row">
                <td colSpan={showComment ? 4 : 3}>
                  <a href={`/location/${location.id}`}>
                    {formatLocationName(location.name)}
                  </a>
                </td>
              </tr>
            );
          }

          rows.push(
            <tr key={o.id}>
              <td>{totalCount - index}</td>
              <td>{speciesLink(o)}</td>
              <td className="date">
                <a href={`https://ebird.org/checklist/S${o.checklistId}`}>
                  {formatDate(o.seenAt)}
                </a>
              </td>
              {showComment && <td>{o.comment}</td>}
            </tr>
          );

          return rows;
        })}
      </tbody>
    </table>
  );
};