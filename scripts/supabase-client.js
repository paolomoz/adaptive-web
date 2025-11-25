/**
 * Supabase Client for AdaptiveWeb
 * Handles database connections and realtime subscriptions
 */

// Configuration - Replace with your Supabase project details
const SUPABASE_URL = 'https://jdclzklyiosyfyzoxeho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkY2x6a2x5aW9zeWZ5em94ZWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzAwNjEsImV4cCI6MjA3OTY0NjA2MX0._NgpQjUPuAMbPlxlsWz3lKcGneihSyZitXAJ0PClYa0';

let supabaseClient = null;
let realtimeChannel = null;

/**
 * Get or create session ID for the current user
 * @returns {string} UUID session ID
 */
export function getSessionId() {
  let sessionId = localStorage.getItem('adaptive-web-session');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('adaptive-web-session', sessionId);
  }
  return sessionId;
}

/**
 * Initialize Supabase client (lazy loading)
 * @returns {Promise<object>} Supabase client instance
 */
async function getClient() {
  if (supabaseClient) return supabaseClient;

  // Dynamically load Supabase from CDN
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // eslint-disable-next-line no-undef
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

/**
 * Fetch a generated page by ID
 * @param {string} pageId - UUID of the page
 * @returns {Promise<object|null>} Page data or null
 */
export async function getPage(pageId) {
  const client = await getClient();
  const { data, error } = await client
    .from('generated_pages')
    .select('*')
    .eq('id', pageId)
    .single();

  if (error) {
    console.error('Error fetching page:', error);
    return null;
  }
  return data;
}

/**
 * Get search history for current session
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of history items
 */
export async function getHistory(limit = 20) {
  const client = await getClient();
  const sessionId = getSessionId();

  const { data, error } = await client
    .from('search_history')
    .select(`
      id,
      query,
      page_id,
      created_at,
      generated_pages (
        id,
        hero
      )
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }
  return data || [];
}

/**
 * Add entry to search history
 * @param {string} query - Search query
 * @param {string} pageId - Generated page ID
 */
export async function addToHistory(query, pageId) {
  const client = await getClient();
  const sessionId = getSessionId();

  const { error } = await client
    .from('search_history')
    .insert({
      session_id: sessionId,
      query,
      page_id: pageId,
    });

  if (error) {
    console.error('Error adding to history:', error);
  }
}

/**
 * Clear search history for current session
 */
export async function clearHistory() {
  const client = await getClient();
  const sessionId = getSessionId();

  const { error } = await client
    .from('search_history')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error clearing history:', error);
  }
}

/**
 * Get suggested topics for homepage
 * @returns {Promise<Array>} Array of topic objects
 */
export async function getSuggestedTopics() {
  const client = await getClient();

  const { data, error } = await client
    .from('suggested_topics')
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching topics:', error);
    return [];
  }
  return data || [];
}

/**
 * Subscribe to realtime updates for a page (for image loading)
 * @param {string} pageId - UUID of the page to watch
 * @param {function} callback - Function to call when page updates
 * @returns {function} Unsubscribe function
 */
export async function subscribeToPage(pageId, callback) {
  const client = await getClient();

  // Clean up existing subscription
  if (realtimeChannel) {
    await client.removeChannel(realtimeChannel);
  }

  realtimeChannel = client
    .channel(`page-${pageId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'generated_pages',
        filter: `id=eq.${pageId}`,
      },
      (payload) => {
        callback(payload.new);
      },
    )
    .subscribe();

  return () => {
    if (realtimeChannel) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

/**
 * Unsubscribe from all realtime channels
 */
export async function unsubscribeAll() {
  if (realtimeChannel) {
    const client = await getClient();
    await client.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
