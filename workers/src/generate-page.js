/**
 * Generate Page API Endpoint
 * Creates AI-generated content for a user query
 */

import { generateContent } from './lib/claude.js';
import { createClient } from './lib/supabase.js';
import { generateImages as generateDalleImages } from './lib/dalle.js';

/**
 * Extract image prompts from generated content
 */
function extractImagePrompts(content) {
  const prompts = [];

  // Hero image
  if (content.hero?.image_prompt) {
    prompts.push({
      type: 'hero',
      prompt: content.hero.image_prompt,
    });
  }

  // Feature images
  if (content.features?.length) {
    content.features.forEach((feature, index) => {
      if (feature.image_prompt) {
        prompts.push({
          type: 'feature',
          index,
          prompt: feature.image_prompt,
        });
      }
    });
  }

  return prompts;
}

/**
 * Background image generation task
 */
async function generateImagesBackground(pageId, prompts, env) {
  try {
    const supabase = createClient(env);

    // Generate images with DALL-E
    const images = await generateDalleImages(prompts, env.OPENAI_API_KEY);

    // Build update object
    const updates = { images_ready: true };

    // Find hero image
    const heroImage = images.find((img) => img.type === 'hero');
    if (heroImage) {
      // Get current page data to update hero
      const page = await supabase.getPage(pageId);
      if (page) {
        const updatedHero = { ...page.hero, image_url: heroImage.url };
        updates.hero = updatedHero;
      }
    }

    // Find feature images
    const featureImages = images.filter((img) => img.type === 'feature');
    if (featureImages.length > 0) {
      const page = await supabase.getPage(pageId);
      if (page?.features) {
        const updatedFeatures = [...page.features];
        featureImages.forEach((img) => {
          if (typeof img.index === 'number' && updatedFeatures[img.index]) {
            updatedFeatures[img.index] = {
              ...updatedFeatures[img.index],
              image_url: img.url,
            };
          }
        });
        updates.features = updatedFeatures;
      }
    }

    // Update page in database
    await supabase.updatePage(pageId, updates);
    console.log(`Images generated for page ${pageId}`);
  } catch (error) {
    console.error('Background image generation failed:', error);
  }
}

/**
 * Normalize query for cache lookup
 * @param {string} query - User query
 * @returns {string} Normalized query
 */
function normalizeQuery(query) {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check for cached page with same query (24-hour TTL)
 * @param {string} query - Normalized query
 * @param {object} supabase - Supabase client
 * @returns {object|null} Cached page or null
 */
async function getCachedPage(query, supabase) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return supabase.findPageByQuery(query, twentyFourHoursAgo);
}

/**
 * Generate page handler
 * @param {object} body - Request body with query and session_id
 * @param {object} env - Worker environment
 * @param {object} ctx - Execution context
 */
export async function generatePage(body, env, ctx) {
  const { query, session_id: sessionId } = body;

  if (!query || typeof query !== 'string') {
    throw new Error('Query is required');
  }

  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  const supabase = createClient(env);
  const normalizedQuery = normalizeQuery(query);

  // Check for cached page (24-hour TTL)
  const cachedPage = await getCachedPage(normalizedQuery, supabase);
  if (cachedPage) {
    // Add to search history even for cached pages
    await supabase.addHistory(sessionId, query, cachedPage.id);
    return {
      ...cachedPage,
      cached: true,
    };
  }

  // Generate content with Claude
  const content = await generateContent(query, env.ANTHROPIC_API_KEY);

  // Prepare page data for database
  const pageData = {
    query,
    content_type: content.type || 'article',
    keywords: content.keywords || [],
    hero: content.hero || {},
    body: content.body || {},
    features: content.features || [],
    faqs: content.faqs || [],
    cta: content.cta || {},
    related: content.related || [],
    images_ready: false,
  };

  // Save to database
  const page = await supabase.insertPage(pageData);

  // Add to search history
  await supabase.addHistory(sessionId, query, page.id);

  // Trigger background image generation
  const imagePrompts = extractImagePrompts(content);
  if (imagePrompts.length > 0) {
    // Use waitUntil to run image generation after response
    ctx.waitUntil(generateImagesBackground(page.id, imagePrompts, env));
  }

  // Return page data immediately (images will update via realtime)
  return {
    id: page.id,
    ...pageData,
  };
}
