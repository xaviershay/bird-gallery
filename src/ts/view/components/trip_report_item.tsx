import { TripReport, TripReportStats } from "../../types";
import { formatDate } from "../../helpers/format_date";
import { parseMarkdownLinks } from "../../helpers/parse_markdown_links";

interface TripReportItemProps {
  tripReport: TripReport;
  stats: TripReportStats;
}

export const TripReportItem = ({ tripReport, stats }: TripReportItemProps) => {
  return (
    <div className="trip-report-item">
      <h3>
        <a href={`/trip-report/${tripReport.id}`}>{tripReport.title}</a>
      </h3>
      <p className="trip-dates">
        {formatDate(tripReport.startDate)} - {formatDate(tripReport.endDate)}
      </p>
      <p className="trip-description">{parseMarkdownLinks(tripReport.description.split("\n\n")[0])}</p>
      <div className="trip-stats">
        <span><strong>{stats.totalSpecies}</strong> species</span>
        {" • "}
        <span><strong>{stats.totalChecklists}</strong> checklists</span>
        {" • "}
        <span><strong>{stats.totalLocations}</strong> locations</span>
        {stats.firstsSeen > 0 && (
          <>
            {" • "}
            <span><strong>{stats.firstsSeen}</strong> lifers</span>
          </>
        )}
        {stats.firstsPhotographed > 0 && (
          <>
            {" • "}
            <span><strong>{stats.firstsPhotographed}</strong> photo firsts</span>
          </>
        )}
      </div>
    </div>
  );
};