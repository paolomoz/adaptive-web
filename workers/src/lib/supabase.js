/**
 * Supabase Server Client
 * Server-side database operations for Cloudflare Workers
 */

/**
 * Create Supabase REST API client
 * @param {object} env - Worker environment
 * @returns {object} Client methods
 */
export function createClient(env) {
  const baseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;

  if (!baseUrl || !serviceKey) {
    throw new Error('Missing Supabase configuration');
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  /**
   * Make request to Supabase REST API
   */
  async function request(path, options = {}) {
    const url = `${baseUrl}/rest/v1${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase error: ${response.status} - ${error}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    /**
     * Insert a new generated page
     */
    async insertPage(pageData) {
      const result = await request('/generated_pages', {
        method: 'POST',
        body: JSON.stringify(pageData),
      });
      return result[0];
    },

    /**
     * Update a page (e.g., with image URLs)
     */
    async updatePage(pageId, updates) {
      const result = await request(`/generated_pages?id=eq.${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return result[0];
    },

    /**
     * Get a page by ID
     */
    async getPage(pageId) {
      const result = await request(`/generated_pages?id=eq.${pageId}`);
      return result[0] || null;
    },

    /**
     * Add search history entry
     */
    async addHistory(sessionId, query, pageId) {
      await request('/search_history', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          query,
          page_id: pageId,
        }),
      });
    },

    /**
     * Get search history for session
     */
    async getHistory(sessionId, limit = 20) {
      const result = await request(
        `/search_history?session_id=eq.${sessionId}&order=created_at.desc&limit=${limit}&select=id,query,page_id,created_at`,
      );
      return result || [];
    },

    /**
     * Get suggested topics
     */
    async getSuggestedTopics() {
      const result = await request(
        '/suggested_topics?active=eq.true&order=display_order.asc',
      );
      return result || [];
    },
  };
}
