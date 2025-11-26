/**
 * DALL-E API Integration
 * Generates images for AdaptiveWeb pages
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations';

/**
 * Enhance prompt based on image type (context-appropriate Vitamix branding)
 * - Hero images: Show Vitamix blender prominently
 * - Feature/recipe images: Focus on food, blender only when relevant
 * @param {string} prompt - Original prompt
 * @param {string} type - Image type ('hero' or 'feature')
 * @returns {string} Enhanced prompt
 */
function enhancePrompt(prompt, type) {
  const promptLower = prompt.toLowerCase();
  const isBlenderRelated = promptLower.includes('blender')
    || promptLower.includes('vitamix')
    || promptLower.includes('machine')
    || promptLower.includes('appliance');

  if (type === 'hero' || isBlenderRelated) {
    // Hero images and blender-related content: show Vitamix prominently
    return `Professional food photography: ${prompt}. Modern Vitamix blender prominently featured in frame. High-quality, well-lit modern kitchen setting, clean composition, shallow depth of field. Appetizing and aspirational.`;
  }

  // Feature/recipe images: focus on the food result
  return `Professional food photography: ${prompt}. High-quality, appetizing composition with beautiful lighting. Fresh ingredients, vibrant colors, clean modern presentation. Shallow depth of field.`;
}

/**
 * Generate an image using DALL-E 3
 * @param {string} prompt - Image generation prompt
 * @param {string} apiKey - OpenAI API key
 * @param {object} options - Generation options
 * @returns {Promise<string>} Image URL
 */
export async function generateImage(prompt, apiKey, options = {}) {
  const {
    size = '1024x1024',
    quality = 'standard', // 'standard' or 'hd'
    style = 'natural', // 'natural' or 'vivid'
    type = 'feature', // 'hero' or 'feature'
  } = options;

  // Enhance prompt based on context
  const enhancedPrompt = enhancePrompt(prompt, type);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size,
      quality,
      style,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DALL-E API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].url;
}

/**
 * Generate multiple images in parallel
 * @param {Array<{type: string, prompt: string, index?: number}>} prompts - Image prompts
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array<{type: string, index?: number, url: string}>>} Generated images
 */
export async function generateImages(prompts, apiKey) {
  const results = await Promise.allSettled(
    prompts.map(async (item) => {
      // Use different sizes based on image type
      const size = item.type === 'hero' ? '1792x1024' : '1024x1024';

      const url = await generateImage(item.prompt, apiKey, { size, type: item.type });
      return {
        type: item.type,
        index: item.index,
        url,
      };
    }),
  );

  // Filter successful results
  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}
