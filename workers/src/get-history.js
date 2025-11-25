/**
 * Get History API Endpoint
 * Retrieves search history for a session
 */

import { createClient } from './lib/supabase.js';

/**
 * Get history handler
 * @param {string} sessionId - UUID of the session
 * @param {number} limit - Maximum number of results
 * @param {object} env - Worker environment
 */
export async function getHistory(sessionId, limit, env) {
  const supabase = createClient(env);
  const history = await supabase.getHistory(sessionId, limit);
  return history;
}
