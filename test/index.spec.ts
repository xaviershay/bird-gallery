import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from '../src/sql/schema.sql?raw'; // Import SQL as raw string

describe('', () => {
	beforeAll(async () => {
		const statements = schemaSql
			.split(';')
			.map(sql => sql.trim())
			.filter(sql => sql.length > 0)
			.map(sql => env.DB.prepare(sql));

		// Execute the statements in a batch
		await env.DB.batch(statements);
	})

	it('renders a home page', async () => {
		const response = await SELF.fetch('https://localhost/');
		expect(await response.text()).toContain("Bird Lists");
	});
});