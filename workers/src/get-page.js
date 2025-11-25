/**
 * Get Page API Endpoint
 * Retrieves an existing generated page
 */

import { createClient } from './lib/supabase.js';

/**
 * Get page handler
 * @param {string} pageId - UUID of the page
 * @param {object} env - Worker environment
 */
export async function getPage(pageId, env) {
  const supabase = createClient(env);
  const page = await supabase.getPage(pageId);
  return page;
}
