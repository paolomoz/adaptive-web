/**
 * Product Detail Block
 * Comprehensive product page layout inspired by Vitamix.com
 * Data sourced from RAG - displays real product information
 */

/**
 * Decorate the product-detail block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('product-detail');

  // Check if block is already rendered by page-renderer (has product-hero child)
  // Skip re-rendering to avoid flash
  if (block.querySelector('.product-hero')) {
    // Already rendered - just setup event handlers
    const existingData = block.dataset.product ? JSON.parse(block.dataset.product) : null;
    setupAccordion(block);
    if (existingData) {
      setupGallery(block, existingData);
    }
    return;
  }

  // Get product data from block's dataset (populated by renderer)
  const data = block.dataset.product ? JSON.parse(block.dataset.product) : null;

  if (!data) {
    block.innerHTML = '<p class="error">Product data not available</p>';
    return;
  }

  // Build the product detail layout
  const html = `
    <div class="product-hero">
      <div class="product-gallery">
        <div class="product-image-main">
          <img src="${data.image_url || '/icons/placeholder.svg'}" alt="${data.name}" loading="eager">
        </div>
        ${data.gallery && data.gallery.length > 1 ? `
          <div class="product-thumbnails">
            ${data.gallery.map((img, i) => `
              <button class="thumbnail ${i === 0 ? 'active' : ''}" data-index="${i}">
                <img src="${img}" alt="${data.name} view ${i + 1}">
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="product-info">
        <div class="product-meta">
          ${data.series ? `<span class="product-series">${data.series} Series</span>` : ''}
          ${data.rating ? `
            <div class="product-rating">
              <span class="stars">${renderStars(data.rating)}</span>
              <span class="rating-value">${data.rating}</span>
              ${data.review_count ? `<span class="review-count">(${data.review_count} reviews)</span>` : ''}
            </div>
          ` : ''}
        </div>

        <h1 class="product-title">${data.name}</h1>

        ${data.tagline ? `<p class="product-tagline">${data.tagline}</p>` : ''}

        <div class="product-price-section">
          <span class="product-price">${formatPrice(data.price)}</span>
          ${data.original_price && data.original_price > data.price ? `
            <span class="product-original-price">${formatPrice(data.original_price)}</span>
          ` : ''}
        </div>

        ${data.highlights && data.highlights.length > 0 ? `
          <ul class="product-highlights">
            ${data.highlights.map((h) => `<li>${h}</li>`).join('')}
          </ul>
        ` : ''}

        <div class="product-actions">
          ${data.url ? `
            <a href="${data.url}" class="button primary" target="_blank" rel="noopener">
              Shop Now
            </a>
          ` : ''}
          <button class="button secondary compare-btn">Compare Models</button>
        </div>

        <div class="product-warranty">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>${data.warranty || '10-Year Full Warranty'}</span>
        </div>
      </div>
    </div>

    ${data.description ? `
      <div class="product-description-section">
        <h2>About This Product</h2>
        <p>${data.description}</p>
      </div>
    ` : ''}

    ${data.features && data.features.length > 0 ? `
      <div class="product-features-section">
        <h2>Key Features</h2>
        <div class="features-grid">
          ${data.features.map((f) => `
            <div class="feature-item">
              ${f.icon ? `<span class="feature-icon">${f.icon}</span>` : ''}
              <h3>${f.title}</h3>
              <p>${f.description}</p>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${data.specs && Object.keys(data.specs).length > 0 ? `
      <div class="product-specs-section">
        <h2>Specifications</h2>
        <div class="specs-accordion">
          <button class="accordion-toggle" aria-expanded="true">
            <span>Technical Details</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="accordion-content">
            <table class="specs-table">
              <tbody>
                ${Object.entries(data.specs).map(([key, value]) => `
                  <tr>
                    <th>${formatSpecKey(key)}</th>
                    <td>${value}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ` : ''}

    ${data.whats_included && data.whats_included.length > 0 ? `
      <div class="product-included-section">
        <h2>What's Included</h2>
        <ul class="included-list">
          ${data.whats_included.map((item) => `
            <li>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              ${item}
            </li>
          `).join('')}
        </ul>
      </div>
    ` : ''}

    ${data.related_products && data.related_products.length > 0 ? `
      <div class="product-related-section">
        <h2>You Might Also Like</h2>
        <div class="related-grid">
          ${data.related_products.map((p) => `
            <div class="related-product">
              <img src="${p.image_url || '/icons/placeholder.svg'}" alt="${p.name}">
              <h3>${p.name}</h3>
              ${p.price ? `<span class="related-price">${formatPrice(p.price)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  block.innerHTML = html;

  // Add interactivity
  setupAccordion(block);
  setupGallery(block, data);
}

/**
 * Render star rating
 */
function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  let stars = '';

  for (let i = 0; i < 5; i += 1) {
    if (i < fullStars) {
      stars += '<span class="star full">★</span>';
    } else if (i === fullStars && hasHalf) {
      stars += '<span class="star half">★</span>';
    } else {
      stars += '<span class="star empty">☆</span>';
    }
  }

  return stars;
}

/**
 * Format price with currency
 */
function formatPrice(price) {
  if (typeof price === 'string' && price.startsWith('$')) return price;
  if (typeof price === 'number') return `$${price.toFixed(2)}`;
  return price || 'Price unavailable';
}

/**
 * Format spec key for display
 */
function formatSpecKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Setup accordion functionality
 */
function setupAccordion(block) {
  const toggles = block.querySelectorAll('.accordion-toggle');
  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !expanded);
      const content = toggle.nextElementSibling;
      if (content) {
        content.style.display = expanded ? 'none' : 'block';
      }
    });
  });
}

/**
 * Setup image gallery
 */
function setupGallery(block, data) {
  if (!data.gallery || data.gallery.length <= 1) return;

  const mainImage = block.querySelector('.product-image-main img');
  const thumbnails = block.querySelectorAll('.thumbnail');

  thumbnails.forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const index = parseInt(thumb.dataset.index, 10);
      mainImage.src = data.gallery[index];

      thumbnails.forEach((t) => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
}
