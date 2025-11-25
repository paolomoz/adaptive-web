/**
 * API Client for AdaptiveWeb
 * Wrapper for Cloudflare Workers API calls
 */

import { getSessionId, addToHistory } from './supabase-client.js';

// Configuration - Replace with your Cloudflare Workers URL
const API_BASE_URL = 'https://adaptive-web-api.paolo-moz.workers.dev';

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Make API request with error handling
 * @param {string} endpoint - API endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Response data
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      errorData.message || `API request failed: ${response.status}`,
      response.status,
      errorData,
    );
  }

  return response.json();
}

/**
 * Generate a new page from a query
 * @param {string} query - User's search query
 * @param {function} onProgress - Optional callback for progress updates
 * @returns {Promise<object>} Generated page data with ID
 */
export async function generatePage(query, onProgress = null) {
  const sessionId = getSessionId();

  if (onProgress) onProgress({ status: 'generating', message: 'Generating content...' });

  const data = await apiRequest('/api/generate-page', {
    method: 'POST',
    body: JSON.stringify({
      query,
      session_id: sessionId,
    }),
  });

  // Add to history
  await addToHistory(query, data.id);

  if (onProgress) onProgress({ status: 'complete', message: 'Content ready!' });

  return data;
}

/**
 * Get an existing page by ID
 * @param {string} pageId - UUID of the page
 * @returns {Promise<object>} Page data
 */
export async function getPage(pageId) {
  return apiRequest(`/api/get-page?id=${encodeURIComponent(pageId)}`);
}

/**
 * Trigger image generation for a page (called after initial load)
 * @param {string} pageId - UUID of the page
 * @param {Array<string>} prompts - Image prompts from content
 * @returns {Promise<object>} Status response
 */
export async function generateImages(pageId, prompts) {
  return apiRequest('/api/generate-images', {
    method: 'POST',
    body: JSON.stringify({
      page_id: pageId,
      prompts,
    }),
  });
}

/**
 * Get search history for sidebar
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} History items
 */
export async function getHistory(limit = 20) {
  const sessionId = getSessionId();
  return apiRequest(`/api/get-history?session_id=${encodeURIComponent(sessionId)}&limit=${limit}`);
}

/**
 * Helper to extract image prompts from page content
 * @param {object} pageData - Generated page data
 * @returns {Array<string>} Array of image prompts
 */
export function extractImagePrompts(pageData) {
  const prompts = [];

  // Hero image prompt
  if (pageData.hero?.image_prompt) {
    prompts.push({
      type: 'hero',
      prompt: pageData.hero.image_prompt,
    });
  }

  // Feature card image prompts
  if (pageData.features?.length) {
    pageData.features.forEach((feature, index) => {
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
 * Check if API is configured
 * @returns {boolean} True if API URL is set
 */
export function isConfigured() {
  return !API_BASE_URL.includes('YOUR_SUBDOMAIN');
}

/**
 * Check if running in demo/mock mode
 * Add ?demo=true to URL to enable mock mode
 */
export function isDemoMode() {
  return new URLSearchParams(window.location.search).get('demo') === 'true';
}

/**
 * Generate mock page data for testing
 */
export function getMockPageData(query) {
  return {
    id: crypto.randomUUID(),
    query,
    content_type: 'recipe',
    keywords: ['Vitamix', 'Smoothie', 'Healthy'],
    hero: {
      title: `Discover: ${query}`,
      subtitle: 'Explore the best recipes and tips for your Vitamix blender. Create delicious, healthy meals in minutes.',
      cta_text: 'Get Started',
      image_url: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=1200&h=600&fit=crop',
      image_prompt: 'Vitamix blender with fresh fruits and vegetables',
    },
    body: {
      paragraphs: [
        'Your Vitamix blender is the ultimate kitchen companion for creating nutritious meals and snacks. With its powerful motor and precision blades, you can blend everything from silky smooth soups to frozen desserts.',
        'Whether you\'re a beginner or an experienced chef, these recipes will help you get the most out of your Vitamix. Start with simple smoothies and work your way up to more complex dishes.',
      ],
      cta_text: 'View All Recipes',
    },
    features: [
      {
        title: 'Green Power Smoothie',
        description: 'Packed with spinach, banana, and almond milk for an energizing start to your day.',
        cta_text: 'Get Recipe',
        image_url: 'https://images.unsplash.com/photo-1638176066666-ffb2f013c7dd?w=400&h=300&fit=crop',
      },
      {
        title: 'Creamy Tomato Soup',
        description: 'Restaurant-quality soup made in minutes. The Vitamix heats it as it blends!',
        cta_text: 'Get Recipe',
        image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop',
      },
      {
        title: 'Homemade Nut Butter',
        description: 'Create fresh, preservative-free almond or peanut butter in just 2 minutes.',
        cta_text: 'Get Recipe',
        image_url: 'https://images.unsplash.com/photo-1612187715738-58e4e1e0b3d8?w=400&h=300&fit=crop',
      },
    ],
    faqs: [
      {
        question: 'Which Vitamix model is best for smoothies?',
        answer: 'All Vitamix models make excellent smoothies. The Ascent Series offers smart technology and wireless connectivity, while the Explorian Series provides great value for beginners.',
      },
      {
        question: 'Can I make hot soup in my Vitamix?',
        answer: 'Yes! Vitamix blenders can heat soup through friction alone. Blend on high for 5-6 minutes and your soup will be steaming hot and perfectly smooth.',
      },
      {
        question: 'How do I clean my Vitamix?',
        answer: 'Simply add warm water and a drop of dish soap, blend on high for 30-60 seconds, rinse, and you\'re done! The self-cleaning feature makes cleanup effortless.',
      },
    ],
    cta: {
      title: 'Ready to Blend?',
      description: 'Discover your perfect Vitamix and start creating delicious, healthy recipes today.',
      buttons: [
        { text: 'Shop Blenders', style: 'primary' },
        { text: 'Browse Recipes', style: 'secondary' },
      ],
    },
    related: [
      { title: 'Breakfast Smoothies', description: 'Start your day with energy-boosting blends' },
      { title: 'Frozen Desserts', description: 'Create guilt-free ice cream alternatives' },
      { title: 'Vitamix Cleaning Tips', description: 'Keep your blender in perfect condition' },
      { title: 'Soup Recipes', description: 'Hot, creamy soups in minutes' },
    ],
    images_ready: true,
  };
}
