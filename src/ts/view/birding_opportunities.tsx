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
  
  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-binoculars"></i> Opportunities
        </h2>
        <p>
          Interesting birds seen recently (last 7 days) in <strong id="location-display">{displayLocation}</strong>.
        </p>
        
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
        </div>
        
      </section>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .tag-legend {
          display: flex;
          flex-direction: column;
          gap: 0.4em;
          padding: 1em;
          background: #f8f9fa;
          border-radius: 4px;
          margin: 1em 0;
          font-size: 0.9em;
          color: #666;
        }
        
        .tag-filter {
          cursor: pointer;
          user-select: none;
          padding: 0.2em 0.4em;
          border-radius: 4px;
          transition: opacity 0.2s;
        }
        
        .tag-filter:hover {
          background: #e9ecef;
        }
        
        .tag-filter:not(.active) {
          opacity: 0.4;
          text-decoration: line-through;
        }
        
        .tag {
          display: inline-block;
          padding: 0.2em 0.5em;
          border-radius: 3px;
          font-size: 0.85em;
          font-weight: 500;
          margin-right: 0.3em;
        }
        
        .tag-icon {
          padding: 0.1em 0.3em;
          margin-left: 0.3em;
          cursor: help;
        }
        
        .tag-lifer {
          background: #fff3cd;
          color: #856404;
        }
        
        .tag-photo-lifer {
          background: #d4edda;
          color: #155724;
        }
        
        .tag-year-lifer {
          background: #cce5ff;
          color: #004085;
        }
        
        .tag-location-lifer {
          background: #e2d5f1;
          color: #5a3d7a;
        }
        
        .species-tags {
          margin-top: 0.3em;
        }
        
        .controls {
          display: flex;
          gap: 1em;
          margin: 1em 0;
          flex-wrap: wrap;
        }
        
        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5em;
        }
        
        .control-group label {
          font-weight: bold;
          margin: 0;
        }
        
        .status {
          padding: 1em;
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          margin: 1em 0;
          border-radius: 4px;
        }
        
        .status.error {
          background: #ffebee;
          border-left-color: #f44336;
        }
        
        .info {
          padding: 0.75em;
          background: #f5f5f5;
          border-radius: 4px;
          margin: 0.5em 0 1em 0;
          font-size: 0.9em;
          color: #666;
        }
        
        #map {
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        button.secondary {
          background: #6c757d;
          color: white;
          border: none;
          padding: 0.5em 1em;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }
        
        button.secondary:hover {
          background: #5a6268;
        }
      `}} />
      
      {/* Load client-side scripts */}
      <script src="/js/ebird-service.js"></script>
      <script src="/js/birding-opportunities.js"></script>
    </>
  );
};
