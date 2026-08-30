/**
 * Birding Opportunities View
 * 
 * Displays birds recently seen in a region/location that match lifer criteria.
 * Uses client-side JavaScript to fetch eBird API data and render results.
 */

interface BirdingOpportunitiesViewProps {
  region: string;      // eBird region code (e.g., "AU-VIC-MEL")
  location: string | null;  // eBird hotspot ID (e.g., "L919153") - takes precedence over region
}

export const BirdingOpportunitiesView = ({ region, location }: BirdingOpportunitiesViewProps) => {
  const displayLocation = location || region;
  const preposition = location ? 'at' : 'in';
  
  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-binoculars"></i> Opportunities
        </h2>
        <p>
          Interesting birds seen recently (last 7 days) {preposition} <strong id="location-display">{displayLocation}</strong>.
        </p>

        <div className="controls">
          <div className="control-group">
            <label htmlFor="location-input">Location ID:</label>
            <input type="text" id="location-input" defaultValue={location || ''} placeholder="e.g. 919153 or L919153" />
          </div>

          <button id="location-search-button" className="primary">
            <i className="fa-solid fa-magnifying-glass"></i> Search
          </button>
        </div>

        <div className="tag-legend" id="tag-legend">
          <div className="tag-filter active" data-tag="lifer"><span className="tag tag-lifer">🏆</span> Never seen</div>
          <div className="tag-filter active" data-tag="photo-lifer"><span className="tag tag-photo-lifer">📸</span> Not photographed</div>
          <div className="tag-filter active" data-tag="year-lifer"><span className="tag tag-year-lifer">🎉</span> Not seen this year</div>
          <div className="tag-filter active" data-tag="location-lifer"><span className="tag tag-location-lifer">📍</span> Not seen at this location</div>
        </div>
        
        <div id="map" style={{ height: '300px', marginBottom: '2em' }}></div>
        
        <table className="opportunities-list">
          <thead>
            <tr>
              <th>Species</th>
              <th className="date">Seen At</th>
            </tr>
          </thead>
          <tbody id="results-tbody">
            <tr>
              <td colSpan={2} style={{ textAlign: 'center', color: '#666' }}>
                Loading...
              </td>
            </tr>
          </tbody>
        </table>
        
        <div id="status" className="status">Loading...</div>

        <div className="controls">
          <div className="control-group">
            <button id="api-key-button" className="secondary">
              <i className="fa-solid fa-key"></i> Change eBird API Key
            </button>
          </div>
          <div className="control-group" id="share-button-container" style={{ display: 'none' }}>
            <button id="share-button" className="secondary">
              <i className="fa-solid fa-share"></i> Share Report
            </button>
          </div>
        </div>
        
      </section>
      
      {/* Load client-side scripts */}
      <script src="/js/ebird-service.js"></script>
      <script src="/js/birding-opportunities.js"></script>
    </>
  );
};
