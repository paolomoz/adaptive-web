/**
 * AdaptiveWeb API - Cloudflare Workers
 * Main router for all API endpoints
 */

import { generatePage } from './generate-page.js';
import { generateImages } from './generate-images.js';
import { getPage } from './get-page.js';
import { getHistory } from './get-history.js';

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

        default:
          return errorResponse('Not found', 404);
      }
    } catch (error) {
      console.error('API Error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  },
};
