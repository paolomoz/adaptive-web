/**
 * RAG (Retrieval-Augmented Generation) Module
 * Retrieves relevant Vitamix content to ground AI responses
 */

import { generateEmbedding } from './embeddings.js';
import { classifyQuery, getRAGFilterOptions } from './query-classifier.js';
import { getCachedRAG, setCachedRAG } from './rag-cache.js';

/**
 * Retrieve relevant context for a query
 * @param {string} query - User query
 * @param {object} ai - Workers AI binding (env.AI)
 * @param {object} supabase - DB client (Supabase or Cloudflare)
 * @param {object} options - Retrieval options
 * @param {object} env - Worker environment (for caching)
 * @returns {Promise<{context: string, sourceIds: string[], sourceImages: [], classification: object, cached: boolean}>}
 */
export async function retrieveContext(query, ai, supabase, options = {}, env = {}) {
  // Classify the query to optimize retrieval
  const classification = classifyQuery(query);
  console.log(`RAG: Query classified as "${classification.type}" (confidence: ${(classification.confidence * 100).toFixed(0)}%)`);

  // Check cache first (skip if explicitly disabled)
  if (!options.skipCache && env.RAG_CACHE) {
    const cached = await getCachedRAG(query, env);
    if (cached) {
      // Re-attach classification (not cached since it's fast to compute)
      return { ...cached, classification, cached: true };
    }
  }

  // Get optimized RAG options based on classification
  const ragOptions = getRAGFilterOptions(classification);
  const { threshold = ragOptions.threshold, limit = ragOptions.limit } = options;

  try {
    // Generate embedding for the query using Workers AI
    const queryEmbedding = await generateEmbedding(query, ai);

    // Search for relevant content
    const chunks = await supabase.searchVitamixContent(queryEmbedding, {
      threshold,
      limit,
    });

    if (!chunks || chunks.length === 0) {
      console.log('RAG: No relevant sources found for query:', query);
      return { context: '', sourceIds: [], sourceImages: [], classification, cached: false };
    }

    console.log(`RAG: Found ${chunks.length} relevant sources for query:`, query);

    // Deduplicate source IDs
    const sourceIds = [...new Set(chunks.map((c) => c.source_id))];

    // Fetch source images with enhanced metadata FIRST (needed for context)
    let sourceImages = [];
    try {
      const sources = await supabase.getSourceImages(sourceIds);
      for (const source of sources) {
        // Prefer new images array with metadata, fall back to legacy r2_image_urls
        const newImages = source.images || [];
        const legacyImages = source.r2_image_urls || source.source_image_urls || [];

        if (newImages.length > 0) {
          // Use enhanced images with alt text and context
          sourceImages.push({
            sourceId: source.id,
            title: source.title,
            pageType: source.pageType,
            images: newImages.slice(0, 4).map((img) => ({
              url: img.url,
              alt: img.alt,
              type: img.type,
              context: img.context,
            })),
          });
        } else if (legacyImages.length > 0) {
          // Fall back to legacy format
          sourceImages.push({
            sourceId: source.id,
            title: source.title,
            images: legacyImages.slice(0, 3).map((url) => ({ url })),
          });
        }
      }
      console.log(`RAG: Fetched images from ${sourceImages.length} sources (classification: ${classification.type})`);
    } catch (imgError) {
      console.error('RAG: Failed to fetch source images:', imgError);
    }

    // Build context string for Claude (include source images for product URLs)
    const context = formatContextForClaude(chunks, sourceImages);

    const result = { context, sourceIds, sourceImages };

    // Cache the result (don't include classification - it's computed fresh each time)
    if (env.RAG_CACHE) {
      await setCachedRAG(query, result, env);
    }

    return { ...result, classification, cached: false };
  } catch (error) {
    console.error('RAG retrieval error:', error);
    // Return empty context on error to allow generation to proceed
    return { context: '', sourceIds: [], sourceImages: [], classification, cached: false };
  }
}

/**
 * Format retrieved chunks into context for Claude prompt
 * @param {Array} chunks - Retrieved content chunks
 * @param {Array} sourceImages - Source images with metadata
 * @returns {string} Formatted context string
 */
function formatContextForClaude(chunks, sourceImages = []) {
  if (!chunks || chunks.length === 0) return '';

  // Build a map of source images by title for quick lookup
  const imagesByTitle = {};
  sourceImages.forEach((source) => {
    if (source.title && source.images?.length > 0) {
      // Use the first product image from each source
      const productImage = source.images.find((img) => img.type === 'product' || img.type === 'hero') || source.images[0];
      if (productImage?.url) {
        imagesByTitle[source.title.toLowerCase()] = productImage.url;
      }
    }
  });

  let context = '\n\nVITAMIX REFERENCE DATA (use for accurate information):\n\n';

  chunks.forEach((chunk, idx) => {
    const typeLabel = chunk.content_type.toUpperCase();
    context += `[${idx + 1}] ${typeLabel}: ${chunk.title}\n`;
    context += `${chunk.chunk_text}\n`;

    // Include relevant metadata
    if (chunk.metadata) {
      if (chunk.metadata.price) {
        context += `Price: ${chunk.metadata.price}\n`;
      }
      if (chunk.metadata.model) {
        context += `Model: ${chunk.metadata.model}\n`;
      }
      if (chunk.metadata.series) {
        context += `Series: ${chunk.metadata.series}\n`;
      }
      // Include image URL for product items
      if (chunk.metadata.image_url) {
        context += `Product Image URL: ${chunk.metadata.image_url}\n`;
      }
    }

    // If no image_url in metadata, try to find from sourceImages by title
    if (!chunk.metadata?.image_url && chunk.title) {
      const titleLower = chunk.title.toLowerCase();
      const matchingImage = imagesByTitle[titleLower];
      if (matchingImage) {
        context += `Product Image URL: ${matchingImage}\n`;
      }
    }

    // Include product URL from source (outside metadata block since it's on chunk directly)
    if (chunk.url) {
      context += `Product Page: ${chunk.url}\n`;
    }

    context += `(Relevance: ${(chunk.similarity * 100).toFixed(0)}%)\n\n`;
  });

  // Add a dedicated product images section for easy reference
  if (sourceImages.length > 0) {
    context += '\nPRODUCT IMAGES (use these exact URLs for comparison items):\n';
    sourceImages.forEach((source) => {
      if (source.images?.length > 0) {
        const productImage = source.images.find((img) => img.type === 'product' || img.type === 'hero') || source.images[0];
        if (productImage?.url) {
          context += `- ${source.title}: ${productImage.url}\n`;
        }
      }
    });
    context += '\n';
  }

  context += 'IMPORTANT: Prioritize the above reference data for product specs, prices, and features.\n';
  context += 'CRITICAL: For comparison items, use the exact Product Image URLs from above - do NOT use image_prompt for products.\n';

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
