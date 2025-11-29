/**
 * Get Page API Endpoint
 * Retrieves an existing generated page
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
 * Get page handler
 * @param {string} pageId - UUID of the page
 * @param {object} env - Worker environment
 */
export async function getPage(pageId, env) {
  const client = getDbClient(env);
  const page = await client.getPage(pageId);
  return page;
}
