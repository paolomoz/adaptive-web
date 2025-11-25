/**
 * Homepage Suggestions Block
 * Suggested topics for the landing page
 */

import { navigateToQuery } from '../../scripts/router.js';
import { getSuggestedTopics } from '../../scripts/supabase-client.js';

// Default suggestions if database is empty
const DEFAULT_SUGGESTIONS = [
  {
    title: 'Ascent Series Blenders',
    description: 'Premium smart blending with wireless connectivity',
    query: 'Ascent Series Blenders',
  },
  {
    title: 'Green Smoothie Recipes',
    description: 'Nutrient-packed smoothies for energy and wellness',
    query: 'Green Smoothie Recipes',
  },
  {
    title: 'Hot Soup Recipes',
    description: 'Create restaurant-quality soups in minutes',
    query: 'Hot Soup Recipes',
  },
  {
    title: 'Self-Cleaning Your Vitamix',
    description: 'Clean your blender in 60 seconds',
    query: 'Self-Cleaning Your Vitamix',
  },
];

/**
 * Decorate the homepage suggestions block
 * @param {Element} block - The block element
 */
export default async function decorate(block) {
  block.classList.add('homepage-suggestions');

  // Try to load suggestions from database, fall back to defaults
  let suggestions = [];
  try {
    suggestions = await getSuggestedTopics();
    if (!suggestions || suggestions.length === 0) {
      suggestions = DEFAULT_SUGGESTIONS;
    }
  } catch (error) {
    console.warn('Failed to load suggestions, using defaults:', error);
    suggestions = DEFAULT_SUGGESTIONS;
  }

  // Clear block and rebuild
  block.textContent = '';

  // Create suggestions grid
  const grid = document.createElement('div');
  grid.className = 'suggestions-grid';

  suggestions.forEach((topic) => {
    const card = document.createElement('button');
    card.className = 'suggestion-card';
    card.type = 'button';

    card.innerHTML = `
      <div class="suggestion-content">
        <h3>${topic.title}</h3>
        <p>${topic.description}</p>
      </div>
      <span class="suggestion-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>
      </span>
    `;

    // Click handler - navigate to search
    card.addEventListener('click', () => {
      navigateToQuery(topic.query || topic.title);
    });

    grid.appendChild(card);
  });

  block.appendChild(grid);
}
