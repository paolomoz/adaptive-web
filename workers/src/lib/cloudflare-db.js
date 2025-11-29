/**
 * Cloudflare D1 + Vectorize + Workers AI Embeddings Client
 * Server-side database operations using Cloudflare's native services
 * Drop-in replacement for supabase.js
 */

/**
 * Create Cloudflare DB client
 * @param {object} env - Worker environment with DB, VECTORIZE, AI bindings
 * @returns {object} Client methods (same interface as supabase.js)
 */
export function createClient(env) {
  const db = env.DB;
  const vectorize = env.VECTORIZE;
  const ai = env.AI;

  if (!db) {
    throw new Error('Missing D1 database binding (DB)');
  }

  /**
   * Generate embedding using Workers AI (bge-base-en-v1.5)
   * 768 dimensions, optimized for semantic similarity
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} 768-dim embedding vector
   */
  async function generateEmbedding(text) {
    if (!ai) {
      throw new Error('Missing Workers AI binding (AI)');
    }
    const result = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [text],
    });
    return result.data[0];
  }

  return {
    /**
     * Insert a new generated page
     */
    async insertPage(pageData) {
      const cleanData = Object.fromEntries(
        Object.entries(pageData).filter(([_, v]) => v !== undefined),
      );

      // Generate UUID if not provided
      const id = cleanData.id || crypto.randomUUID();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO generated_pages (
          id, query, content_type, metadata, keywords, hero, faqs, features,
          related_topics, content_atoms, layout_blocks, rag_source_ids,
          rag_source_images, images_ready, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        id,
        cleanData.query || null,
        cleanData.content_type || null,
        JSON.stringify(cleanData.metadata || null),
        JSON.stringify(cleanData.keywords || null),
        JSON.stringify(cleanData.hero || null),
        JSON.stringify(cleanData.faqs || null),
        JSON.stringify(cleanData.features || null),
        JSON.stringify(cleanData.related_topics || null),
        JSON.stringify(cleanData.content_atoms || null),
        JSON.stringify(cleanData.layout_blocks || null),
        JSON.stringify(cleanData.rag_source_ids || null),
        JSON.stringify(cleanData.rag_source_images || null),
        cleanData.images_ready ? 1 : 0,
        now,
        now,
      ).run();

      return { ...cleanData, id, created_at: now, updated_at: now };
    },

    /**
     * Update a page (e.g., with image URLs)
     */
    async updatePage(pageId, updates) {
      const now = new Date().toISOString();
      const setClauses = [];
      const values = [];

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setClauses.push(`${key} = ?`);
          // JSON-stringify objects/arrays
          if (typeof value === 'object' && value !== null) {
            values.push(JSON.stringify(value));
          } else if (typeof value === 'boolean') {
            values.push(value ? 1 : 0);
          } else {
            values.push(value);
          }
        }
      }

      setClauses.push('updated_at = ?');
      values.push(now);
      values.push(pageId);

      const stmt = db.prepare(`
        UPDATE generated_pages
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `);

      await stmt.bind(...values).run();

      // Return updated page
      return this.getPage(pageId);
    },

    /**
     * Get a page by ID
     */
    async getPage(pageId) {
      const stmt = db.prepare('SELECT * FROM generated_pages WHERE id = ?');
      const result = await stmt.bind(pageId).first();
      if (!result) return null;

      // Parse JSON fields
      return parsePageRow(result);
    },

    /**
     * Find a cached page by query
     * @param {string} normalizedQuery - Lowercase trimmed query
     * @param {string} minCreatedAt - ISO date string for TTL cutoff
     */
    async findPageByQuery(normalizedQuery, minCreatedAt) {
      const stmt = db.prepare(`
        SELECT * FROM generated_pages
        WHERE LOWER(query) = LOWER(?)
          AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const result = await stmt.bind(normalizedQuery, minCreatedAt).first();
      if (!result) return null;

      return parsePageRow(result);
    },

    /**
     * Get a cached page by query (no TTL, uses 24h default)
     * @param {string} query - Query string
     * @returns {Promise<object|null>} Cached page or null
     */
    async getPageByQuery(query) {
      // Default TTL: 24 hours
      const ttlHours = 24;
      const minCreatedAt = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();

      const stmt = db.prepare(`
        SELECT * FROM generated_pages
        WHERE LOWER(query) = LOWER(?)
          AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const result = await stmt.bind(query.toLowerCase().trim(), minCreatedAt).first();
      if (!result) return null;

      return parsePageRow(result);
    },

    /**
     * Add search history entry
     */
    async addHistory(sessionId, query, pageId) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO search_history (id, session_id, query, page_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      await stmt.bind(id, sessionId, query, pageId, now).run();
    },

    /**
     * Get search history for session
     */
    async getHistory(sessionId, limit = 20) {
      const stmt = db.prepare(`
        SELECT id, query, page_id, created_at
        FROM search_history
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      const result = await stmt.bind(sessionId, limit).all();
      return result.results || [];
    },

    /**
     * Get suggested topics
     */
    async getSuggestedTopics() {
      const stmt = db.prepare(`
        SELECT * FROM suggested_topics
        WHERE active = 1
        ORDER BY display_order ASC
      `);
      const result = await stmt.all();
      return result.results || [];
    },

    /**
     * Search Vitamix content using Vectorize (RAG)
     * Returns data in same format as Supabase RPC function (joined with sources)
     * @param {number[]} embedding - Query embedding vector
     * @param {object} options - Search options
     * @returns {Promise<Array>} Matching content chunks with source data
     */
    async searchVitamixContent(embedding, options = {}) {
      if (!vectorize) {
        console.warn('Vectorize not available, returning empty results');
        return [];
      }

      const { threshold = 0.7, limit = 5 } = options;

      // Query Vectorize
      const results = await vectorize.query(embedding, {
        topK: limit,
        returnMetadata: 'all',
      });

      // Filter by threshold
      const matches = results.matches.filter((m) => m.score >= threshold);

      if (matches.length === 0) {
        return [];
      }

      // Get unique source IDs to fetch source data
      const sourceIds = [...new Set(matches.map((m) => m.metadata?.source_id).filter(Boolean))];

      // Fetch source data from D1 to get title, content_type, url
      let sourcesMap = {};
      if (sourceIds.length > 0) {
        const placeholders = sourceIds.map(() => '?').join(',');
        const sourcesStmt = db.prepare(`
          SELECT id, title, content_type, url
          FROM vitamix_sources
          WHERE id IN (${placeholders})
        `);
        const sourcesResult = await sourcesStmt.bind(...sourceIds).all();
        for (const source of sourcesResult.results || []) {
          sourcesMap[source.id] = source;
        }
      }

      // Format results to match Supabase RPC function output
      // Required fields: id, source_id, chunk_text, content_type, title, url, similarity
      const formattedResults = matches.map((m) => {
        const source = sourcesMap[m.metadata?.source_id] || {};
        return {
          id: m.id,
          source_id: m.metadata?.source_id,
          chunk_text: m.metadata?.content, // Supabase uses chunk_text
          content_type: source.content_type || 'product',
          title: source.title || 'Vitamix',
          url: source.url || null,
          similarity: m.score,
          // Include metadata for compatibility
          metadata: {
            price: null,
            model: null,
            series: null,
            image_url: null,
          },
        };
      });

      return formattedResults;
    },

    /**
     * Generate embedding for text (exposed for RAG)
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} Embedding vector
     */
    async generateEmbedding(text) {
      return generateEmbedding(text);
    },

    /**
     * Insert a Vitamix source
     * @param {object} sourceData - Source data
     * @returns {Promise<object>} Inserted source
     */
    async insertSource(sourceData) {
      const id = sourceData.id || crypto.randomUUID();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO vitamix_sources (
          id, url, title, content_type, source_image_urls, r2_image_urls,
          scraped_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        id,
        sourceData.url || null,
        sourceData.title || null,
        sourceData.content_type || null,
        JSON.stringify(sourceData.source_image_urls || []),
        JSON.stringify(sourceData.r2_image_urls || []),
        sourceData.scraped_at || now,
        now,
      ).run();

      return { ...sourceData, id, created_at: now };
    },

    /**
     * Insert content chunks with embeddings
     * Also inserts into Vectorize for similarity search
     * @param {Array} chunks - Array of chunk objects with embeddings
     * @returns {Promise<Array>} Inserted chunks
     */
    async insertChunks(chunks) {
      const results = [];
      const vectorInserts = [];

      for (const chunk of chunks) {
        const id = chunk.id || crypto.randomUUID();
        const now = new Date().toISOString();

        // Insert into D1
        const stmt = db.prepare(`
          INSERT INTO vitamix_chunks (
            id, source_id, content, chunk_index, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `);

        await stmt.bind(
          id,
          chunk.source_id,
          chunk.content,
          chunk.chunk_index || 0,
          now,
        ).run();

        results.push({ ...chunk, id, created_at: now });

        // Prepare for Vectorize insert
        if (chunk.embedding && vectorize) {
          vectorInserts.push({
            id,
            values: chunk.embedding,
            metadata: {
              source_id: chunk.source_id,
              content: chunk.content?.substring(0, 500), // Truncate for metadata
              chunk_index: chunk.chunk_index || 0,
            },
          });
        }
      }

      // Batch insert into Vectorize
      if (vectorInserts.length > 0 && vectorize) {
        await vectorize.upsert(vectorInserts);
      }

      return results;
    },

    /**
     * Get source images by source IDs
     * Fetches from both vitamix_sources (legacy) and vitamix_images (new) tables
     * @param {string[]} sourceIds - Array of source UUIDs
     * @returns {Promise<Array>} Sources with their image URLs
     */
    async getSourceImages(sourceIds) {
      if (!sourceIds || sourceIds.length === 0) return [];

      const placeholders = sourceIds.map(() => '?').join(',');

      // Query from vitamix_sources (legacy)
      const sourcesStmt = db.prepare(`
        SELECT id, title, source_image_urls, r2_image_urls, page_type
        FROM vitamix_sources
        WHERE id IN (${placeholders})
      `);
      const sourcesResult = await sourcesStmt.bind(...sourceIds).all();

      // Query from vitamix_images (new - with context and type)
      const imagesStmt = db.prepare(`
        SELECT source_id, r2_url, alt_text, image_type, context
        FROM vitamix_images
        WHERE source_id IN (${placeholders})
        ORDER BY source_id
      `);
      const imagesResult = await imagesStmt.bind(...sourceIds).all();

      // Group new images by source_id
      const imagesBySource = {};
      for (const img of imagesResult.results || []) {
        if (!imagesBySource[img.source_id]) {
          imagesBySource[img.source_id] = [];
        }
        imagesBySource[img.source_id].push({
          url: img.r2_url,
          alt: img.alt_text,
          type: img.image_type,
          context: img.context,
        });
      }

      // Merge sources with their images
      return (sourcesResult.results || []).map((row) => {
        // Prefer new vitamix_images over legacy r2_image_urls
        const newImages = imagesBySource[row.id] || [];
        const legacyR2 = JSON.parse(row.r2_image_urls || '[]');
        const legacySource = JSON.parse(row.source_image_urls || '[]');

        return {
          id: row.id,
          title: row.title,
          pageType: row.page_type,
          // New images with metadata
          images: newImages,
          // Legacy fields for backwards compatibility
          source_image_urls: legacySource,
          r2_image_urls: newImages.length > 0 ? newImages.map((i) => i.url) : legacyR2,
        };
      });
    },

    /**
     * Get all sources with images
     * @returns {Promise<Array>} Sources with their image URLs
     */
    async getAllProductImages() {
      const stmt = db.prepare(`
        SELECT id, title, source_image_urls, r2_image_urls
        FROM vitamix_sources
        LIMIT 100
      `);

      const result = await stmt.all();
      const sources = (result.results || []).map((row) => ({
        id: row.id,
        title: row.title,
        source_image_urls: JSON.parse(row.source_image_urls || '[]'),
        r2_image_urls: JSON.parse(row.r2_image_urls || '[]'),
      }));

      // Filter to only those with actual images
      return sources.filter((s) => {
        const imgs = s.source_image_urls || s.r2_image_urls || [];
        return Array.isArray(imgs) && imgs.length > 0;
      });
    },
  };
}

/**
 * Parse a page row from D1, converting JSON strings to objects
 */
function parsePageRow(row) {
  return {
    id: row.id,
    query: row.query,
    content_type: row.content_type,
    metadata: JSON.parse(row.metadata || 'null'),
    keywords: JSON.parse(row.keywords || 'null'),
    hero: JSON.parse(row.hero || 'null'),
    faqs: JSON.parse(row.faqs || 'null'),
    features: JSON.parse(row.features || 'null'),
    related_topics: JSON.parse(row.related_topics || 'null'),
    content_atoms: JSON.parse(row.content_atoms || 'null'),
    layout_blocks: JSON.parse(row.layout_blocks || 'null'),
    rag_source_ids: JSON.parse(row.rag_source_ids || 'null'),
    rag_source_images: JSON.parse(row.rag_source_images || 'null'),
    images_ready: row.images_ready === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
