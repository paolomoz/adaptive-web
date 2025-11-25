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
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
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

  // Render search bar
  const searchSection = renderSearchBar();
  container.appendChild(searchSection);

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

  // Render search bar
  const searchSection = renderSearchBar({
    placeholder: 'What would you like to explore?',
  });
  container.appendChild(searchSection);

  // Hero welcome section
  const welcomeSection = createSection();
  const welcomeWrapper = welcomeSection.querySelector('div');
  welcomeWrapper.innerHTML = `
    <div class="homepage-welcome">
      <h1>Discover Your Perfect Vitamix</h1>
      <p>Explore blenders, recipes, and blending techniques tailored to your interests. What would you like to make today?</p>
    </div>
  `;
  container.appendChild(welcomeSection);

  // Render suggestions
  const suggestionsSection = renderHomepageSuggestions(suggestedTopics);
  container.appendChild(suggestionsSection);
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
