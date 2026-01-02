import { TripReport, TripReportStats } from "../types";
import { TripReportItem } from "./components/trip_report_item";

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
          <i className="fa-solid fa-compass"></i> Trip Reports
        </h2>
        {tripReports.length === 0 ? (
          <p>No trip reports yet.</p>
        ) : (
          <div className="trip-report-list">
            {tripReports.map(({ tripReport, stats }) => (
              <TripReportItem key={tripReport.id} tripReport={tripReport} stats={stats} />
            ))}
          </div>
        )}
        <p />
      </section>
    </>
  );
};
