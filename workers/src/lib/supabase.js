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
     * Only inserts columns that exist in the database schema
     */
    async insertPage(pageData) {
      // Remove undefined fields before inserting
      const cleanData = Object.fromEntries(
        Object.entries(pageData).filter(([_, v]) => v !== undefined),
      );

      const result = await request('/generated_pages', {
        method: 'POST',
        body: JSON.stringify(cleanData),
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
     * Find a cached page by query (for cache lookup)
     * @param {string} normalizedQuery - Lowercase trimmed query
     * @param {string} minCreatedAt - ISO date string for TTL cutoff
     */
    async findPageByQuery(normalizedQuery, minCreatedAt) {
      // Use ilike for case-insensitive match
      const encodedQuery = encodeURIComponent(normalizedQuery);
      const result = await request(
        `/generated_pages?query=ilike.${encodedQuery}&created_at=gte.${minCreatedAt}&order=created_at.desc&limit=1`,
      );
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

    /**
     * Search Vitamix content using vector similarity (RAG)
     * @param {number[]} embedding - Query embedding vector
     * @param {object} options - Search options
     * @returns {Promise<Array>} Matching content chunks
     */
    async searchVitamixContent(embedding, options = {}) {
      const { threshold = 0.7, limit = 5 } = options;

      const url = `${baseUrl}/rest/v1/rpc/search_vitamix_content`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query_embedding: embedding,
          match_threshold: threshold,
          match_count: limit,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Vector search error: ${response.status} - ${error}`);
      }

      return response.json();
    },

    /**
     * Insert a Vitamix source (for scraping)
     * @param {object} sourceData - Source data
     * @returns {Promise<object>} Inserted source
     */
    async insertSource(sourceData) {
      const result = await request('/vitamix_sources', {
        method: 'POST',
        body: JSON.stringify(sourceData),
        headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' },
      });
      return result[0];
    },

    /**
     * Insert content chunks with embeddings (for scraping)
     * @param {Array} chunks - Array of chunk objects with embeddings
     * @returns {Promise<Array>} Inserted chunks
     */
    async insertChunks(chunks) {
      const result = await request('/vitamix_chunks', {
        method: 'POST',
        body: JSON.stringify(chunks),
      });
      return result;
    },

    /**
     * Get source images by source IDs
     * Fetches source_image_urls and r2_image_urls from vitamix_sources
     * @param {string[]} sourceIds - Array of source UUIDs
     * @returns {Promise<Array>} Sources with their image URLs
     */
    async getSourceImages(sourceIds) {
      if (!sourceIds || sourceIds.length === 0) return [];

      // Build OR filter for multiple IDs: id=in.(uuid1,uuid2,uuid3)
      const idsParam = sourceIds.join(',');
      const result = await request(
        `/vitamix_sources?id=in.(${idsParam})&select=id,title,source_image_urls,r2_image_urls`,
      );
      return result || [];
    },

    /**
     * Get all sources with images (for comparison pages)
     * Returns sources that have non-empty source_image_urls
     * @returns {Promise<Array>} Sources with their image URLs
     */
    async getAllProductImages() {
      const result = await request(
        `/vitamix_sources?select=id,title,source_image_urls,r2_image_urls&limit=100`,
      );
      // Filter to only those with actual images
      const sourcesWithImages = (result || []).filter((s) => {
        const imgs = s.source_image_urls || s.r2_image_urls || [];
        return Array.isArray(imgs) && imgs.length > 0;
      });
      return sourcesWithImages;
    },
  };
}
