import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import schemaSql from '../src/sql/schema.sql?raw'; // Import SQL as raw string

async function execSql(sql: string) {
  const statements = sql
    .split(';')
    .map(sql => sql.trim())
    .filter(sql => sql.length > 0)
    .map(sql => env.DB.prepare(sql));

  // Execute the statements in a batch
  await env.DB.batch(statements);
}

describe('', () => {
  beforeAll(async () => {
    await execSql(schemaSql);
  })

  describe('/', () => {
    it('renders', async () => {
      const response = await SELF.fetch('https://localhost/');
      expect(await response.text()).toContain("Bird Lists");
    });

    it('handles HEAD requests', async () => {
      const request = new Request('http://example.com', {
        method: 'HEAD'
      });

      const response = await SELF.fetch(request.url, request);
      expect(response.status).toBe(200);
    });

    it('handles OPTIONS requests', async () => {
      const request = new Request('http://example.com', {
        method: 'OPTIONS'
      });

      const response = await SELF.fetch(request.url, request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toEqual('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toEqual('GET, HEAD, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toEqual('Content-Type')
    });

    it('rejects POST, PUT, and DELETE requests', async () => {
      const methods = ['POST', 'PUT', 'DELETE'];
      for (const method of methods) {
        const request = new Request('http://example.com', {
          method: method
        });

        const response = await SELF.fetch(request.url, request);
        expect(response.status).toBe(405);
      }
    })

  })

  describe('/location/1', () => {
    beforeEach(async () => {
      await execSql(`
				INSERT INTO location (id, name, lat, lng, state, county) VALUES
				    (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne');
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor6', 'Old Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null);
				INSERT INTO observation VALUES
				    ('219171570-railor6', 219171569, 'railor6', 2552179, 2, '2024-03-18T17:11:00', null);
			`,)
    })

    it('renders', async () => {
      const response = await SELF.fetch('https://localhost/location/2552179');
      const content = await response.text();
      expect(content).toContain("Royal Park");
      expect(content).toContain("Rainbow Lorikeet");
      expect(content).toContain("Old Lorikeet");
    });

    it('renders for a specific year', async () => {
      const response = await SELF.fetch('https://localhost/location/2552179?period=2025');
      const content = await response.text();
      expect(content).toContain("Rainbow Lorikeet");
      expect(content).not.toContain("Old Lorikeet");
    });
  })

  describe('/firsts', () => {
    beforeEach(async () => {
      await execSql(`
				INSERT INTO location (id, name, lat, lng, state, county) VALUES
				    (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne');
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null);
				INSERT INTO photo VALUES
					('dscn5570.jpg', '219171569-railor5', '2025-05-03T01:53:50.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '');
			`,)
    })
    it('renders seen', async () => {
      const response = await SELF.fetch('https://localhost/firsts');
      const content = await response.text();
      expect(content).toContain("Firsts");
      expect(content).not.toContain("thumbnails");
    });
    it('renders photos', async () => {
      const response = await SELF.fetch('https://localhost/firsts?type=photo');
      const content = await response.text();
      expect(content).toContain("Firsts");
      expect(content).toContain("thumbnails");
    });
  });

  describe('/species', () => {
    beforeEach(async () => {
      await execSql(`
				INSERT INTO location (id, name, lat, lng, state, county) VALUES
				    (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne');
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null);
			`,)
    })
    it('renders species data', async () => {
      const response = await SELF.fetch('https://localhost/species/railor5');
      const content = await response.text();
      expect(content).toContain("Rainbow Lorikeet</h2>");
    });
  });

  describe('/photo', () => {
    beforeEach(async () => {
      await execSql(`
				INSERT INTO location (id, name, lat, lng, state, county) VALUES
				    (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne');
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null);
				INSERT INTO photo VALUES
					('dscn5570.jpg', '219171569-railor5', '2025-05-03T01:53:50.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '');
			`,)
    })

    it('renders photo data', async () => {
      const response = await SELF.fetch('https://localhost/photo/dscn5570');
      const content = await response.text();
      expect(content).toContain("Rainbow Lorikeet");
      expect(content).toContain("dscn5570");
      expect(content).toContain("Royal Park"); // Includes where photo was taken
    });
  });

  describe('/report/nophotos', () => {
    beforeEach(async () => {
      await execSql(`
				INSERT INTO location (id, name, lat, lng, state, county) VALUES
				    (2552179, 'Royal Park', -37.7892413, 144.9508023, 'AU-VIC', 'Melbourne');
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor5', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO species (id, common_name, scientific_name, taxonomic_order, common_name_codes, family_id) VALUES
					('railor6', 'Old Lorikeet', 'Trichoglossus moluccanus', 12562, 'RALO', 'psitta4');
				INSERT INTO observation VALUES
				    ('219171569-railor5', 219171569, 'railor5', 2552179, 2, '2025-03-18T17:11:00', null);
				INSERT INTO observation VALUES
				    ('219171570-railor6', 219171569, 'railor6', 2552179, 2, '2024-03-18T17:11:00', null);
				INSERT INTO photo VALUES
					('dscn5570.jpg', '219171569-railor5', '2025-05-03T01:53:50.000Z', 3, 2991, 2136, 0.004, 5, 220, 600, '');
			`,)
    })

    it('shows only birds missing photos', async () => {
      const response = await SELF.fetch('https://localhost/report/nophotos');
      const content = await response.text();
      expect(content).not.toContain("Rainbow Lorikeet");
      expect(content).toContain("Old Lorikeet");
    });

    it('shows only birds missing photos in a region', async () => {
      {
        const response = await SELF.fetch('https://localhost/report/nophotos?region=us');
        const content = await response.text();
        expect(content).not.toContain("Rainbow Lorikeet");
        expect(content).not.toContain("Old Lorikeet");
      }

      {
        const response = await SELF.fetch('https://localhost/report/nophotos?region=au-vic');
        const content = await response.text();
        expect(content).not.toContain("Rainbow Lorikeet");
        expect(content).toContain("Old Lorikeet");
      }
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      // Set version in metadata table
      await execSql(`
				INSERT INTO metadata (id, value) VALUES ('version', '1.0.0');
			`);
    });

    it('adds version header to responses', async () => {
      const response = await SELF.fetch('https://localhost/');
      expect(response.headers.get('X-Version')).toEqual('1.0.0');
    });

    it('returns same content for GET and HEAD requests', async () => {
      // Make GET request
      const getResponse = await SELF.fetch('https://localhost/');
      const getStatus = getResponse.status;
      const getHeaders = Object.fromEntries(getResponse.headers.entries());

      const headRequest = new Request('https://localhost/', { method: 'HEAD' });
      const headResponse = await SELF.fetch(headRequest.url, headRequest);
      const headStatus = headResponse.status;
      const headHeaders = Object.fromEntries(headResponse.headers.entries());

      expect(headStatus).toEqual(getStatus);
      expect(headHeaders['x-version']).toEqual(getHeaders['x-version']);
    });

    it('does not expose Cache-Control headers to clients', async () => {
      const response = await SELF.fetch('https://localhost/');
      expect(response.headers.get('Cache-Control')).toBeNull();
    });

    it('sets Cf-Cache-Status header', async () => {
      const response = await SELF.fetch('https://localhost/');
      expect(response.headers.get('Cf-Cache-Status')).toBe('MISS');
    });
  });
});