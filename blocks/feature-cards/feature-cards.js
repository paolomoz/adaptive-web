/**
 * Feature Cards Block
 * 3-column grid of recipe/product cards
 */

import { subscribeToPage } from '../../scripts/supabase-client.js';

/**
 * Decorate the feature cards block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('feature-cards');

  // Extract cards from block rows
  const rows = [...block.children];
  const cards = rows.map((row) => {
    const cols = [...row.children];
    const card = {
      imageUrl: '',
      imagePrompt: '',
      title: '',
      description: '',
      ctaText: '',
    };

    cols.forEach((col) => {
      // Check for image
      const img = col.querySelector('img');
      if (img) {
        card.imageUrl = img.src;
        card.imagePrompt = img.dataset.prompt || '';
        return;
      }

      // Check for heading
      const h3 = col.querySelector('h3');
      if (h3) {
        card.title = h3.textContent;
        return;
      }

      // Check for button
      const button = col.querySelector('a.button, a');
      if (button) {
        card.ctaText = button.textContent;
        return;
      }

      // Check for paragraph (description)
      const p = col.querySelector('p');
      if (p) {
        card.description = p.textContent;
      } else {
        const text = col.textContent.trim();
        if (text && !card.description) {
          card.description = text;
        }
      }
    });

    return card;
  });

  // Clear block and rebuild
  block.textContent = '';

  // Create cards grid
  const grid = document.createElement('div');
  grid.className = 'feature-cards-grid';

  cards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'feature-card';
    cardEl.dataset.index = index;

    // Image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'feature-card-image';

    if (card.imageUrl && !card.imageUrl.includes('placeholder')) {
      const img = document.createElement('img');
      img.src = card.imageUrl;
      img.alt = card.title || 'Feature image';
      img.loading = 'lazy';
      imageContainer.appendChild(img);
    } else {
      // Skeleton loading state
      imageContainer.classList.add('skeleton');
      imageContainer.dataset.prompt = card.imagePrompt;
    }

    // Card body
    const body = document.createElement('div');
    body.className = 'feature-card-body';

    if (card.title) {
      const h3 = document.createElement('h3');
      h3.textContent = card.title;
      body.appendChild(h3);
    }

    if (card.description) {
      const p = document.createElement('p');
      p.textContent = card.description;
      body.appendChild(p);
    }

    if (card.ctaText) {
      const button = document.createElement('a');
      button.href = '#';
      button.className = 'button';
      button.textContent = card.ctaText;
      body.appendChild(button);
    }

    cardEl.appendChild(imageContainer);
    cardEl.appendChild(body);
    grid.appendChild(cardEl);
  });

  block.appendChild(grid);

  // Set up realtime subscription for image updates
  const pageId = new URLSearchParams(window.location.search).get('id');
  if (pageId) {
    const skeletonImages = block.querySelectorAll('.feature-card-image.skeleton');
    if (skeletonImages.length > 0) {
      subscribeToPage(pageId, (updatedPage) => {
        if (updatedPage.features?.length) {
          updatedPage.features.forEach((feature, idx) => {
            if (feature.image_url) {
              const cardEl = block.querySelector(`.feature-card[data-index="${idx}"]`);
              if (cardEl) {
                const imageContainer = cardEl.querySelector('.feature-card-image');
                if (imageContainer?.classList.contains('skeleton')) {
                  imageContainer.classList.remove('skeleton');

                  const img = document.createElement('img');
                  img.src = feature.image_url;
                  img.alt = feature.title || 'Feature image';
                  img.loading = 'lazy';

                  // Fade in
                  img.style.opacity = '0';
                  img.onload = () => {
                    img.style.transition = 'opacity 0.5s ease';
                    img.style.opacity = '1';
                  };

                  imageContainer.appendChild(img);
                }
              }
            }
          });
        }
      });
    }
  }
}
