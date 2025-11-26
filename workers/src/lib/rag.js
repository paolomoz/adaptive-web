/**
 * RAG (Retrieval-Augmented Generation) Module
 * Retrieves relevant Vitamix content to ground AI responses
 */

import { generateEmbedding } from './embeddings.js';

/**
 * Retrieve relevant context for a query
 * @param {string} query - User query
 * @param {string} openaiApiKey - OpenAI API key for embeddings
 * @param {object} supabase - Supabase client
 * @param {object} options - Retrieval options
 * @returns {Promise<{context: string, sourceIds: string[]}>}
 */
export async function retrieveContext(query, openaiApiKey, supabase, options = {}) {
  const { threshold = 0.7, limit = 5 } = options;

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query, openaiApiKey);

    // Search for relevant content
    const chunks = await supabase.searchVitamixContent(queryEmbedding, {
      threshold,
      limit,
    });

    if (!chunks || chunks.length === 0) {
      console.log('RAG: No relevant sources found for query:', query);
      return { context: '', sourceIds: [] };
    }

    console.log(`RAG: Found ${chunks.length} relevant sources for query:`, query);

    // Build context string for Claude
    const context = formatContextForClaude(chunks);

    // Deduplicate source IDs
    const sourceIds = [...new Set(chunks.map((c) => c.source_id))];

    return { context, sourceIds };
  } catch (error) {
    console.error('RAG retrieval error:', error);
    // Return empty context on error to allow generation to proceed
    return { context: '', sourceIds: [] };
  }
}

/**
 * Format retrieved chunks into context for Claude prompt
 * @param {Array} chunks - Retrieved content chunks
 * @returns {string} Formatted context string
 */
function formatContextForClaude(chunks) {
  if (!chunks || chunks.length === 0) return '';

  let context = '\n\nVITAMIX REFERENCE DATA (use for accurate information):\n\n';

  chunks.forEach((chunk, idx) => {
    const typeLabel = chunk.content_type.toUpperCase();
    context += `[${idx + 1}] ${typeLabel}: ${chunk.title}\n`;
    context += `${chunk.chunk_text}\n`;

    // Include relevant metadata
    if (chunk.metadata) {
      if (chunk.metadata.price) {
        context += `Price: $${chunk.metadata.price}\n`;
      }
      if (chunk.metadata.model) {
        context += `Model: ${chunk.metadata.model}\n`;
      }
      if (chunk.metadata.series) {
        context += `Series: ${chunk.metadata.series}\n`;
      }
    }

    context += `(Relevance: ${(chunk.similarity * 100).toFixed(0)}%)\n\n`;
  });

  context += 'IMPORTANT: Prioritize the above reference data for product specs, ';
  context += 'prices, and features. Ensure generated content aligns with this information.\n';

  return context;
}

/**
 * Chunk text into smaller pieces for embedding
 * @param {string} text - Full text content
 * @param {object} options - Chunking options
 * @returns {Array<{text: string, index: number}>} Array of chunks
 */
export function chunkText(text, options = {}) {
  const { chunkSize = 500, overlap = 100 } = options;

  const chunks = [];
  const cleanText = text.replace(/\s+/g, ' ').trim();

  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = Math.min(startIndex + chunkSize, cleanText.length);

    // Try to break at sentence boundary
    if (endIndex < cleanText.length) {
      const segment = cleanText.slice(startIndex, endIndex + 50);
      const sentenceEnd = findSentenceEnd(segment, chunkSize);
      if (sentenceEnd > 0) {
        endIndex = startIndex + sentenceEnd;
      }
    }

    const chunkTextContent = cleanText.slice(startIndex, endIndex).trim();

    if (chunkTextContent.length >= 50) { // Minimum chunk size
      chunks.push({
        text: chunkTextContent,
        index: chunkIndex,
      });
      chunkIndex += 1;
    }

    // Move start with overlap
    startIndex = endIndex - overlap;
    if (startIndex >= cleanText.length) break;
  }

  return chunks;
}

/**
 * Find sentence boundary in text segment
 * @param {string} segment - Text segment
 * @param {number} maxPos - Maximum position to search
 * @returns {number} Position of sentence end, or -1
 */
function findSentenceEnd(segment, maxPos) {
  const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];

  let lastBoundary = -1;
  for (const ender of sentenceEnders) {
    const pos = segment.lastIndexOf(ender, maxPos);
    if (pos > lastBoundary) {
      lastBoundary = pos + 1; // Include the punctuation
    }
  }

  return lastBoundary;
}
