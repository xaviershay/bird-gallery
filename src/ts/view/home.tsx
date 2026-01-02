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
          <i className="fa-solid fa-binoculars"></i> Recent Ticks
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
          <i className="fa-solid fa-compass"></i> Recent Trips
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
          <i className="fa-solid fa-camera-retro"></i> Photos
        </h2>
        <ThumbnailStrip photos={photos} />
        <p>
          On 9<sup>th</sup> March 2025 I started shooting with a{" "} 
          <a href="https://www.nikonusa.com/p/coolpix-p950/26532/overview">
            Nikon P950
          </a> then switched to an <a href="https://explore.omsystem.com/au/en/om-1-mark-ii">OM-1</a>{" "}
          in November 2025.  I use <a href="https://www.digikam.org/">Digikam</a> for management
          and <a href="https://www.darktable.org/">Darktable</a> for processing.
        </p>

        <table className="photo-criteria">
          <tr>
            <th>Rating</th>
            <th>Criteria</th>
          </tr>
          <tr>
            <td>★</td>
            <td>Identifiable but obstructed, blurry, or poorly lit.</td>
          </tr>
          <tr>
            <td>★★</td>
            <td>Unobstructed and passable quality.</td>
          </tr>
          <tr>
            <td>★★★</td>
            <td>Clear, sharp and technically proficient.</td>
          </tr>
          <tr>
            <td>★★★★</td>
            <td>Interesting pose, framing, or setting.</td>
          </tr>
          <tr>
            <td>★★★★★</td>
            <td>Competition worthy.</td>
          </tr>
        </table>
      </section>
      <section>
        <h2>
          <i className="fa-solid fa-leaf"></i>
          {"  "}Rules
        </h2>
        <ul>
          <li>
            Distinctive features must be personally sighted. Others may help
            with identification.
          </li>
          <li>Only hearing a bird doesn't count.</li>
          <li>
            <a href="https://ebird.org">eBird</a> taxonomy is canon.
          </li>
        </ul>
      </section>
      <section>
        <h2>
          <i className="fa-solid fa-link"></i> Links
        </h2>
        <ul>
          <li>
            <a href="/firsts">Life List</a>
          </li>
          <li>
            <a href="/trip-report">Trip Reports</a>
          </li>
          <li>
            <a href="/report/nophotos">Missing Photos Report</a>
          </li>
          <li>
            <a href="/report/locations">Locations Report</a>
          </li>
          <li>
            <a href="/report/opportunities">Birding Opportunities Report</a>
          </li>
          <li>
            <a href="https://blog.xaviershay.com">My blog</a>
          </li>
          <li>
            <a href="https://ebird.org/profile/NjY3NjU0MQ/world">
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
