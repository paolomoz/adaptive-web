/**
 * AdaptiveWeb API - Cloudflare Workers
 * Main router for all API endpoints
 */

import { generatePage } from './generate-page.js';
import { generatePageStream } from './generate-page-stream.js';
import { generateImages } from './generate-images.js';
import { getPage } from './get-page.js';
import { getHistory } from './get-history.js';
import { reindexVectors } from './reindex-vectors.js';
import { generateEmbeddings } from './lib/embeddings.js';
import { searchImages, batchIndexImages } from './lib/image-search.js';
import { retrieveContext } from './lib/rag.js';
import { createClient as createCloudflareClient } from './lib/cloudflare-db.js';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handle OPTIONS preflight requests
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * Create error response
 */
function errorResponse(message, status = 500) {
  return jsonResponse({ error: true, message }, status);
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route requests
      switch (path) {
        case '/api/generate-page': {
          if (request.method !== 'POST') {
            return errorResponse('Method not allowed', 405);
          }
          const body = await request.json();
          const result = await generatePage(body, env, ctx);
          return jsonResponse(result);
        }

        case '/api/generate-page-stream': {
          // SSE streaming endpoint for real-time progress updates
          if (request.method !== 'POST') {
            return errorResponse('Method not allowed', 405);
          }
          const body = await request.json();
          return generatePageStream(body, env, ctx);
        }

        case '/api/generate-images': {
          if (request.method !== 'POST') {
            return errorResponse('Method not allowed', 405);
          }
          const body = await request.json();
          const result = await generateImages(body, env);
          return jsonResponse(result);
        }

        case '/api/get-page': {
          if (request.method !== 'GET') {
            return errorResponse('Method not allowed', 405);
          }
          const pageId = url.searchParams.get('id');
          if (!pageId) {
            return errorResponse('Missing page ID', 400);
          }
          const result = await getPage(pageId, env);
          if (!result) {
            return errorResponse('Page not found', 404);
          }
          return jsonResponse(result);
        }

        case '/api/get-history': {
          if (request.method !== 'GET') {
            return errorResponse('Method not allowed', 405);
          }
          const sessionId = url.searchParams.get('session_id');
          const limit = parseInt(url.searchParams.get('limit') || '20', 10);
          if (!sessionId) {
            return errorResponse('Missing session ID', 400);
          }
          const result = await getHistory(sessionId, limit, env);
          return jsonResponse(result);
        }

        case '/health': {
          return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
        }

        case '/api/reindex-vectors': {
          if (request.method !== 'POST') {
            return errorResponse('Method not allowed', 405);
          }
          const result = await reindexVectors(env);
          return jsonResponse(result);
        }

        case '/api/embed': {
          // Embedding endpoint for crawler
          if (request.method !== 'POST') {
            return errorResponse('Method not allowed', 405);
          }
          const body = await request.json();
          const { texts } = body;
          if (!texts || !Array.isArray(texts)) {
            return errorResponse('Missing texts array', 400);
          }
          const embeddings = await generateEmbeddings(texts, env.AI);
          return jsonResponse({ embeddings });
        }

        case '/api/upsert-vectors': {
          // Vectorize upsert endpoint for crawler
          if (request.method !== 'POST') {
            return errorResponse('Method not allowed', 405);
          }
          const body = await request.json();
          const { vectors } = body;
          if (!vectors || !Array.isArray(vectors)) {
            return errorResponse('Missing vectors array', 400);
          }
          // Upsert to Vectorize
          await env.VECTORIZE.upsert(vectors);
          return jsonResponse({ success: true, count: vectors.length });
        }

        case '/api/search-images': {
          // Semantic image search endpoint
          if (request.method !== 'GET') {
            return errorResponse('Method not allowed', 405);
          }
          const query = url.searchParams.get('q');
          if (!query) {
            return errorResponse('Missing query parameter', 400);
          }
          const limit = parseInt(url.searchParams.get('limit') || '5', 10);
          const imageType = url.searchParams.get('type') || null;
          const images = await searchImages(query, env, { limit, imageType });
          return jsonResponse({ query, images });
        }

        case '/api/suggestions': {
          // Get search suggestions from crawled content
          if (request.method !== 'GET') {
            return errorResponse('Method not allowed', 405);
          }
          const query = url.searchParams.get('q') || '';
          const limit = parseInt(url.searchParams.get('limit') || '10', 10);

          try {
            let suggestions = [];

            if (query.length >= 2) {
              // Search for matching titles
              const stmt = env.DB.prepare(`
                SELECT DISTINCT title, content_type
                FROM vitamix_sources
                WHERE title LIKE ? COLLATE NOCASE
                ORDER BY title
                LIMIT ?
              `);
              const result = await stmt.bind(`%${query}%`, limit).all();
              suggestions = (result.results || []).map(r => ({
                text: r.title,
                type: r.content_type,
              }));
            } else {
              // Return popular/featured suggestions
              const stmt = env.DB.prepare(`
                SELECT title, content_type, COUNT(*) as chunk_count
                FROM vitamix_sources vs
                JOIN vitamix_chunks vc ON vs.id = vc.source_id
                GROUP BY vs.id
                ORDER BY chunk_count DESC
                LIMIT ?
              `);
              const result = await stmt.bind(limit).all();
              suggestions = (result.results || []).map(r => ({
                text: r.title,
                type: r.content_type,
              }));
            }

            // Add some curated suggestions if we have few results
            const curatedSuggestions = [
              { text: 'smoothie recipes', type: 'recipe' },
              { text: 'Vitamix A3500', type: 'product' },
              { text: 'hot soup in blender', type: 'recipe' },
              { text: 'compare Vitamix models', type: 'comparison' },
              { text: 'green smoothie', type: 'recipe' },
              { text: 'cleaning Vitamix', type: 'support' },
            ];

            if (suggestions.length < 3 && !query) {
              suggestions = curatedSuggestions.slice(0, limit);
            }

            return jsonResponse({ query, suggestions });
          } catch (dbError) {
            console.error('Suggestions DB error:', dbError);
            // Return curated suggestions on error
            return jsonResponse({
              query,
              suggestions: [
                { text: 'smoothie recipes', type: 'recipe' },
                { text: 'Vitamix A3500', type: 'product' },
                { text: 'hot soup recipes', type: 'recipe' },
              ],
            });
          }
        }

        case '/api/test-rag': {
          // Test RAG with caching
          if (request.method !== 'GET') {
            return errorResponse('Method not allowed', 405);
          }
          const query = url.searchParams.get('q');
          if (!query) {
            return errorResponse('Query parameter "q" is required', 400);
          }

          const supabase = createCloudflareClient(env);
          const startTime = Date.now();
          const result = await retrieveContext(query, env.AI, supabase, {}, env);
          const duration = Date.now() - startTime;

          return jsonResponse({
            query,
            cached: result.cached,
            duration_ms: duration,
            classification: result.classification,
            sources_found: result.sourceIds.length,
            context_length: result.context.length,
          });
        }

        case '/api/index-images': {
          // Index images from D1 into Vectorize
          if (request.method !== 'POST') {
            return errorResponse('Method not allowed', 405);
          }
          const body = await request.json();
          const { limit = 100, offset = 0 } = body;

          // Fetch images from D1
          const stmt = env.DB.prepare(`
            SELECT vi.id, vi.r2_url, vi.alt_text, vi.image_type, vi.context, vi.source_id,
                   vs.title as source_title
            FROM vitamix_images vi
            LEFT JOIN vitamix_sources vs ON vi.source_id = vs.id
            WHERE vi.r2_url IS NOT NULL AND vi.r2_url != ''
            LIMIT ? OFFSET ?
          `);
          const result = await stmt.bind(limit, offset).all();
          const images = result.results || [];

          if (images.length === 0) {
            return jsonResponse({ indexed: 0, message: 'No images to index' });
          }

          // Index into Vectorize
          const indexed = await batchIndexImages(images, env);
          return jsonResponse({ indexed, total: images.length, offset });
        }

        default:
          return errorResponse('Not found', 404);
      }
    } catch (error) {
      console.error('API Error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  },
};
