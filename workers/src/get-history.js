/**
 * Get History API Endpoint
 * Retrieves search history for a session
 */

import { createClient as createSupabaseClient } from './lib/supabase.js';
import { createClient as createCloudflareClient } from './lib/cloudflare-db.js';

/**
 * Get the appropriate database client based on feature flag
 * @param {object} env - Worker environment
 * @returns {object} Database client (Supabase or Cloudflare D1)
 */
function getDbClient(env) {
  const useCloudflare = env.USE_CLOUDFLARE_DB === 'true';
  if (useCloudflare) {
    return createCloudflareClient(env);
  }
  return createSupabaseClient(env);
}

/**
 * Get history handler
 * @param {string} sessionId - UUID of the session
 * @param {number} limit - Maximum number of results
 * @param {object} env - Worker environment
 */
export async function getHistory(sessionId, limit, env) {
  const client = getDbClient(env);
  const history = await client.getHistory(sessionId, limit);
  return history;
}
