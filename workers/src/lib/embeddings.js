/**
 * OpenAI Embeddings API Integration
 * Generates vector embeddings for RAG system
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small';

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<number[]>} Embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text, apiKey) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embeddings API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 * @param {string[]} texts - Array of texts to embed
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function generateEmbeddings(texts, apiKey) {
  if (texts.length === 0) return [];

  // OpenAI supports up to 2048 texts per request
  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embeddings API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    // Sort by index to maintain order
    const sortedEmbeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    results.push(...sortedEmbeddings);

    // Rate limiting: small delay between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => { setTimeout(resolve, 100); });
    }
  }

  return results;
}
