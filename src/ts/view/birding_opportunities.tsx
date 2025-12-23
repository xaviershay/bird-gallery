/**
 * Birding Opportunities View
 * 
 * Displays birds recently seen in AU-VIC-MEL that you haven't photographed/seen yet.
 * Uses client-side JavaScript to fetch eBird API data and render results.
 */

interface BirdingOpportunitiesViewProps {
  excludeMode: 'photos' | 'all';
}

export const BirdingOpportunitiesView = ({ excludeMode }: BirdingOpportunitiesViewProps) => {
  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-binoculars"></i> Opportunities
        </h2>
        <p>
          Birds seen recently (last 7 days) in Melbourne (AU-VIC-MEL) that I haven't {excludeMode === 'photos' ? 'photographed (anywhere)' : 'seen in Melbourne'} yet.
        </p>
        
        <div className="controls">
          <div className="control-group">
            <label>Exclude:</label>
            <select id="exclude-mode">
              <option value="photos" selected={excludeMode === 'photos'}>Birds I've photographed (anywhere)</option>
              <option value="all" selected={excludeMode === 'all'}>Birds I've seen in Melbourne</option>
            </select>
          </div>
          
          <div className="control-group">
            <button id="api-key-button" className="secondary">
              <i className="fa-solid fa-key"></i> Change eBird API Key
            </button>
          </div>
        </div>
        
        <div id="status" className="status">Loading...</div>
        
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
      </section>
      
      <style dangerouslySetInnerHTML={{ __html: `
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
