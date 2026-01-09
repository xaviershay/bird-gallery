/**
 * Species Sightings View
 * 
 * Displays all recent observations of a specific bird within a distance from a location.
 * Uses client-side JavaScript to fetch eBird API data and render results on map and table.
 */

interface SpeciesSightingsViewProps {
  locationId: string;
  speciesId: string;
  distance: number;
}

export const SpeciesSightingsView = ({ locationId, speciesId, distance }: SpeciesSightingsViewProps) => {
  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-map-location-dot"></i> Recent Sightings
        </h2>
        <p id="report-description">
          Loading sightings...
        </p>
        
        <div className="controls">
          <div className="control-group">
            <label htmlFor="location-input">Location ID:</label>
            <input type="text" id="location-input" defaultValue={locationId} placeholder="e.g. 123456 or L123456" />
          </div>
          
          <div className="control-group">
            <label htmlFor="species-input">Species Code:</label>
            <input type="text" id="species-input" defaultValue={speciesId} placeholder="e.g. railor5" />
          </div>
          
          <div className="control-group">
            <label htmlFor="distance-input">Distance (km):</label>
            <input type="number" id="distance-input" defaultValue={distance} min="1" max="500" />
          </div>
          
          <button id="refresh-button" className="primary">
            <i className="fa-solid fa-magnifying-glass"></i> Search
          </button>
        </div>
        
        <div id="status" className="status">Loading...</div>
        
        <div id="map" style={{ height: '400px', marginBottom: '2em' }}></div>
        
        <table className="bird-list">
          <thead>
            <tr>
              <th>Location</th>
              <th className="date">Date & Time</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody id="results-tbody">
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', color: '#666' }}>
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
          align-items: flex-end;
        }
        
        .control-group {
          display: flex;
          flex-direction: column;
          gap: 0.25em;
        }
        
        .control-group label {
          font-weight: bold;
          margin: 0;
          font-size: 0.9em;
        }
        
        .control-group input {
          padding: 0.5em;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 0.9em;
        }
        
        button.primary {
          background: #1976d2;
          color: white;
          border: none;
          padding: 0.5em 1em;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }
        
        button.primary:hover {
          background: #1565c0;
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
        
        #map {
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .sightings-list {
          width: 100%;
          border-collapse: collapse;
        }
        
        .sightings-list th {
          background: #f5f5f5;
          padding: 0.75em;
          text-align: left;
          border-bottom: 2px solid #ddd;
        }
        
        .sightings-list th.date {
          width: 200px;
        }
        
        .sightings-list td {
          padding: 0.75em;
          border-bottom: 1px solid #eee;
        }
        
        .sightings-list tr:hover {
          background: #f9f9f9;
        }
        
        .sightings-list a {
          color: #1976d2;
          text-decoration: none;
        }
        
        .sightings-list a:hover {
          text-decoration: underline;
        }
        
        #report-description {
          color: #666;
        }
      `}} />
      
      {/* Load client-side scripts */}
      <script src="/js/ebird-service.js"></script>
      <script src="/js/species-sightings.js"></script>
      
      {/* Pass parameters to client-side script */}
      <script dangerouslySetInnerHTML={{ __html: `
        window.SIGHTINGS_CONFIG = {
          locationId: "${locationId}",
          speciesId: "${speciesId}",
          distance: ${distance}
        };
      `}} />
    </>
  );
};
