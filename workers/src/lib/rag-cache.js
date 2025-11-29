/**
 * RAG Caching Layer
 * Caches RAG results in KV to reduce latency and API costs
 */

// Cache TTL: 1 hour (queries may return different results as more content is crawled)
const CACHE_TTL = 60 * 60;

// Normalize query for consistent cache keys
function normalizeQuery(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Generate cache key from query
function getCacheKey(query) {
  const normalized = normalizeQuery(query);
  // Simple hash for shorter keys
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `rag:${Math.abs(hash).toString(36)}:${normalized.slice(0, 30)}`;
}

/**
 * Get cached RAG result
 * @param {string} query - User query
 * @param {object} env - Worker environment with RAG_CACHE binding
 * @returns {Promise<object|null>} Cached result or null
 */
export async function getCachedRAG(query, env) {
  if (!env.RAG_CACHE) {
    return null;
  }

  try {
    const key = getCacheKey(query);
    const cached = await env.RAG_CACHE.get(key, { type: 'json' });

    if (cached) {
      console.log(`RAG Cache HIT: "${query.slice(0, 50)}..."`);
      return cached;
    }

    console.log(`RAG Cache MISS: "${query.slice(0, 50)}..."`);
    return null;
  } catch (error) {
    console.error('RAG cache get error:', error);
    return null;
  }
}

/**
 * Cache RAG result
 * @param {string} query - User query
 * @param {object} result - RAG result to cache
 * @param {object} env - Worker environment with RAG_CACHE binding
 * @returns {Promise<void>}
 */
export async function setCachedRAG(query, result, env) {
  if (!env.RAG_CACHE) {
    return;
  }

  try {
    const key = getCacheKey(query);

    // Only cache if we have meaningful results
    if (!result.context && result.sourceIds.length === 0) {
      return;
    }

    await env.RAG_CACHE.put(key, JSON.stringify(result), {
      expirationTtl: CACHE_TTL,
    });

    console.log(`RAG Cache SET: "${query.slice(0, 50)}..." (TTL: ${CACHE_TTL}s)`);
  } catch (error) {
    console.error('RAG cache set error:', error);
  }
}

/**
 * Invalidate cache for a specific query
 * @param {string} query - Query to invalidate
 * @param {object} env - Worker environment
 */
export async function invalidateCache(query, env) {
  if (!env.RAG_CACHE) {
    return;
  }

  try {
    const key = getCacheKey(query);
    await env.RAG_CACHE.delete(key);
    console.log(`RAG Cache INVALIDATED: "${query.slice(0, 50)}..."`);
  } catch (error) {
    console.error('RAG cache invalidate error:', error);
  }
}

/**
 * Get cache statistics (for monitoring)
 * Note: KV doesn't provide native stats, this is a placeholder
 */
export function getCacheStats() {
  return {
    ttl: CACHE_TTL,
    keyPrefix: 'rag:',
  };
}
