/**
 * Cloudflare Workers AI Embeddings
 * Generates vector embeddings for RAG system using @cf/baai/bge-base-en-v1.5
 * 768 dimensions, optimized for semantic similarity
 */

/**
 * Generate embedding for a single text using Workers AI
 * @param {string} text - Text to embed
 * @param {object} ai - Workers AI binding (env.AI)
 * @returns {Promise<number[]>} Embedding vector (768 dimensions)
 */
export async function generateEmbedding(text, ai) {
  if (!ai) {
    throw new Error('Workers AI binding not available');
  }

  const result = await ai.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  });

  return result.data[0];
}

/**
 * Generate embeddings for multiple texts (batch)
 * @param {string[]} texts - Array of texts to embed
 * @param {object} ai - Workers AI binding (env.AI)
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function generateEmbeddings(texts, ai) {
  if (texts.length === 0) return [];

  if (!ai) {
    throw new Error('Workers AI binding not available');
  }

  // Workers AI supports batch embedding
  const result = await ai.run('@cf/baai/bge-base-en-v1.5', {
    text: texts,
  });

  return result.data;
}
