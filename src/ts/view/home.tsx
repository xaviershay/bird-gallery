import { Photo } from "../types";
import { ThumbnailStrip } from "./thumbnail_strip";

interface HomeViewProps {
  photos: Photo[]
}

export const HomeView = (props: HomeViewProps) => {
  const { photos } = props;

  return (
    <>
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
          <i className="fa-solid fa-link"></i> Links
        </h2>
        <ul>
          <li>
            <a href="/firsts">Life List</a>
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
