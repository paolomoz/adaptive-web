/**
 * Generate Images API Endpoint
 * Generates images for an existing page
 */

import { generateImages as generateDalleImages } from './lib/dalle.js';
import { createClient } from './lib/supabase.js';

/**
 * Generate images handler
 * @param {object} body - Request body with page_id and prompts
 * @param {object} env - Worker environment
 */
export async function generateImages(body, env) {
  const { page_id: pageId, prompts } = body;

  if (!pageId) {
    throw new Error('Page ID is required');
  }

  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
    throw new Error('Prompts array is required');
  }

  // Validate prompts structure
  const validPrompts = prompts.filter(
    (p) => p.prompt && typeof p.prompt === 'string' && p.type,
  );

  if (validPrompts.length === 0) {
    throw new Error('No valid prompts provided');
  }

  // Generate images with DALL-E
  const images = await generateDalleImages(validPrompts, env.OPENAI_API_KEY);

  // Get current page data
  const supabase = createClient(env);
  const page = await supabase.getPage(pageId);

  if (!page) {
    throw new Error('Page not found');
  }

  // Build update object
  const updates = { images_ready: true };

  // Update hero image
  const heroImage = images.find((img) => img.type === 'hero');
  if (heroImage) {
    updates.hero = { ...page.hero, image_url: heroImage.url };
  }

  // Update feature images
  const featureImages = images.filter((img) => img.type === 'feature');
  if (featureImages.length > 0) {
    const updatedFeatures = [...(page.features || [])];
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

  // Update page in database
  await supabase.updatePage(pageId, updates);

  return {
    success: true,
    page_id: pageId,
    images_generated: images.length,
    images,
  };
}
