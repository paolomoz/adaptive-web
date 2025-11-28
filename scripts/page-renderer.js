/**
 * Page Renderer for AdaptiveWeb
 * Dynamically builds page structure from AI-generated content
 */

/**
 * Create a section wrapper
 * @param {string} className - Optional class name
 * @returns {Element} Section element
 */
function createSection(className = '') {
  const section = document.createElement('div');
  section.className = `section ${className}`.trim();
  const wrapper = document.createElement('div');
  section.appendChild(wrapper);
  return section;
}

/**
 * Render the search bar section
 * @param {object} options - Render options
 * @returns {Element} Section element
 */
export function renderSearchBar(options = {}) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const placeholder = options.placeholder || 'What would you like to explore?';

  wrapper.innerHTML = `
    <div class="search-bar block" data-block-name="search-bar">
      <div class="search-container">
        <span class="search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </span>
        <input type="text" placeholder="${placeholder}" aria-label="Search query">
        <button type="submit" disabled>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
            <path d="M20 3v4"></path>
            <path d="M22 5h-4"></path>
            <path d="M4 17v2"></path>
            <path d="M5 18H3"></path>
          </svg>
          <span>Explore</span>
        </button>
      </div>
    </div>
  `;

  // Add interactivity
  const input = wrapper.querySelector('input');
  const button = wrapper.querySelector('button');

  input.addEventListener('input', () => {
    button.disabled = !input.value.trim();
  });

  const handleSubmit = () => {
    const query = input.value.trim();
    if (query) {
      // Import dynamically to avoid circular dependency
      import('./router.js').then(({ navigateToQuery }) => {
        navigateToQuery(query);
      });
    }
  };

  button.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });

  return section;
}

/**
 * Render the AI hero section
 * @param {object} heroData - Hero content from API
 * @returns {Element} Section element
 */
export function renderAiHero(heroData) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const imageUrl = heroData.image_url || '';
  const hasImage = imageUrl && !imageUrl.includes('placeholder');

  wrapper.innerHTML = `
    <div class="ai-hero block" data-block-name="ai-hero">
      <div class="ai-hero-content">
        <div class="ai-hero-image ${hasImage ? '' : 'skeleton'}">
          ${hasImage ? `<img src="${imageUrl}" alt="${heroData.title || 'Hero image'}" loading="eager">` : ''}
        </div>
        <div class="ai-hero-text">
          ${heroData.title ? `<h1>${heroData.title}</h1>` : ''}
          ${heroData.subtitle ? `<p>${heroData.subtitle}</p>` : ''}
          ${heroData.cta_text ? `<a href="#" class="button">${heroData.cta_text}</a>` : ''}
        </div>
      </div>
    </div>
  `;

  return section;
}

/**
 * Render the AI content section
 * @param {object} bodyData - Body content from API
 * @returns {Element} Section element
 */
export function renderAiContent(bodyData) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const paragraphs = bodyData.paragraphs || [];

  wrapper.innerHTML = `
    <div class="ai-content block" data-block-name="ai-content">
      <div class="ai-content-body">
        ${paragraphs.map((p) => `<p>${p}</p>`).join('')}
        ${bodyData.cta_text ? `<div class="ai-content-cta"><a href="#" class="button">${bodyData.cta_text}</a></div>` : ''}
      </div>
    </div>
  `;

  return section;
}

/**
 * Render the feature cards section
 * @param {Array} features - Feature cards from API
 * @param {string} title - Section title
 * @returns {Element} Section element
 */
export function renderFeatureCards(features, title = 'Featured') {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const cardsHtml = features.map((feature) => {
    const imageUrl = feature.image_url || '';
    const hasImage = imageUrl && !imageUrl.includes('placeholder');

    return `
      <div class="feature-card">
        <div class="feature-card-image ${hasImage ? '' : 'skeleton'}">
          ${hasImage ? `<img src="${imageUrl}" alt="${feature.title || 'Feature image'}" loading="lazy">` : ''}
        </div>
        <div class="feature-card-body">
          ${feature.title ? `<h3>${feature.title}</h3>` : ''}
          ${feature.description ? `<p>${feature.description}</p>` : ''}
          ${feature.cta_text ? `<a href="#" class="button">${feature.cta_text}</a>` : ''}
        </div>
      </div>
    `;
  }).join('');

  wrapper.innerHTML = `
    <h2>${title}</h2>
    <div class="feature-cards block" data-block-name="feature-cards">
      <div class="feature-cards-grid">
        ${cardsHtml}
      </div>
    </div>
  `;

  return section;
}

/**
 * Render the FAQ accordion section
 * @param {Array} faqs - FAQ items from API
 * @returns {Element} Section element
 */
export function renderFaqAccordion(faqs) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const faqsHtml = faqs.map((faq, index) => `
    <div class="faq-item">
      <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${index}">
        <span>${faq.question}</span>
        <svg class="faq-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="faq-answer" id="faq-answer-${index}" aria-hidden="true">
        <div class="faq-answer-content">
          <p>${faq.answer}</p>
        </div>
      </div>
    </div>
  `).join('');

  wrapper.innerHTML = `
    <h2>Frequently Asked Questions</h2>
    <div class="faq-accordion block" data-block-name="faq-accordion">
      <div class="faq-list">
        ${faqsHtml}
      </div>
      <button class="button secondary faq-ask-button">Ask Another Question</button>
    </div>
  `;

  // Add accordion interactivity
  wrapper.querySelectorAll('.faq-question').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      // Close all
      wrapper.querySelectorAll('.faq-item.open').forEach((openItem) => {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        openItem.querySelector('.faq-answer').setAttribute('aria-hidden', 'true');
      });

      // Toggle current
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        item.querySelector('.faq-answer').setAttribute('aria-hidden', 'false');
      }
    });
  });

  return section;
}

/**
 * Render the CTA section
 * @param {object} ctaData - CTA content from API
 * @returns {Element} Section element
 */
export function renderCtaSection(ctaData) {
  const section = createSection('highlight');
  const wrapper = section.querySelector('div');

  const buttons = ctaData.buttons || [];
  const buttonsHtml = buttons.map((btn) => {
    const btnClass = btn.style === 'secondary' ? 'button secondary' : 'button';
    return `<a href="#" class="${btnClass}">${btn.text}</a>`;
  }).join('');

  wrapper.innerHTML = `
    <div class="cta-section block" data-block-name="cta-section">
      <div class="cta-container">
        ${ctaData.title ? `<h2>${ctaData.title}</h2>` : ''}
        ${ctaData.description ? `<p>${ctaData.description}</p>` : ''}
        ${buttonsHtml ? `<div class="cta-buttons">${buttonsHtml}</div>` : ''}
      </div>
    </div>
  `;

  return section;
}

/**
 * Render the related topics section
 * @param {Array} related - Related topic suggestions
 * @returns {Element} Section element
 */
export function renderRelatedTopics(related) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const topicsHtml = related.map((topic) => `
    <button class="related-topic-card" type="button" data-query="${topic.title}">
      <div class="related-topic-content">
        <h3>${topic.title}</h3>
        ${topic.description ? `<p>${topic.description}</p>` : ''}
      </div>
      <span class="related-topic-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>
      </span>
    </button>
  `).join('');

  wrapper.innerHTML = `
    <h3>Continue exploring</h3>
    <div class="related-topics block" data-block-name="related-topics">
      <div class="related-topics-grid">
        ${topicsHtml}
      </div>
    </div>
  `;

  // Add click handlers
  wrapper.querySelectorAll('.related-topic-card').forEach((card) => {
    card.addEventListener('click', () => {
      const query = card.dataset.query;
      import('./router.js').then(({ navigateToQuery }) => {
        navigateToQuery(query);
      });
    });
  });

  return section;
}

/**
 * Render homepage suggestions
 * @param {Array} topics - Suggested topics
 * @returns {Element} Section element
 */
export function renderHomepageSuggestions(topics) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  // Default topics if none provided
  const defaultTopics = [
    { title: 'Ascent Series Blenders', description: 'Premium smart blending with wireless connectivity', query: 'Ascent Series Blenders' },
    { title: 'Green Smoothie Recipes', description: 'Nutrient-packed smoothies for energy and wellness', query: 'Green Smoothie Recipes' },
    { title: 'Hot Soup Recipes', description: 'Create restaurant-quality soups in minutes', query: 'Hot Soup Recipes' },
    { title: 'Self-Cleaning Your Vitamix', description: 'Clean your blender in 60 seconds', query: 'Self-Cleaning Your Vitamix' },
  ];

  const displayTopics = topics && topics.length > 0 ? topics : defaultTopics;

  const topicsHtml = displayTopics.map((topic) => `
    <button class="suggestion-card" type="button" data-query="${topic.query || topic.title}">
      <div class="suggestion-content">
        <h3>${topic.title}</h3>
        ${topic.description ? `<p>${topic.description}</p>` : ''}
      </div>
      <span class="suggestion-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>
      </span>
    </button>
  `).join('');

  wrapper.innerHTML = `
    <h3>Start exploring</h3>
    <div class="homepage-suggestions block" data-block-name="homepage-suggestions">
      <div class="suggestions-grid">
        ${topicsHtml}
      </div>
    </div>
  `;

  // Add click handlers
  wrapper.querySelectorAll('.suggestion-card').forEach((card) => {
    card.addEventListener('click', () => {
      const query = card.dataset.query;
      import('./router.js').then(({ navigateToQuery }) => {
        navigateToQuery(query);
      });
    });
  });

  return section;
}

/**
 * Render a complete generated page
 * @param {object} pageData - Full page data from API
 * @param {Element} container - Container element (main)
 */
export async function renderGeneratedPage(pageData, container) {
  // Clear existing content
  container.innerHTML = '';

  // Render hero
  if (pageData.hero) {
    const heroSection = renderAiHero(pageData.hero);
    container.appendChild(heroSection);
  }

  // Render body content
  if (pageData.body && pageData.body.paragraphs?.length) {
    const bodySection = renderAiContent(pageData.body);
    container.appendChild(bodySection);
  }

  // Render feature cards
  if (pageData.features?.length) {
    const title = pageData.content_type === 'recipe' ? 'Featured Recipes' : 'Featured';
    const featuresSection = renderFeatureCards(pageData.features, title);
    container.appendChild(featuresSection);
  }

  // Render FAQ
  if (pageData.faqs?.length) {
    const faqSection = renderFaqAccordion(pageData.faqs);
    container.appendChild(faqSection);
  }

  // Render CTA
  if (pageData.cta && pageData.cta.title) {
    const ctaSection = renderCtaSection(pageData.cta);
    container.appendChild(ctaSection);
  }

  // Render related topics
  if (pageData.related?.length) {
    const relatedSection = renderRelatedTopics(pageData.related);
    container.appendChild(relatedSection);
  }
}

/**
 * Render the homepage
 * @param {Array} suggestedTopics - Topics for homepage
 * @param {Element} container - Container element (main)
 */
export async function renderHomepage(suggestedTopics, container) {
  // Clear existing content
  container.innerHTML = '';

  // Add homepage class for styling
  container.classList.add('homepage');

  // Default topics if none provided
  const defaultTopics = [
    { title: 'Ascent Series Blenders', description: 'Premium smart blending with wireless connectivity', query: 'Ascent Series Blenders' },
    { title: 'Green Smoothie Recipes', description: 'Nutrient-packed smoothies for energy and wellness', query: 'Green Smoothie Recipes' },
    { title: 'Hot Soup Recipes', description: 'Create restaurant-quality soups in minutes', query: 'Hot Soup Recipes' },
    { title: 'Self-Cleaning Your Vitamix', description: 'Clean your blender in 60 seconds', query: 'Self-Cleaning Your Vitamix' },
  ];

  const displayTopics = suggestedTopics && suggestedTopics.length > 0 ? suggestedTopics : defaultTopics;

  // Video background hero section with search bar and suggestions
  const heroSection = document.createElement('div');
  heroSection.className = 'homepage-hero';
  heroSection.innerHTML = `
    <video class="homepage-hero-video" autoplay muted loop playsinline aria-hidden="true">
      <source src="https://player.vimeo.com/progressive_redirect/playback/742715169/rendition/1080p/file.mp4?loc=external&signature=af88564d33ef1f252232f6f7448a3939c80664afacb4a865588b5d1bb4fc9bfe" type="video/mp4">
    </video>
    <div class="homepage-hero-overlay"></div>
    <div class="homepage-hero-content">
      <h1>Discover Your Perfect Vitamix</h1>
      <p>Explore blenders, recipes, and blending techniques tailored to your interests.</p>
      <form class="homepage-search-form">
        <div class="homepage-search-container">
          <input type="text" placeholder="What would you like to explore?" aria-label="Search query">
          <button type="submit">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
              <path d="M20 3v4"></path>
              <path d="M22 5h-4"></path>
              <path d="M4 17v2"></path>
              <path d="M5 18H3"></path>
            </svg>
            <span>Explore</span>
          </button>
        </div>
      </form>
      <div class="homepage-suggestions">
        <span class="suggestions-label">Or try:</span>
        <div class="suggestions-chips">
          ${displayTopics.map((topic) => `<button class="suggestion-chip" type="button" data-query="${topic.query || topic.title}">${topic.title}</button>`).join('')}
        </div>
      </div>
    </div>
  `;
  container.appendChild(heroSection);

  // Add search form handler
  const searchForm = heroSection.querySelector('.homepage-search-form');
  const searchInput = heroSection.querySelector('.homepage-search-container input');
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      import('./router.js').then(({ navigateToQuery }) => {
        navigateToQuery(query);
      });
    }
  });

  // Add click handlers for suggestion chips
  heroSection.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const query = chip.dataset.query;
      import('./router.js').then(({ navigateToQuery }) => {
        navigateToQuery(query);
      });
    });
  });

}

/**
 * Render loading state
 * @param {Element} container - Container element
 */
export function renderLoading(container) {
  container.innerHTML = `
    <div class="section">
      <div>
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Generating your personalized content...</p>
          <p class="loading-subtext">This may take up to 30 seconds</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render error state
 * @param {Element} container - Container element
 * @param {string} message - Error message
 */
export function renderError(container, message) {
  container.innerHTML = `
    <div class="section">
      <div>
        <div class="error-state">
          <h2>Something went wrong</h2>
          <p>${message}</p>
          <a href="/" class="button">Return to Homepage</a>
        </div>
      </div>
    </div>
  `;
}

// =========================================================
// FLEXIBLE PIPELINE RENDERERS (for content atoms + layout blocks)
// =========================================================

/**
 * Get atom by type from content atoms array
 * @param {Array} atoms - Content atoms
 * @param {string} type - Atom type to find
 * @returns {object|null} Found atom or null
 */
function getAtom(atoms, type) {
  return atoms.find((a) => a.type === type) || null;
}

/**
 * Get all atoms of a specific type
 * @param {Array} atoms - Content atoms
 * @param {string} type - Atom type to find
 * @returns {Array} Matching atoms
 */
function getAtoms(atoms, type) {
  return atoms.filter((a) => a.type === type);
}

/**
 * Render hero-banner block from content atoms
 */
function renderHeroBannerBlock(atoms, metadata) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const heading = getAtom(atoms, 'heading');
  const paragraph = getAtom(atoms, 'paragraph');
  const imageUrl = metadata?.image_url || '';
  const hasImage = imageUrl && !imageUrl.includes('placeholder');

  wrapper.innerHTML = `
    <div class="ai-hero block" data-block-name="ai-hero">
      <div class="ai-hero-content">
        <div class="ai-hero-image ${hasImage ? '' : 'skeleton'}">
          ${hasImage ? `<img src="${imageUrl}" alt="${heading?.text || 'Hero image'}" loading="eager">` : ''}
        </div>
        <div class="ai-hero-text">
          ${heading ? `<h1>${heading.text}</h1>` : ''}
          ${paragraph ? `<p>${paragraph.text}</p>` : ''}
        </div>
      </div>
    </div>
  `;

  return section;
}

/**
 * Render text-section block from content atoms
 */
function renderTextSectionBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const paragraphs = getAtoms(atoms, 'paragraph');
  if (paragraphs.length === 0) return null;

  wrapper.innerHTML = `
    <div class="text-section block" data-block-name="text-section">
      <div class="text-section-container">
        <div class="text-section-content">
          ${paragraphs.map((p) => `<p>${p.text}</p>`).join('')}
        </div>
      </div>
    </div>
  `;

  return section;
}

/**
 * Render comparison-table block from content atoms
 * Creates a horizontal table layout with columns for Model, Series, Price, etc.
 */
function renderComparisonTableBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const comparison = getAtom(atoms, 'comparison');
  if (!comparison?.items?.length) return null;

  const products = comparison.items;

  // Define the column headers we want to display
  // These map to common spec keys from Claude's comparison atom
  const columns = [
    { key: 'model', label: 'Model', type: 'model' },
    { key: 'series', label: 'Series', type: 'text' },
    { key: 'price', label: 'Price (MSRP)', type: 'price' },
    { key: 'container', label: 'Container', type: 'text' },
    { key: 'warranty', label: 'Warranty', type: 'warranty' },
    { key: 'presets', label: 'Presets', type: 'text' },
    { key: 'hp', label: 'HP', type: 'text' },
    { key: 'smart', label: 'Smart/Detect', type: 'smart' },
  ];

  // Helper to get spec value with fallbacks for different key formats
  const getSpecValue = (product, key) => {
    if (!product.specs) return null;
    // Try exact key first
    if (product.specs[key] !== undefined) return product.specs[key];
    // Try capitalized version
    const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
    if (product.specs[capitalized] !== undefined) return product.specs[capitalized];
    // Try common aliases
    const aliases = {
      price: ['Price', 'MSRP', 'price_msrp', 'retail_price'],
      series: ['Series', 'Product Line', 'line'],
      container: ['Container', 'Container Size', 'container_size'],
      warranty: ['Warranty', 'warranty_years', 'Warranty Years'],
      presets: ['Presets', 'Programs', 'preset_count'],
      hp: ['HP', 'Horsepower', 'Motor', 'motor_hp'],
      smart: ['Smart', 'Smart Detect', 'smart_detect', 'Self-Detect'],
    };
    for (const alias of aliases[key] || []) {
      if (product.specs[alias] !== undefined) return product.specs[alias];
    }
    return null;
  };

  // Render warranty badge with color coding
  const renderWarranty = (value) => {
    if (!value) return '-';
    const years = parseInt(value, 10);
    let className = '';
    if (years >= 10) className = 'warranty-10';
    else if (years >= 7) className = 'warranty-7';
    else if (years >= 5) className = 'warranty-5';
    return `<span class="comparison-warranty ${className}">${years} Years</span>`;
  };

  // Render smart/detect indicator with checkmark or X
  const renderSmart = (value) => {
    const isYes = value === true || value === 'Yes' || value === 'yes' || value === '✓';
    const svgCheck = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    const svgX = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    return `<span class="comparison-smart ${isYes ? 'smart-yes' : 'smart-no'}">${isYes ? svgCheck : svgX}</span>`;
  };

  // Render price with formatting
  const renderPrice = (value) => {
    if (!value) return '-';
    // If it's already formatted with $, use it
    if (typeof value === 'string' && value.includes('$')) {
      return `<span class="comparison-price">${value}</span>`;
    }
    // Format as currency
    const num = parseFloat(value);
    if (isNaN(num)) return `<span class="comparison-price">${value}</span>`;
    return `<span class="comparison-price">$${num.toLocaleString()}</span>`;
  };

  // Render cell based on column type
  const renderCell = (product, column) => {
    const value = column.key === 'model' ? product.name : getSpecValue(product, column.key);

    switch (column.type) {
      case 'model':
        return `
          <div class="comparison-model-cell">
            <div class="comparison-model-image">
              ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ''}
            </div>
            <span class="comparison-model-name">${product.name}</span>
          </div>
        `;
      case 'warranty':
        return renderWarranty(value);
      case 'smart':
        return renderSmart(value);
      case 'price':
        return renderPrice(value);
      case 'text':
      default:
        return value ? `<span class="comparison-series">${value}</span>` : '-';
    }
  };

  // Build table header
  const headerHtml = columns.map((col) => `<th>${col.label}</th>`).join('');

  // Build table rows
  const rowsHtml = products.map((product) => `
    <tr>
      ${columns.map((col) => `<td>${renderCell(product, col)}</td>`).join('')}
    </tr>
  `).join('');

  wrapper.innerHTML = `
    <div class="comparison-table block" data-block-name="comparison-table">
      <div class="comparison-table-container">
        <table class="comparison-table-grid">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return section;
}

/**
 * Render comparison-cards block from content atoms
 * Creates a card grid for model selection with compare overlay
 */
function renderComparisonCardsBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const comparison = getAtom(atoms, 'comparison');
  if (!comparison?.items?.length) return null;

  const products = comparison.items;

  // Get unique series for filter pills
  const seriesSet = new Set();
  products.forEach((p) => {
    const series = p.specs?.series || p.specs?.Series || '';
    if (series) seriesSet.add(series);
  });
  const seriesList = [...seriesSet];

  // SVG icons
  const starIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  const wifiIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';
  const compareIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>';
  const closeIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  // Helper to get spec value with flexible key aliases
  const getSpec = (product, key) => {
    if (!product.specs) return null;
    const aliases = {
      series: ['series', 'Series', 'Product Line', 'product_line'],
      price: ['price', 'Price', 'MSRP', 'msrp'],
      container: ['container', 'Container', 'Container Size', 'container_size'],
      warranty: ['warranty', 'Warranty', 'warranty_years', 'Warranty Years'],
      hp: ['hp', 'HP', 'Motor', 'motor_hp', 'motor', 'Motor Power'],
      smart: ['smart', 'Smart', 'Smart Detect', 'Self-Detect', 'self_detect', 'smart_detect'],
      rating: ['rating', 'Rating', 'stars'],
      presets: ['presets', 'Presets', 'Programs', 'programs', 'Program Count'],
      interface: ['interface', 'Interface', 'controls', 'Controls'],
    };
    for (const alias of aliases[key] || [key]) {
      if (product.specs[alias] !== undefined) return product.specs[alias];
    }
    // Also check top-level product properties
    if (product[key] !== undefined) return product[key];
    return null;
  };

  // Format price
  const formatPrice = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && value.includes('$')) return value;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return `$${num.toLocaleString()}`;
  };

  // Check if smart
  const isSmart = (product) => {
    const val = getSpec(product, 'smart');
    return val === true || val === 'Yes' || val === 'yes';
  };

  // Build filter pills HTML
  const filtersHtml = seriesList.length > 0 ? `
    <div class="comparison-cards-filters">
      <button class="filter-pill active" data-filter="all">All</button>
      ${seriesList.map((s) => `<button class="filter-pill" data-filter="${s}">${s}</button>`).join('')}
    </div>
  ` : '';

  // Build cards HTML
  const cardsHtml = products.map((product, index) => {
    const series = getSpec(product, 'series') || '';
    const price = formatPrice(getSpec(product, 'price'));
    const rating = getSpec(product, 'rating') || '';
    const smart = isSmart(product);

    return `
      <div class="comparison-card" data-index="${index}" data-series="${series}">
        ${smart ? `<div class="card-smart-badge">${wifiIcon} Smart</div>` : ''}
        ${product.best_value ? '<div class="card-value-badge">Best Value</div>' : ''}
        <div class="card-image">
          ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ''}
        </div>
        <div class="card-info">
          <h3 class="card-name">${product.name}</h3>
          ${rating ? `<div class="card-rating">${starIcon} ${rating}</div>` : ''}
        </div>
        ${series ? `<p class="card-series">${series}</p>` : ''}
        ${product.description ? `<p class="card-description">${product.description}</p>` : ''}
        <div class="card-footer">
          ${price ? `<span class="card-price">${price}</span>` : ''}
          <label class="card-compare-checkbox">
            <input type="checkbox" data-index="${index}">
            Compare
          </label>
        </div>
      </div>
    `;
  }).join('');

  // Build compare bar HTML
  const compareBarHtml = `
    <div class="compare-bar" id="compare-bar">
      <div class="compare-bar-left">
        <span class="compare-bar-label">Comparing:</span>
        <div class="compare-bar-thumbnails" id="compare-thumbnails"></div>
        <span class="compare-bar-count" id="compare-count">0 selected</span>
      </div>
      <div class="compare-bar-right">
        <button class="compare-bar-clear" id="compare-clear">Clear</button>
        <button class="compare-bar-button" id="compare-now">
          Compare Now ${compareIcon}
        </button>
      </div>
    </div>
  `;

  // Build compare overlay HTML
  const overlayHtml = `
    <div class="compare-overlay" id="compare-overlay">
      <div class="compare-modal">
        <div class="compare-modal-header">
          <h3>Model Comparison</h3>
          <button class="compare-modal-close" id="compare-close">${closeIcon}</button>
        </div>
        <div class="compare-modal-body" id="compare-body"></div>
      </div>
    </div>
  `;

  wrapper.innerHTML = `
    <div class="comparison-cards block" data-block-name="comparison-cards">
      <div class="comparison-cards-header">
        <div>
          <h2>Current Models</h2>
          <p>Select models to compare details side-by-side.</p>
        </div>
        ${filtersHtml}
      </div>
      <div class="comparison-cards-grid">
        ${cardsHtml}
      </div>
    </div>
    ${compareBarHtml}
    ${overlayHtml}
  `;

  // Initialize comparison functionality after DOM is ready
  setTimeout(() => initComparisonCards(wrapper, products), 0);

  return section;
}

/**
 * Initialize comparison cards interactivity
 */
function initComparisonCards(container, products) {
  const cards = container.querySelectorAll('.comparison-card');
  const checkboxes = container.querySelectorAll('.card-compare-checkbox input');
  const compareBar = container.querySelector('#compare-bar');
  const thumbnailsContainer = container.querySelector('#compare-thumbnails');
  const countEl = container.querySelector('#compare-count');
  const clearBtn = container.querySelector('#compare-clear');
  const compareBtn = container.querySelector('#compare-now');
  const overlay = container.querySelector('#compare-overlay');
  const closeBtn = container.querySelector('#compare-close');
  const compareBody = container.querySelector('#compare-body');
  const filterPills = container.querySelectorAll('.filter-pill');

  let selected = [];

  // Helper to get spec value with flexible key aliases
  const getSpec = (product, key) => {
    if (!product.specs) return null;
    const aliases = {
      series: ['series', 'Series', 'Product Line', 'product_line'],
      price: ['price', 'Price', 'MSRP', 'msrp'],
      container: ['container', 'Container', 'Container Size', 'container_size'],
      warranty: ['warranty', 'Warranty', 'warranty_years', 'Warranty Years'],
      hp: ['hp', 'HP', 'Motor', 'motor_hp', 'motor', 'Motor Power'],
      smart: ['smart', 'Smart', 'Smart Detect', 'Self-Detect', 'self_detect', 'smart_detect'],
      presets: ['presets', 'Presets', 'Programs', 'programs', 'Program Count'],
      interface: ['interface', 'Interface', 'controls', 'Controls'],
    };
    for (const alias of aliases[key] || [key]) {
      if (product.specs[alias] !== undefined) return product.specs[alias];
    }
    // Also check top-level product properties
    if (product[key] !== undefined) return product[key];
    return null;
  };

  // Format price
  const formatPrice = (value) => {
    if (!value) return '-';
    if (typeof value === 'string' && value.includes('$')) return value;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return `$${num.toLocaleString()}`;
  };

  // Update compare bar
  const updateCompareBar = () => {
    if (selected.length > 0) {
      compareBar.classList.add('visible');
      countEl.textContent = `${selected.length} selected`;

      // Update thumbnails
      thumbnailsContainer.innerHTML = selected.map((idx) => {
        const product = products[idx];
        return `
          <div class="compare-bar-thumb">
            ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ''}
          </div>
        `;
      }).join('');
    } else {
      compareBar.classList.remove('visible');
    }
  };

  // Toggle card selection
  const toggleSelection = (index) => {
    const idx = selected.indexOf(index);
    if (idx > -1) {
      selected.splice(idx, 1);
      cards[index].classList.remove('selected');
      checkboxes[index].checked = false;
    } else if (selected.length < 4) {
      selected.push(index);
      cards[index].classList.add('selected');
      checkboxes[index].checked = true;
    }
    updateCompareBar();
  };

  // Card click handlers
  cards.forEach((card, index) => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.card-compare-checkbox')) {
        toggleSelection(index);
      }
    });
  });

  // Checkbox handlers
  checkboxes.forEach((checkbox, index) => {
    checkbox.addEventListener('change', () => {
      toggleSelection(index);
    });
  });

  // Filter pills
  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.filter;

      cards.forEach((card) => {
        if (filter === 'all' || card.dataset.series === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    selected = [];
    cards.forEach((card) => card.classList.remove('selected'));
    checkboxes.forEach((cb) => { cb.checked = false; });
    updateCompareBar();
  });

  // Compare button - open overlay
  compareBtn.addEventListener('click', () => {
    if (selected.length < 2) return;

    const selectedProducts = selected.map((idx) => products[idx]);
    const count = selectedProducts.length;

    // Build comparison content
    const productsHtml = selectedProducts.map((product) => `
      <div class="compare-product">
        <div class="compare-product-image">
          ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ''}
        </div>
        <h4 class="compare-product-name">${product.name}</h4>
        <p class="compare-product-price">${formatPrice(getSpec(product, 'price'))}</p>
        ${product.url ? `<a href="${product.url}" class="compare-product-cta" target="_blank">View on Vitamix</a>` : ''}
      </div>
    `).join('');

    // Define specs to compare
    const specKeys = [
      { key: 'series', label: 'Series' },
      { key: 'container', label: 'Container' },
      { key: 'warranty', label: 'Warranty' },
      { key: 'hp', label: 'Motor HP' },
      { key: 'presets', label: 'Presets' },
    ];

    const specsHtml = specKeys.map((spec) => `
      <div class="compare-spec-row count-${count}">
        ${selectedProducts.map((product) => `
          <div class="compare-spec-cell">
            <div class="compare-spec-label">${spec.label}</div>
            <div class="compare-spec-value">${getSpec(product, spec.key) || '-'}</div>
          </div>
        `).join('')}
      </div>
    `).join('');

    compareBody.innerHTML = `
      <div class="compare-products count-${count}">
        ${productsHtml}
      </div>
      <div class="compare-specs">
        ${specsHtml}
      </div>
    `;

    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  });

  // Close overlay
  const closeOverlay = () => {
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  };

  closeBtn.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });
}

/**
 * Render specs-table block from content atoms
 */
function renderSpecsTableBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const table = getAtom(atoms, 'table');
  if (!table?.rows?.length) return null;

  const rowsHtml = table.rows.map((row, idx) => `
    <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
      <th scope="row">${row[0]}</th>
      <td>${row[1]}</td>
    </tr>
  `).join('');

  wrapper.innerHTML = `
    <div class="specs-table block" data-block-name="specs-table">
      <div class="specs-table-container">
        ${table.title ? `<h3 class="specs-table-title">${table.title}</h3>` : ''}
        <table class="specs-table-grid">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;

  return section;
}

/**
 * Render step-by-step block from content atoms
 */
function renderStepByStepBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const steps = getAtom(atoms, 'steps');
  if (!steps?.items?.length) return null;

  const stepsHtml = steps.items.map((step) => `
    <div class="step">
      <div class="step-number">${step.number}</div>
      <div class="step-content">
        <p class="step-instruction">${step.instruction}</p>
        ${step.tip ? `
          <div class="step-tip">
            <span class="tip-icon">\uD83D\uDCA1</span>
            <span>${step.tip}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  wrapper.innerHTML = `
    <h2>Instructions</h2>
    <div class="step-by-step block" data-block-name="step-by-step">
      <div class="steps-container">
        ${stepsHtml}
      </div>
    </div>
  `;

  return section;
}

/**
 * Render feature-cards block from content atoms
 */
function renderFeatureCardsBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const featureSet = getAtom(atoms, 'feature_set');
  if (!featureSet?.items?.length) return null;

  const cardsHtml = featureSet.items.map((feature) => {
    const imageUrl = feature.image_url || '';
    const hasImage = imageUrl && !imageUrl.includes('placeholder');

    return `
      <div class="feature-card">
        <div class="feature-card-image ${hasImage ? '' : 'skeleton'}">
          ${hasImage ? `<img src="${imageUrl}" alt="${feature.title || 'Feature image'}" loading="lazy">` : ''}
        </div>
        <div class="feature-card-body">
          ${feature.title ? `<h3>${feature.title}</h3>` : ''}
          ${feature.description ? `<p>${feature.description}</p>` : ''}
          ${feature.cta_text ? `<a href="#" class="button">${feature.cta_text}</a>` : ''}
        </div>
      </div>
    `;
  }).join('');

  wrapper.innerHTML = `
    <h2>Featured</h2>
    <div class="feature-cards block" data-block-name="feature-cards">
      <div class="feature-cards-grid">
        ${cardsHtml}
      </div>
    </div>
  `;

  return section;
}

/**
 * Render faq-accordion block from content atoms
 */
function renderFaqAccordionBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const faqSet = getAtom(atoms, 'faq_set');
  if (!faqSet?.items?.length) return null;

  const faqsHtml = faqSet.items.map((faq, index) => `
    <div class="faq-item">
      <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${index}">
        <span>${faq.question}</span>
        <svg class="faq-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="faq-answer" id="faq-answer-${index}" aria-hidden="true">
        <div class="faq-answer-content">
          <p>${faq.answer}</p>
        </div>
      </div>
    </div>
  `).join('');

  wrapper.innerHTML = `
    <h2>Frequently Asked Questions</h2>
    <div class="faq-accordion block" data-block-name="faq-accordion">
      <div class="faq-list">
        ${faqsHtml}
      </div>
    </div>
  `;

  // Add accordion interactivity
  wrapper.querySelectorAll('.faq-question').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      wrapper.querySelectorAll('.faq-item.open').forEach((openItem) => {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        openItem.querySelector('.faq-answer').setAttribute('aria-hidden', 'true');
      });

      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        item.querySelector('.faq-answer').setAttribute('aria-hidden', 'false');
      }
    });
  });

  return section;
}

/**
 * Render cta-section block from content atoms
 */
function renderCtaSectionBlock(atoms) {
  const section = createSection('highlight');
  const wrapper = section.querySelector('div');

  const cta = getAtom(atoms, 'cta');
  if (!cta) return null;

  const buttons = cta.buttons || [];
  const buttonsHtml = buttons.map((btn) => {
    const btnClass = btn.style === 'secondary' ? 'button secondary' : 'button';
    return `<a href="#" class="${btnClass}">${btn.text}</a>`;
  }).join('');

  wrapper.innerHTML = `
    <div class="cta-section block" data-block-name="cta-section">
      <div class="cta-container">
        ${cta.title ? `<h2>${cta.title}</h2>` : ''}
        ${cta.description ? `<p>${cta.description}</p>` : ''}
        ${buttonsHtml ? `<div class="cta-buttons">${buttonsHtml}</div>` : ''}
      </div>
    </div>
  `;

  return section;
}

/**
 * Render related-topics block from content atoms
 */
function renderRelatedTopicsBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const related = getAtom(atoms, 'related');
  if (!related?.items?.length) return null;

  const topicsHtml = related.items.map((topic) => `
    <button class="related-topic-card" type="button" data-query="${topic.title}">
      <div class="related-topic-content">
        <h3>${topic.title}</h3>
        ${topic.description ? `<p>${topic.description}</p>` : ''}
      </div>
      <span class="related-topic-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>
      </span>
    </button>
  `).join('');

  wrapper.innerHTML = `
    <h3>Continue exploring</h3>
    <div class="related-topics block" data-block-name="related-topics">
      <div class="related-topics-grid">
        ${topicsHtml}
      </div>
    </div>
  `;

  // Add click handlers
  wrapper.querySelectorAll('.related-topic-card').forEach((card) => {
    card.addEventListener('click', () => {
      const query = card.dataset.query;
      import('./router.js').then(({ navigateToQuery }) => {
        navigateToQuery(query);
      });
    });
  });

  return section;
}

/**
 * Render bullet-list block from content atoms
 */
function renderBulletListBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const list = getAtom(atoms, 'list');
  if (!list?.items?.length) return null;

  const listStyle = list.style === 'numbered' ? 'ol' : 'ul';
  const itemsHtml = list.items.map((item) => `<li>${item}</li>`).join('');

  wrapper.innerHTML = `
    <div class="bullet-list block" data-block-name="bullet-list">
      <${listStyle} class="bullet-list-items">
        ${itemsHtml}
      </${listStyle}>
    </div>
  `;

  return section;
}

/**
 * Render interactive-guide block from content atoms
 * Tab-based product selection with comparison overlay
 */
function renderInteractiveGuideBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const guide = getAtom(atoms, 'interactive_guide');
  if (!guide?.picks?.length) return null;

  const picks = guide.picks;
  const title = guide.title || 'Find Your Perfect Match';
  const subtitle = guide.subtitle || 'Select your priority to see our top recommendation';

  // SVG icons
  const checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
  const compareIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>';
  const closeIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const starIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

  // Helper to get spec value with flexible key aliases
  const getSpec = (product, key) => {
    if (!product.specs) return null;
    const aliases = {
      series: ['series', 'Series', 'Product Line', 'product_line'],
      price: ['price', 'Price', 'MSRP', 'msrp'],
      container: ['container', 'Container', 'Container Size', 'container_size'],
      warranty: ['warranty', 'Warranty', 'warranty_years', 'Warranty Years'],
      hp: ['hp', 'HP', 'Motor', 'motor_hp', 'motor', 'Motor Power'],
      presets: ['presets', 'Presets', 'Programs', 'programs', 'Program Count'],
      interface: ['interface', 'Interface', 'controls', 'Controls'],
    };
    for (const alias of aliases[key] || [key]) {
      if (product.specs[alias] !== undefined) return product.specs[alias];
    }
    return null;
  };

  // Format price
  const formatPrice = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && value.includes('$')) return value;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return `$${num.toLocaleString()}`;
  };

  // Build tabs HTML
  const tabsHtml = picks.map((pick, index) => `
    <button class="guide-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
      ${pick.tab_icon ? `<span class="tab-icon">${pick.tab_icon}</span>` : ''}
      ${pick.tab_label}
    </button>
  `).join('');

  // Build product cards HTML
  const cardsHtml = picks.map((pick, index) => {
    const product = pick.product;
    const price = formatPrice(getSpec(product, 'price') || product.price);
    const series = getSpec(product, 'series') || product.series || '';

    // Build specs grid
    const specsHtml = Object.entries(product.specs || {}).slice(0, 6).map(([key, value]) => `
      <div class="guide-spec-item">
        <div class="guide-spec-label">${key}</div>
        <div class="guide-spec-value">${value}</div>
      </div>
    `).join('');

    // Build pros/cons
    const prosHtml = (pick.pros || []).map((pro) => `<li>${pro}</li>`).join('');
    const consHtml = (pick.cons || []).map((con) => `<li>${con}</li>`).join('');

    return `
      <div class="guide-product-card ${index === 0 ? 'active' : ''}" data-index="${index}">
        <div class="guide-product-image">
          ${pick.badge ? `<div class="guide-product-badge ${pick.badge_style || ''}">${pick.badge}</div>` : ''}
          ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ''}
        </div>
        <div class="guide-product-details">
          <h3 class="guide-product-name">${product.name}</h3>
          ${series ? `<p class="guide-product-series">${series}</p>` : ''}
          ${product.rating ? `
            <div class="guide-product-rating">
              ${starIcon}${starIcon}${starIcon}${starIcon}${starIcon}
              <span>${product.rating}</span>
            </div>
          ` : ''}
          ${price ? `<p class="guide-product-price">${price}</p>` : ''}
          ${product.description ? `<p class="guide-product-description">${product.description}</p>` : ''}

          ${specsHtml ? `<div class="guide-product-specs">${specsHtml}</div>` : ''}

          ${(prosHtml || consHtml) ? `
            <div class="guide-pros-cons">
              ${prosHtml ? `
                <div class="guide-pros">
                  <h4>${checkIcon} Why it's a winner</h4>
                  <ul>${prosHtml}</ul>
                </div>
              ` : ''}
              ${consHtml ? `
                <div class="guide-cons">
                  <h4>Things to consider</h4>
                  <ul>${consHtml}</ul>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="guide-product-actions">
            ${product.url ? `<a href="${product.url}" class="button primary" target="_blank">View Official Price</a>` : ''}
            <button class="button secondary guide-learn-more">Learn More</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Build comparison table for overlay
  const buildComparisonTable = () => {
    // Collect all unique spec keys
    const allSpecs = new Set();
    picks.forEach((pick) => {
      Object.keys(pick.product.specs || {}).forEach((key) => allSpecs.add(key));
    });
    const specKeys = [...allSpecs];

    // Product header row
    const productHeaders = picks.map((pick) => {
      const product = pick.product;
      const price = formatPrice(getSpec(product, 'price') || product.price);
      return `
        <th class="guide-compare-product-header">
          ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ''}
          <div class="product-name">${product.name}</div>
          ${price ? `<div class="product-price">${price}</div>` : ''}
        </th>
      `;
    }).join('');

    // Spec rows
    const specRows = specKeys.map((key) => {
      const cells = picks.map((pick) => {
        const value = pick.product.specs?.[key];
        if (value === true || value === 'Yes' || value === 'yes') {
          return `<td><span class="guide-compare-check">${checkIcon}</span></td>`;
        }
        if (value === false || value === 'No' || value === 'no') {
          return '<td><span class="guide-compare-x">-</span></td>';
        }
        return `<td>${value || '-'}</td>`;
      }).join('');
      return `<tr><td>${key}</td>${cells}</tr>`;
    }).join('');

    return `
      <table class="guide-compare-table">
        <thead>
          <tr>
            <th>Feature</th>
            ${productHeaders}
          </tr>
        </thead>
        <tbody>
          ${specRows}
        </tbody>
      </table>
    `;
  };

  wrapper.innerHTML = `
    <div class="interactive-guide block" data-block-name="interactive-guide">
      <div class="interactive-guide-header">
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>

      <div class="guide-tabs">
        ${tabsHtml}
      </div>

      <div class="guide-product-container">
        ${cardsHtml}
      </div>

      <div class="guide-compare-bar">
        <button class="guide-compare-all-btn">
          ${compareIcon}
          Compare All ${picks.length} Models
        </button>
      </div>
    </div>

    <div class="guide-compare-overlay" id="guide-compare-overlay">
      <div class="guide-compare-modal">
        <div class="guide-compare-modal-header">
          <h3>Compare Top Models</h3>
          <button class="guide-compare-modal-close" id="guide-compare-close">${closeIcon}</button>
        </div>
        <div class="guide-compare-modal-body">
          ${buildComparisonTable()}
        </div>
      </div>
    </div>
  `;

  // Initialize interactivity after DOM is ready
  setTimeout(() => initInteractiveGuide(wrapper), 0);

  return section;
}

/**
 * Initialize interactive guide interactivity
 */
function initInteractiveGuide(container) {
  const tabs = container.querySelectorAll('.guide-tab');
  const cards = container.querySelectorAll('.guide-product-card');
  const compareBtn = container.querySelector('.guide-compare-all-btn');
  const overlay = container.querySelector('#guide-compare-overlay');
  const closeBtn = container.querySelector('#guide-compare-close');

  // Tab switching
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const index = tab.dataset.index;

      // Update active tab
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active card
      cards.forEach((c) => c.classList.remove('active'));
      const targetCard = container.querySelector(`.guide-product-card[data-index="${index}"]`);
      if (targetCard) targetCard.classList.add('active');
    });
  });

  // Compare overlay
  if (compareBtn && overlay) {
    compareBtn.addEventListener('click', () => {
      overlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
    });

    const closeOverlay = () => {
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
  }

  // Learn more buttons - navigate to product query
  container.querySelectorAll('.guide-learn-more').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.guide-product-card');
      const productName = card.querySelector('.guide-product-name')?.textContent;
      if (productName) {
        import('./router.js').then(({ navigateToQuery }) => {
          navigateToQuery(productName);
        });
      }
    });
  });
}

/**
 * Render product-detail block from content atoms
 * Comprehensive single product page with gallery, specs, features
 */
function renderProductDetailBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const productAtom = getAtom(atoms, 'product_detail');
  if (!productAtom) return null;

  const data = productAtom;

  // Check if image URL is valid (generated) or needs generation
  const imageUrl = data.image_url || '';
  const hasImage = imageUrl.startsWith('http') && !imageUrl.includes('vitamix.com');

  // Format price helper
  const formatPrice = (price) => {
    if (!price) return 'Price unavailable';
    if (typeof price === 'string' && price.startsWith('$')) return price;
    if (typeof price === 'number') return `$${price.toFixed(2)}`;
    return price;
  };

  // Format spec key helper
  const formatSpecKey = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Build the HTML
  const html = `
    <div class="product-detail block" data-block-name="product-detail" data-product='${JSON.stringify(data).replace(/'/g, '&#39;')}'>
      <div class="product-hero">
        <div class="product-gallery">
          <div class="product-image-main ${hasImage ? '' : 'skeleton'}">
            ${hasImage ? `<img src="${imageUrl}" alt="${data.name}" loading="eager">` : ''}
          </div>
        </div>

        <div class="product-info">
          ${data.series ? `<div class="product-meta"><span class="product-series">${data.series}</span></div>` : ''}

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
            ${data.related_products.map((p) => {
              const hasRelatedImage = p.image_url && p.image_url.startsWith('http') && !p.image_url.includes('vitamix.com');
              return `
              <div class="related-product" data-query="${p.query || p.name}">
                <div class="related-product-image ${hasRelatedImage ? '' : 'skeleton'}">
                  ${hasRelatedImage ? `<img src="${p.image_url}" alt="${p.name}">` : ''}
                </div>
                <h3>${p.name}</h3>
                ${p.description ? `<p class="related-description">${p.description}</p>` : ''}
              </div>
            `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  wrapper.innerHTML = html;

  // Initialize accordion
  const accordionToggle = wrapper.querySelector('.accordion-toggle');
  if (accordionToggle) {
    accordionToggle.addEventListener('click', () => {
      const expanded = accordionToggle.getAttribute('aria-expanded') === 'true';
      accordionToggle.setAttribute('aria-expanded', !expanded);
      const content = accordionToggle.nextElementSibling;
      if (content) {
        content.style.display = expanded ? 'none' : 'block';
      }
    });
  }

  // Initialize gallery
  if (data.gallery && data.gallery.length > 1) {
    const mainImage = wrapper.querySelector('.product-image-main img');
    const thumbnails = wrapper.querySelectorAll('.thumbnail');
    thumbnails.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const index = parseInt(thumb.dataset.index, 10);
        mainImage.src = data.gallery[index];
        thumbnails.forEach((t) => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  }

  // Add click handlers for related products
  wrapper.querySelectorAll('.related-product').forEach((card) => {
    card.addEventListener('click', () => {
      const query = card.dataset.query;
      if (query) {
        import('./router.js').then(({ navigateToQuery }) => {
          navigateToQuery(query);
        });
      }
    });
  });

  return section;
}

/**
 * Render recipe-detail block from content atoms
 * Comprehensive single recipe page with ingredients, directions, nutrition
 */
function renderRecipeDetailBlock(atoms) {
  const section = createSection();
  const wrapper = section.querySelector('div');

  const recipeAtom = getAtom(atoms, 'recipe_detail');
  if (!recipeAtom) return null;

  const data = recipeAtom;

  // Check if image URL is a prompt (needs generation) or actual URL
  const imageUrl = data.image_url || '';
  const hasImage = imageUrl.startsWith('http') || imageUrl.startsWith('/');

  // Build the recipe detail layout
  const html = `
    <div class="recipe-detail block" data-block-name="recipe-detail" data-recipe='${JSON.stringify(data).replace(/'/g, '&#39;')}'>
      <div class="recipe-hero">
        <div class="recipe-hero-inner">
          <div class="recipe-image ${hasImage ? '' : 'skeleton'}">
            ${hasImage ? `<img src="${imageUrl}" alt="${data.name}" loading="eager">` : ''}
          </div>
          <div class="recipe-header">
            <h1 class="recipe-title">${data.name}</h1>

            ${data.description ? `<p class="recipe-description">${data.description}</p>` : ''}

            <div class="recipe-meta">
              ${data.total_time ? `
                <div class="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span class="meta-label">Total Time</span>
                  <span class="meta-value">${data.total_time}</span>
                </div>
              ` : ''}
              ${data.servings ? `
                <div class="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  <span class="meta-label">Yield</span>
                  <span class="meta-value">${data.servings}</span>
                </div>
              ` : ''}
              ${data.difficulty ? `
                <div class="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  <span class="meta-label">Difficulty</span>
                  <span class="meta-value">${data.difficulty}</span>
                </div>
              ` : ''}
            </div>

          </div>
        </div>
      </div>

      <div class="recipe-content-wrapper">
        <div class="recipe-content">
          <div class="recipe-sidebar">
            ${data.nutrition ? `
              <div class="nutrition-card">
                <h3>Nutrition</h3>
                <p class="serving-info">${data.nutrition.serving_size || '1 serving'}</p>
                <div class="nutrition-list">
                  ${data.nutrition.calories ? `
                    <div class="nutrition-row primary">
                      <span class="nutrition-label">Calories</span>
                      <span class="nutrition-value">${data.nutrition.calories}</span>
                    </div>
                  ` : ''}
                  ${data.nutrition.fat ? `
                    <div class="nutrition-row">
                      <span class="nutrition-label">Total Fat</span>
                      <span class="nutrition-value">${data.nutrition.fat}</span>
                    </div>
                  ` : ''}
                  ${data.nutrition.carbs ? `
                    <div class="nutrition-row">
                      <span class="nutrition-label">Total Carbohydrate</span>
                      <span class="nutrition-value">${data.nutrition.carbs}</span>
                    </div>
                  ` : ''}
                  ${data.nutrition.fiber ? `
                    <div class="nutrition-row">
                      <span class="nutrition-label">Dietary Fiber</span>
                      <span class="nutrition-value">${data.nutrition.fiber}</span>
                    </div>
                  ` : ''}
                  ${data.nutrition.sugar ? `
                    <div class="nutrition-row">
                      <span class="nutrition-label">Sugars</span>
                      <span class="nutrition-value">${data.nutrition.sugar}</span>
                    </div>
                  ` : ''}
                  ${data.nutrition.protein ? `
                    <div class="nutrition-row">
                      <span class="nutrition-label">Protein</span>
                      <span class="nutrition-value">${data.nutrition.protein}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            ${data.equipment && data.equipment.length > 0 ? `
              <div class="equipment-card">
                <h3>Equipment Needed</h3>
                <ul>
                  ${data.equipment.map((item) => `<li>${item}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>

          <div class="recipe-main">
            ${data.ingredients && data.ingredients.length > 0 ? `
              <div class="recipe-section ingredients-section">
                <h2>Ingredients</h2>
                <ul class="ingredients-list">
                  ${data.ingredients.map((ing) => `
                    <li>
                      <span class="ingredient-bullet"></span>
                      <span class="ingredient-text">
                        ${ing.amount ? `<span class="ingredient-amount">${ing.amount}</span> ` : ''}${ing.name || ing}
                      </span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            <div class="recipe-section directions-section">
              <h2>Directions</h2>
              <ol class="directions-list">
                ${data.steps && data.steps.length > 0 ? data.steps.map((step, i) => `
                  <li>
                    <span class="step-number">${i + 1}</span>
                    <div class="step-content">
                      <p class="step-instruction">${step.instruction || step}</p>
                      ${step.tip ? `
                        <div class="step-tip">
                          <span class="tip-icon">i</span>
                          <span>${step.tip}</span>
                        </div>
                      ` : ''}
                    </div>
                  </li>
                `).join('') : '<li>No instructions available</li>'}
              </ol>
            </div>

          </div>
        </div>

        ${data.chef_notes ? `
          <div class="chef-notes-section">
            <h2>Chef's Notes</h2>
            <p>${data.chef_notes}</p>
          </div>
        ` : ''}

        ${data.related_recipes && data.related_recipes.length > 0 ? `
          <div class="recipe-section related-recipes-section">
            <h2>You Might Also Like</h2>
            <div class="related-grid">
              ${data.related_recipes.map((r) => {
                const hasImage = r.image_url && (r.image_url.startsWith('http') || r.image_url.startsWith('/'));
                return `
                <div class="related-recipe" data-query="${r.query || r.name}">
                  <div class="related-image ${hasImage ? '' : 'skeleton'}">
                    ${hasImage ? `<img src="${r.image_url}" alt="${r.name}">` : ''}
                  </div>
                  <h3>${r.name}</h3>
                  ${r.description ? `<p>${r.description}</p>` : ''}
                </div>
              `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  wrapper.innerHTML = html;

  // Add click handlers for related recipes
  wrapper.querySelectorAll('.related-recipe').forEach((card) => {
    card.addEventListener('click', () => {
      const query = card.dataset.query;
      if (query) {
        import('./router.js').then(({ navigateToQuery }) => {
          navigateToQuery(query);
        });
      }
    });
  });

  // Setup tab functionality
  const tabs = wrapper.querySelectorAll('.recipe-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  return section;
}

/**
 * Block renderer map for flexible pipeline
 */
const BLOCK_RENDERERS = {
  'hero-banner': renderHeroBannerBlock,
  'text-section': renderTextSectionBlock,
  'comparison-table': renderComparisonTableBlock,
  'comparison-cards': renderComparisonCardsBlock,
  'specs-table': renderSpecsTableBlock,
  'step-by-step': renderStepByStepBlock,
  'feature-cards': renderFeatureCardsBlock,
  'faq-accordion': renderFaqAccordionBlock,
  'cta-section': renderCtaSectionBlock,
  'related-topics': renderRelatedTopicsBlock,
  'bullet-list': renderBulletListBlock,
  'interactive-guide': renderInteractiveGuideBlock,
  'product-detail': renderProductDetailBlock,
  'recipe-detail': renderRecipeDetailBlock,
};

/**
 * Render a page using the flexible pipeline (content atoms + layout blocks)
 * @param {object} pageData - Page data from flexible pipeline
 * @param {Element} container - Container element (main)
 */
export async function renderFlexiblePage(pageData, container) {
  container.innerHTML = '';

  const atoms = pageData.content_atoms || [];
  const blocks = pageData.layout_blocks || [];
  const metadata = pageData.metadata || {};

  // Render each block in order
  for (const block of blocks) {
    const renderer = BLOCK_RENDERERS[block.block_type];
    if (renderer) {
      const sectionEl = renderer(atoms, metadata);
      if (sectionEl) {
        container.appendChild(sectionEl);
      }
    } else {
      console.warn(`No renderer for block type: ${block.block_type}`);
    }
  }
}

/**
 * Update images in an already-rendered page when they become available
 * Called via realtime subscription when images are generated
 * @param {object} pageData - Updated page data with image URLs
 * @param {Element} container - Container element (main)
 */
export function updatePageImages(pageData, container) {
  // Detect if this is flexible pipeline (has content_atoms) or legacy (has hero)
  const isFlexible = pageData.content_atoms && pageData.layout_blocks;

  if (isFlexible) {
    // Flexible pipeline: update hero from metadata.image_url
    if (pageData.metadata?.image_url) {
      const heroImg = container.querySelector('.ai-hero-image');
      if (heroImg && heroImg.classList.contains('skeleton')) {
        const heading = pageData.content_atoms.find((a) => a.type === 'heading');
        heroImg.innerHTML = `<img src="${pageData.metadata.image_url}" alt="${heading?.text || 'Hero image'}" loading="eager">`;
        heroImg.classList.remove('skeleton');
      }
    }

    // Flexible pipeline: update feature images from content_atoms
    const featureSet = pageData.content_atoms?.find((a) => a.type === 'feature_set');
    if (featureSet?.items?.length) {
      const featureCards = container.querySelectorAll('.feature-card');
      featureSet.items.forEach((feature, index) => {
        if (feature.image_url && featureCards[index]) {
          const imgContainer = featureCards[index].querySelector('.feature-card-image');
          if (imgContainer && imgContainer.classList.contains('skeleton')) {
            imgContainer.innerHTML = `<img src="${feature.image_url}" alt="${feature.title || 'Feature image'}" loading="lazy">`;
            imgContainer.classList.remove('skeleton');
          }
        }
      });
    }

    // Flexible pipeline: update recipe_detail images
    const recipeDetail = pageData.content_atoms?.find((a) => a.type === 'recipe_detail');
    if (recipeDetail?.image_url) {
      const recipeImg = container.querySelector('.recipe-image');
      if (recipeImg && recipeImg.classList.contains('skeleton')) {
        recipeImg.innerHTML = `<img src="${recipeDetail.image_url}" alt="${recipeDetail.name || 'Recipe image'}" loading="eager">`;
        recipeImg.classList.remove('skeleton');
      }
    }

    // Flexible pipeline: update product_detail images
    const productDetail = pageData.content_atoms?.find((a) => a.type === 'product_detail');
    if (productDetail?.image_url) {
      const productImg = container.querySelector('.product-image-main');
      if (productImg && productImg.classList.contains('skeleton')) {
        productImg.innerHTML = `<img src="${productDetail.image_url}" alt="${productDetail.name || 'Product image'}" loading="eager">`;
        productImg.classList.remove('skeleton');
      }
    }

    // Flexible pipeline: update related product images
    if (productDetail?.related_products?.length) {
      const relatedProducts = container.querySelectorAll('.related-product');
      productDetail.related_products.forEach((product, index) => {
        if (product.image_url && relatedProducts[index]) {
          const imgContainer = relatedProducts[index].querySelector('.related-product-image');
          if (imgContainer && imgContainer.classList.contains('skeleton')) {
            imgContainer.innerHTML = `<img src="${product.image_url}" alt="${product.name || 'Related product'}" loading="lazy">`;
            imgContainer.classList.remove('skeleton');
          }
        }
      });
    }

    // Flexible pipeline: update related recipe images
    if (recipeDetail?.related_recipes?.length) {
      const relatedCards = container.querySelectorAll('.related-recipe');
      recipeDetail.related_recipes.forEach((recipe, index) => {
        if (recipe.image_url && relatedCards[index]) {
          const imgContainer = relatedCards[index].querySelector('.related-image');
          if (imgContainer && imgContainer.classList.contains('skeleton')) {
            imgContainer.innerHTML = `<img src="${recipe.image_url}" alt="${recipe.name || 'Related recipe'}" loading="lazy">`;
            imgContainer.classList.remove('skeleton');
          }
        }
      });
    }
  } else {
    // Legacy pipeline: update hero from pageData.hero
    if (pageData.hero?.image_url) {
      const heroImg = container.querySelector('.ai-hero-image');
      if (heroImg && heroImg.classList.contains('skeleton')) {
        heroImg.innerHTML = `<img src="${pageData.hero.image_url}" alt="${pageData.hero.title || 'Hero image'}" loading="eager">`;
        heroImg.classList.remove('skeleton');
      }
    }

    // Legacy pipeline: update feature card images
    if (pageData.features?.length) {
      const featureCards = container.querySelectorAll('.feature-card');
      pageData.features.forEach((feature, index) => {
        if (feature.image_url && featureCards[index]) {
          const imgContainer = featureCards[index].querySelector('.feature-card-image');
          if (imgContainer && imgContainer.classList.contains('skeleton')) {
            imgContainer.innerHTML = `<img src="${feature.image_url}" alt="${feature.title || 'Feature image'}" loading="lazy">`;
            imgContainer.classList.remove('skeleton');
          }
        }
      });
    }
  }
}
