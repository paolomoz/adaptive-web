/**
 * AI Hero Block
 * Dynamic hero section with realtime image updates
 */

import { subscribeToPage } from '../../scripts/supabase-client.js';

/**
 * Decorate the AI hero block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('ai-hero');

  // Extract content from block rows
  const rows = [...block.children];
  let imageUrl = '';
  let imagePrompt = '';
  let title = '';
  let subtitle = '';
  let ctaText = '';

  rows.forEach((row) => {
    const content = row.innerHTML.trim();

    // Check for image
    const img = row.querySelector('img');
    if (img) {
      imageUrl = img.src;
      imagePrompt = img.dataset.prompt || '';
      return;
    }

    // Check for heading
    const h1 = row.querySelector('h1');
    if (h1) {
      title = h1.textContent;
      return;
    }

    // Check for button/link
    const button = row.querySelector('a.button, button');
    if (button) {
      ctaText = button.textContent;
      return;
    }

    // Check for paragraph (subtitle)
    const p = row.querySelector('p');
    if (p) {
      subtitle = p.textContent;
    }
  });

  // Clear block and rebuild
  block.textContent = '';

  // Create hero structure
  const heroContent = document.createElement('div');
  heroContent.className = 'ai-hero-content';

  // Background image container
  const imageContainer = document.createElement('div');
  imageContainer.className = 'ai-hero-image';

  if (imageUrl && !imageUrl.includes('placeholder')) {
    const picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = title || 'Hero image';
    img.loading = 'eager';
    picture.appendChild(img);
    imageContainer.appendChild(picture);
  } else {
    // Show skeleton loading state
    imageContainer.classList.add('skeleton');
    imageContainer.dataset.prompt = imagePrompt;
  }

  // Text overlay
  const textOverlay = document.createElement('div');
  textOverlay.className = 'ai-hero-text';

  if (title) {
    const h1 = document.createElement('h1');
    h1.textContent = title;
    textOverlay.appendChild(h1);
  }

  if (subtitle) {
    const p = document.createElement('p');
    p.textContent = subtitle;
    textOverlay.appendChild(p);
  }

  if (ctaText) {
    const button = document.createElement('a');
    button.href = '#';
    button.className = 'button';
    button.textContent = ctaText;
    textOverlay.appendChild(button);
  }

  heroContent.appendChild(imageContainer);
  heroContent.appendChild(textOverlay);
  block.appendChild(heroContent);

  // Set up realtime subscription for image updates
  const pageId = new URLSearchParams(window.location.search).get('id');
  if (pageId && imageContainer.classList.contains('skeleton')) {
    subscribeToPage(pageId, (updatedPage) => {
      if (updatedPage.hero?.image_url) {
        // Remove skeleton and add image
        imageContainer.classList.remove('skeleton');
        const picture = document.createElement('picture');
        const img = document.createElement('img');
        img.src = updatedPage.hero.image_url;
        img.alt = title || 'Hero image';
        img.loading = 'eager';

        // Fade in animation
        img.style.opacity = '0';
        img.onload = () => {
          img.style.transition = 'opacity 0.5s ease';
          img.style.opacity = '1';
        };

        picture.appendChild(img);
        imageContainer.appendChild(picture);
      }
    });
  }
}
