import { Item } from './types';
import Mustache from 'mustache';
import indexTemplate from '../../src/templates/list.html.mustache';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean);
    const method = request.method;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS requests for CORS
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Route handling
      if (path.length === 0) {

        const view = {
          title: "Joe",
          calc: () => ( 2 + 4 ),
          birds: [
            {number: 2, name: "Robin", oldest: '2025-04-22'},
            {number: 1, name: "Darter", oldest: '2025-04-21'},
          ]
        };

        //const template = "{{title}} spends {{calc}}"
        var template = indexTemplate;
        var output = Mustache.render(template, view);

        return new Response(output, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders,
          },
        });
      }

      if (path[0] === 'items') {
        if (path.length === 1) {
          // /items endpoint
          switch (method) {
            case 'GET':
              return fetchAllItems(env);
            case 'POST':
              return createItem(request, env);
            default:
              return respondWith(405, { error: 'Method not allowed' }, corsHeaders);
          }
        } else if (path.length === 2) {
          // /items/:id endpoint
          const itemId = path[1];
          switch (method) {
            case 'GET':
              return fetchItem(itemId, env);
            case 'PUT':
              return updateItem(itemId, request, env);
            case 'DELETE':
              return deleteItem(itemId, env);
            default:
              return respondWith(405, { error: 'Method not allowed' }, corsHeaders);
          }
        }
      }

      // If we get here, the route was not found
      return respondWith(404, { error: 'Not found' }, corsHeaders);

    } catch (error) {
      console.error('Error processing request:', error);
      return respondWith(
        500,
        { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
        corsHeaders
      );
    }
  },
};

// Helper function to create a JSON response
function respondWith(status: number, body: object, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

// Fetch all items from the database
async function fetchAllItems(env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM items').all<Item>();
    return respondWith(200, { items: results });
  } catch (error) {
    console.error('Database error:', error);
    return respondWith(500, { error: 'Database error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// Fetch a single item by ID
async function fetchItem(id: string, env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM items WHERE id = ?')
      .bind(id)
      .all<Item>();

    if (results.length === 0) {
      return respondWith(404, { error: 'Item not found' });
    }

    return respondWith(200, { item: results[0] });
  } catch (error) {
    console.error('Database error:', error);
    return respondWith(500, { error: 'Database error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// Create a new item
async function createItem(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json() as Partial<Item>;

    // Validate required fields
    if (!data.name) {
      return respondWith(400, { error: 'Name is required' });
    }

    // Insert into database
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      'INSERT INTO items (name, description, created_at) VALUES (?, ?, ?)'
    )
      .bind(data.name, data.description || '', now)
      .run();

    return respondWith(201, {
      message: 'Item created successfully',
      itemId: result.meta.last_row_id,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return respondWith(400, { error: 'Invalid JSON' });
    }
    console.error('Database error:', error);
    return respondWith(500, { error: 'Database error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// Update an existing item
async function updateItem(id: string, request: Request, env: Env): Promise<Response> {
  try {
    // First check if the item exists
    const { results } = await env.DB.prepare('SELECT * FROM items WHERE id = ?')
      .bind(id)
      .all<Item>();

    if (results.length === 0) {
      return respondWith(404, { error: 'Item not found' });
    }

    const existingItem = results[0];
    const data = await request.json() as Partial<Item>;

    // Update the item
    const now = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE items SET name = ?, description = ?, updated_at = ? WHERE id = ?'
    )
      .bind(
        data.name || existingItem.name,
        data.description !== undefined ? data.description : existingItem.description,
        now,
        id
      )
      .run();

    return respondWith(200, { message: 'Item updated successfully' });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return respondWith(400, { error: 'Invalid JSON' });
    }
    console.error('Database error:', error);
    return respondWith(500, { error: 'Database error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// Delete an item
async function deleteItem(id: string, env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare('DELETE FROM items WHERE id = ?')
      .bind(id)
      .run();

    if (result.meta.changes === 0) {
      return respondWith(404, { error: 'Item not found' });
    }

    return respondWith(200, { message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return respondWith(500, { error: 'Database error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}