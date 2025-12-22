import { TripReport, TripReportStats } from "../types";
import { formatDate } from "../helpers/format_date";

interface TripReportIndexViewProps {
  tripReports: Array<{
    tripReport: TripReport;
    stats: TripReportStats;
  }>;
}

export const TripReportIndexView = (props: TripReportIndexViewProps) => {
  const { tripReports } = props;

  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-plane-departure"></i> Trip Reports
        </h2>
        {tripReports.length === 0 ? (
          <p>No trip reports yet.</p>
        ) : (
          <div className="trip-report-list">
            {tripReports.map(({ tripReport, stats }) => (
              <div key={tripReport.id} className="trip-report-item">
                <h3>
                  <a href={`/trip-report/${tripReport.id}`}>{tripReport.title}</a>
                </h3>
                <p className="trip-dates">
                  {formatDate(tripReport.startDate)} - {formatDate(tripReport.endDate)}
                </p>
                <p className="trip-description">{tripReport.description.split('\n\n')[0]}</p>
                <div className="trip-stats">
                  <span><strong>{stats.totalSpecies}</strong> species</span>
                  {' • '}
                  <span><strong>{stats.totalChecklists}</strong> checklists</span>
                  {' • '}
                  <span><strong>{stats.totalLocations}</strong> locations</span>
                  {stats.firstsSeen > 0 && (
                    <>
                      {' • '}
                      <span><strong>{stats.firstsSeen}</strong> life firsts</span>
                    </>
                  )}
                  {stats.firstsPhotographed > 0 && (
                    <>
                      {' • '}
                      <span><strong>{stats.firstsPhotographed}</strong> first photos</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
};
