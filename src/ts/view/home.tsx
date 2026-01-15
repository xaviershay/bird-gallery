import { Observation, Photo, TripReport, TripReportStats } from "../types";
import { ThumbnailStrip } from "./thumbnail_strip";
import { FirstsTable } from "./components/firsts_table";
import { TripReportItem } from "./components/trip_report_item";

interface HomeViewProps {
  photos: Photo[];
  ticks: Observation[];
  ticksTotal: number;
  recentTrips: Array<{ tripReport: TripReport; stats: TripReportStats }>;
}

export const HomeView = (props: HomeViewProps) => {
  const { photos, ticks, ticksTotal, recentTrips } = props;

  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-camera-retro"></i> Photos
        </h2>
        <ThumbnailStrip photos={photos} />
      </section>
      <section>
        <h2>
          <i className="fa-solid fa-binoculars"></i> Ticks
        </h2>
        {ticks.length === 0 ? (
          <p>No life list birds yet.</p>
        ) : (
          <FirstsTable
            observations={ticks}
            showComment={true}
            totalCount={ticksTotal}
            firstDateLabel="First Seen"
          />
        )}
        <p className='more-link'>
          <a href="/firsts">Full Life List</a>
        </p>
      </section>
      <section>
        <h2>
          <i className="fa-solid fa-compass"></i> Trips
        </h2>
        {recentTrips.length === 0 ? (
          <p>No trip reports yet.</p>
        ) : (
          <div className="trip-report-list">
            {recentTrips.map(({ tripReport, stats }) => (
              <TripReportItem key={tripReport.id} tripReport={tripReport} stats={stats} />
            ))}
          </div>
        )}
        <p className='more-link'>
          <a href="/trip-report">All Trip Reports</a>
        </p>
      </section>
      <section>
        <h2>
          <i className="fa-solid fa-link"></i> Links
        </h2>
        <p>Many of these reports require you to have an <a href="https://ebird.org/api/keygen">eBird API Key.</a></p>
        <ul>
          <li>
            <a href="/report/nophotos">Missing Photos Report</a>
          </li>
          <li>
            <a href="/report/locations">Locations Report</a>
          </li>
          <li>
            <a href="/report/opportunities">Melbourne Opportunities Report</a>
          </li>
          <li>
            <a href="/report/sightings?location=919153">Recent Sightings Report</a>
          </li>
          <li>
            <a href="/report/technical">Technical Details</a>
          </li>
          <li>
            <a href="https://blog.xaviershay.com" rel="me">My blog</a>
          </li>
          <li>
            <a href="https://ebird.org/profile/NjY3NjU0MQ/world" rel="me">
              eBird Profile
            </a>
          </li>
          <li>
            <a href="https://github.com/xaviershay/bird-gallery">
              Github source code
            </a>
          </li>
        </ul>
      </section>
    </>
  );
};
