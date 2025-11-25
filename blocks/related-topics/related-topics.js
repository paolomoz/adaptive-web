/**
 * Related Topics Block
 * Suggested topics for continued exploration
 */

import { navigateToQuery } from '../../scripts/router.js';

/**
 * Decorate the related topics block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('related-topics');

  // Extract topics from block rows
  const rows = [...block.children];
  const topics = rows.map((row) => {
    const cols = [...row.children];
    const topic = { title: '', description: '' };

    cols.forEach((col) => {
      // Check for heading
      const h3 = col.querySelector('h3');
      if (h3) {
        topic.title = h3.textContent;
        return;
      }

      // Get description
      const p = col.querySelector('p');
      if (p) {
        topic.description = p.textContent;
      } else {
        const text = col.textContent.trim();
        if (text && !topic.description) {
          topic.description = text;
        }
      }
    });

    return topic;
  }).filter((topic) => topic.title);

  // Clear block and rebuild
  block.textContent = '';

  // Create topics grid
  const grid = document.createElement('div');
  grid.className = 'related-topics-grid';

  topics.forEach((topic) => {
    const card = document.createElement('button');
    card.className = 'related-topic-card';
    card.type = 'button';

    const content = document.createElement('div');
    content.className = 'related-topic-content';

    const h3 = document.createElement('h3');
    h3.textContent = topic.title;
    content.appendChild(h3);

    if (topic.description) {
      const p = document.createElement('p');
      p.textContent = topic.description;
      content.appendChild(p);
    }

    // Arrow icon
    const arrow = document.createElement('span');
    arrow.className = 'related-topic-arrow';
    arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14"></path>
      <path d="m12 5 7 7-7 7"></path>
    </svg>`;

    card.appendChild(content);
    card.appendChild(arrow);

    // Click handler - navigate to new search
    card.addEventListener('click', () => {
      navigateToQuery(topic.title);
    });

    grid.appendChild(card);
  });

  block.appendChild(grid);
}
