/**
 * DALL-E API Integration
 * Generates images for AdaptiveWeb pages
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations';

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
  } = options;

  // Enhance prompt for food photography
  const enhancedPrompt = `Professional food photography: ${prompt}. High-quality, appetizing, well-lit, modern kitchen setting, Vitamix blender context. Clean composition, shallow depth of field.`;

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

      const url = await generateImage(item.prompt, apiKey, { size });
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
