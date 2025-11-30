/**
 * Image Search Module
 * Semantic search for Vitamix images using Vectorize
 * Falls back to direct DB lookup for product model images
 */

import { generateEmbedding } from './embeddings.js';

/**
 * Search for relevant images by semantic query
 * @param {string} query - Search query (e.g., "green smoothie", "vitamix a3500")
 * @param {object} env - Worker environment with IMAGE_VECTORS, AI, and DB bindings
 * @param {object} options - Search options
 * @returns {Promise<Array>} Matching images with URLs and metadata
 */
export async function searchImages(query, env, options = {}) {
  const { limit = 5, threshold = 0.6, imageType = null } = options;

  // First, try direct DB lookup for product model numbers (faster and more reliable)
  // Extract model number like A3500, A2500, E310, etc.
  const modelMatch = query.match(/([AaEe]\d{3,4})/i);
  if (modelMatch && env.DB) {
    const modelNumber = modelMatch[1].toUpperCase();
    const dbImages = await searchImagesByAltText(modelNumber, env.DB, limit);
    if (dbImages.length > 0) {
      console.log(`Image search: Found ${dbImages.length} images for model "${modelNumber}" via DB lookup`);
      return dbImages;
    }
  }

  // Fall back to vector search if no DB results or no model number
  try {
    if (!env.IMAGE_VECTORS || !env.AI) {
      console.log('Image search: Missing IMAGE_VECTORS or AI binding');
      return [];
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query, env.AI);

    // Search in image vectors index
    const results = await env.IMAGE_VECTORS.query(queryEmbedding, {
      topK: limit * 2, // Get more to allow filtering
      returnMetadata: 'all',
    });

    if (!results.matches || results.matches.length === 0) {
      console.log('Image search: No matches found for:', query);
      return [];
    }

    // Filter by threshold and optionally by type
    let filtered = results.matches.filter((m) => m.score >= threshold);

    if (imageType) {
      filtered = filtered.filter((m) => m.metadata?.image_type === imageType);
    }

    // Map to clean format
    const images = filtered.slice(0, limit).map((match) => ({
      id: match.id,
      url: match.metadata?.r2_url,
      alt: match.metadata?.alt_text,
      type: match.metadata?.image_type,
      context: match.metadata?.context,
      sourceTitle: match.metadata?.source_title,
      score: match.score,
    }));

    console.log(`Image search: Found ${images.length} images for "${query}" via vectorize`);
    return images;
  } catch (error) {
    console.error('Image search error:', error);
    return [];
  }
}

/**
 * Direct database lookup for product images by alt_text
 * This is more reliable for exact product model matches
 * @param {string} modelNumber - Product model number (e.g., "A3500", "E310")
 * @param {D1Database} db - D1 database binding
 * @param {number} limit - Max results to return
 * @returns {Promise<Array>} Matching images
 */
async function searchImagesByAltText(modelNumber, db, limit = 3) {
  try {
    // Search for images with alt_text containing the model number
    const stmt = db.prepare(`
      SELECT id, r2_url, alt_text, image_type, context
      FROM vitamix_images
      WHERE UPPER(alt_text) LIKE ?
      LIMIT ?
    `);

    const result = await stmt.bind(`%${modelNumber}%`, limit).all();

    if (!result.results || result.results.length === 0) {
      return [];
    }

    return result.results.map((row) => ({
      id: row.id,
      url: row.r2_url,
      alt: row.alt_text,
      type: row.image_type,
      context: row.context,
      score: 1.0, // Direct match gets max score
    }));
  } catch (error) {
    console.error('DB image search error:', error);
    return [];
  }
}

/**
 * Search for images matching specific content types
 * @param {string} query - Search query
 * @param {string} contentType - Content type: 'product', 'recipe', 'blog', etc.
 * @param {object} env - Worker environment
 * @param {object} options - Search options
 */
export async function searchImagesByType(query, contentType, env, options = {}) {
  // Map content types to image types
  const typeMapping = {
    product: 'product',
    shop: 'shop',
    recipe: 'recipe',
    blog: 'blog',
    commercial: 'commercial',
  };

  const imageType = typeMapping[contentType] || null;
  return searchImages(query, env, { ...options, imageType });
}

/**
 * Get the best matching image for a specific use case
 * @param {string} query - What the image should represent
 * @param {string} useCase - 'hero', 'feature', 'product', 'recipe'
 * @param {object} env - Worker environment
 */
export async function getBestImage(query, useCase, env) {
  const options = {
    limit: 1,
    threshold: 0.55, // Slightly lower for single best match
  };

  // Adjust based on use case
  switch (useCase) {
    case 'hero':
      // Hero images should be high-quality lifestyle shots
      options.limit = 3; // Get a few to pick from
      break;
    case 'product':
      options.imageType = 'product';
      break;
    case 'recipe':
      options.imageType = 'recipe';
      break;
  }

  const images = await searchImages(query, env, options);
  return images[0] || null;
}

/**
 * Index an image into Vectorize
 * @param {object} image - Image data from vitamix_images table
 * @param {object} env - Worker environment
 */
export async function indexImage(image, env) {
  // Create searchable text from image metadata
  const searchText = [
    image.alt_text,
    image.context,
    image.source_title,
    image.image_type,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 500); // Limit text length

  if (!searchText || searchText.length < 10) {
    console.log('Image index: Skipping image with insufficient text:', image.id);
    return false;
  }

  try {
    // Generate embedding
    const embedding = await generateEmbedding(searchText, env.AI);

    // Upsert to Vectorize
    await env.IMAGE_VECTORS.upsert([
      {
        id: image.id,
        values: embedding,
        metadata: {
          r2_url: image.r2_url,
          alt_text: image.alt_text,
          image_type: image.image_type,
          context: image.context?.slice(0, 200),
          source_id: image.source_id,
          source_title: image.source_title,
        },
      },
    ]);

    return true;
  } catch (error) {
    console.error('Image index error:', error);
    return false;
  }
}

/**
 * Batch index multiple images
 * @param {Array} images - Array of image objects
 * @param {object} env - Worker environment
 */
export async function batchIndexImages(images, env) {
  const vectors = [];

  for (const image of images) {
    // Prefer AI caption if available, otherwise fall back to original metadata
    const searchText = image.ai_caption
      ? image.ai_caption
      : [
          image.alt_text,
          image.context,
          image.source_title,
          image.image_type,
        ]
          .filter(Boolean)
          .join(' ');

    const trimmedText = searchText.slice(0, 500);
    if (!trimmedText || trimmedText.length < 10) continue;

    try {
      const embedding = await generateEmbedding(trimmedText, env.AI);
      vectors.push({
        id: image.id,
        values: embedding,
        metadata: {
          r2_url: image.r2_url,
          alt_text: image.ai_caption || image.alt_text, // Use AI caption as alt if available
          image_type: image.image_type,
          context: image.context?.slice(0, 200),
          source_id: image.source_id,
          source_title: image.source_title,
        },
      });
    } catch (error) {
      console.error('Embedding error for image:', image.id, error);
    }
  }

  if (vectors.length > 0) {
    await env.IMAGE_VECTORS.upsert(vectors);
    console.log(`Image index: Indexed ${vectors.length} images`);
  }

  return vectors.length;
}
