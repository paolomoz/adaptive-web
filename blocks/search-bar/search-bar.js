/**
 * Search Bar Block
 * Main search input for AdaptiveWeb
 */

import { navigateToQuery } from '../../scripts/router.js';

/**
 * Decorate the search bar block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  // Get placeholder from block content or use default
  const placeholder = block.textContent.trim() || 'What would you like to explore?';

  // Clear block and build search UI
  block.textContent = '';
  block.classList.add('search-bar');

  // Create search container
  const container = document.createElement('div');
  container.className = 'search-container';

  // Search icon
  const icon = document.createElement('span');
  icon.className = 'search-icon';
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>`;

  // Input field
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', 'Search query');

  // Submit button
  const button = document.createElement('button');
  button.type = 'submit';
  button.disabled = true;
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
  <span>Explore</span>`;

  // Enable/disable button based on input
  input.addEventListener('input', () => {
    button.disabled = !input.value.trim();
  });

  // Handle form submission
  const handleSubmit = (e) => {
    e?.preventDefault();
    const query = input.value.trim();
    if (query) {
      // Add loading state
      button.disabled = true;
      button.innerHTML = `<span class="loading-dots">...</span>`;

      // Navigate to query (triggers generation)
      navigateToQuery(query);
    }
  };

  // Submit on button click
  button.addEventListener('click', handleSubmit);

  // Submit on Enter key
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  });

  // Assemble container
  container.appendChild(icon);
  container.appendChild(input);
  container.appendChild(button);

  block.appendChild(container);

  // Focus input when block is loaded
  setTimeout(() => input.focus(), 100);
}
