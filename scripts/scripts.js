import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

import { initRouter, getPageMode, getUrlParams, onPopState } from './router.js';
import { generatePage, getPage, generateImages, extractImagePrompts, isConfigured, isDemoMode, getMockPageData } from './api-client.js';
import {
  renderGeneratedPage,
  renderFlexiblePage,
  renderHomepage,
  renderLoading,
  renderProgressLoading,
  renderError,
  updatePageImages,
} from './page-renderer.js';
import { getSuggestedTopics } from './supabase-client.js';

/**
 * Check if page data uses the flexible pipeline (has layout_blocks)
 * @param {object} pageData - Page data from API
 * @returns {boolean} True if flexible pipeline
 */
function isFlexiblePipeline(pageData) {
  return pageData && Array.isArray(pageData.layout_blocks) && pageData.layout_blocks.length > 0;
}

/**
 * Render page using appropriate renderer based on pipeline type
 * @param {object} pageData - Page data from API
 * @param {Element} main - Main container element
 */
async function renderPage(pageData, main) {
  if (isFlexiblePipeline(pageData)) {
    await renderFlexiblePage(pageData, main);
  } else {
    await renderGeneratedPage(pageData, main);
  }
}

/**
 * Trigger image generation for a page and update the DOM when ready
 * @param {string} pageId - The page ID
 * @param {object} pageData - The page data with prompts
 * @param {Element} main - The main container element
 */
async function triggerImageGeneration(pageId, pageData, main) {
  // Don't generate in demo mode
  if (isDemoMode()) return;

  // Extract image prompts from page data
  const prompts = extractImagePromptsFromPage(pageData);

  if (prompts.length === 0) {
    console.log('[AdaptiveWeb] No image prompts to generate');
    return;
  }

  console.log(`[AdaptiveWeb] Generating ${prompts.length} images...`);

  try {
    // Call the generate-images API
    const result = await generateImages(pageId, prompts);

    if (result.success && result.images?.length > 0) {
      console.log(`[AdaptiveWeb] Generated ${result.images.length} images`);

      // Fetch updated page data and update DOM
      const updatedPage = await getPage(pageId);
      if (updatedPage) {
        updatePageImages(updatedPage, main);
      }
    }
  } catch (error) {
    console.error('[AdaptiveWeb] Image generation failed:', error);
  }
}

/**
 * Extract image prompts from page data for generation
 * @param {object} pageData - Page data with content_atoms
 * @returns {Array} Array of prompt objects
 */
function extractImagePromptsFromPage(pageData) {
  const prompts = [];

  // Hero image from metadata
  if (pageData.metadata?.primary_image_prompt && !pageData.metadata?.image_url?.startsWith('http')) {
    prompts.push({
      type: 'hero',
      prompt: pageData.metadata.primary_image_prompt,
    });
  }

  // Recipe detail image
  const recipeDetail = pageData.content_atoms?.find((a) => a.type === 'recipe_detail');
  if (recipeDetail) {
    const recipePrompt = recipeDetail.image_url && !recipeDetail.image_url.startsWith('http')
      ? recipeDetail.image_url
      : pageData.metadata?.primary_image_prompt;
    if (recipePrompt && !prompts.some((p) => p.type === 'recipe')) {
      prompts.push({
        type: 'recipe',
        prompt: recipePrompt,
      });
    }
  }

  // Product detail image
  const productDetail = pageData.content_atoms?.find((a) => a.type === 'product_detail');
  if (productDetail) {
    const productPrompt = productDetail.image_url && !productDetail.image_url.startsWith('http')
      ? productDetail.image_url
      : pageData.metadata?.primary_image_prompt;
    if (productPrompt && !prompts.some((p) => p.type === 'product')) {
      prompts.push({
        type: 'product',
        prompt: productPrompt,
      });
    }
  }

  // Feature images
  const featureSet = pageData.content_atoms?.find((a) => a.type === 'feature_set');
  if (featureSet?.items) {
    featureSet.items.forEach((item, index) => {
      if (item.image_prompt && !item.image_url?.startsWith('http')) {
        prompts.push({
          type: 'feature',
          index,
          prompt: item.image_prompt,
        });
      }
    });
  }

  // Related recipe images (from recipe_detail atom)
  if (recipeDetail?.related_recipes) {
    recipeDetail.related_recipes.forEach((recipe, index) => {
      if (recipe.image_prompt && !recipe.image_url?.startsWith('http')) {
        prompts.push({
          type: 'related_recipe',
          index,
          prompt: recipe.image_prompt,
        });
      }
    });
  }

  // Related product images (from product_detail atom)
  if (productDetail?.related_products) {
    productDetail.related_products.forEach((product, index) => {
      if (product.image_prompt && !product.image_url?.startsWith('http')) {
        prompts.push({
          type: 'related_product',
          index,
          prompt: product.image_prompt,
        });
      }
    });
  }

  return prompts;
}

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto block `*/fragments/*` references
    const fragments = main.querySelectorAll('a[href*="/fragments/"]');
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(frag.firstElementChild);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }

    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

/**
 * Check if current page is the adaptive app
 * @returns {boolean}
 */
function isAdaptiveApp() {
  // Check for URL parameters that indicate adaptive mode
  const { id, q } = getUrlParams();
  return id || q || window.location.pathname === '/';
}

/**
 * Handle adaptive page routing and rendering
 * @param {Element} main - Main content element
 */
async function handleAdaptivePage(main) {
  const mode = getPageMode();
  const params = getUrlParams();
  const demoMode = isDemoMode();

  // Log current state for debugging intermittent issues
  console.log('[AdaptiveWeb] handleAdaptivePage:', { mode, params, demoMode });

  try {
    switch (mode) {
      case 'generate': {
        // Show progress loading state immediately
        console.log('[AdaptiveWeb] Starting page generation for query:', params.q);
        const updateProgress = renderProgressLoading(main);

        // Generate new page (use mock data in demo mode)
        let pageData;
        if (demoMode) {
          // Simulate loading delay in demo mode
          await new Promise((resolve) => { setTimeout(resolve, 1500); });
          pageData = getMockPageData(params.q);
        } else {
          // Pass progress callback for real-time updates
          pageData = await generatePage(params.q, updateProgress);
        }

        // Render the generated content (auto-detects flexible vs legacy pipeline)
        await renderPage(pageData, main);

        // Trigger image generation if needed
        if (pageData?.id && !pageData.images_ready) {
          triggerImageGeneration(pageData.id, pageData, main);
        }
        break;
      }

      case 'view': {
        // Show loading state
        renderLoading(main);

        // Fetch existing page (use mock data in demo mode)
        let pageData;
        if (demoMode) {
          await new Promise((resolve) => { setTimeout(resolve, 500); });
          pageData = getMockPageData('Sample Page');
        } else {
          pageData = await getPage(params.id);
        }

        if (pageData) {
          await renderPage(pageData, main);

          // Trigger image generation if not ready
          if (pageData?.id && !pageData.images_ready) {
            triggerImageGeneration(pageData.id, pageData, main);
          }
        } else {
          renderError(main, 'Page not found');
        }
        break;
      }

      case 'homepage':
      default: {
        // Load suggested topics and render homepage
        console.log('[AdaptiveWeb] Rendering homepage (mode:', mode, ')');
        let topics = [];
        if (!demoMode) {
          try {
            topics = await getSuggestedTopics();
          } catch (e) {
            console.warn('[AdaptiveWeb] Failed to load suggested topics:', e);
            // Use defaults from homepage-suggestions block
          }
        }
        await renderHomepage(topics, main);
        break;
      }
    }
  } catch (error) {
    console.error('[AdaptiveWeb] Page error:', error);
    // Re-check params to see if we should have handled a query
    const currentParams = getUrlParams();
    if (currentParams.q || currentParams.id) {
      console.error('[AdaptiveWeb] Error occurred while handling query/id:', currentParams);
    }
    renderError(main, error.message || 'Something went wrong');
  }
}

/**
 * Extract context from a button's surrounding content
 * @param {Element} button - The clicked button element
 * @returns {string} Context string for page generation
 */
function extractButtonContext(button) {
  // Get the button text
  const buttonText = button.textContent.trim();

  // Find the containing block or section
  const block = button.closest('[data-block-name]');
  const section = button.closest('.section');

  // Extract context from the block/section
  let context = '';

  if (block) {
    // Get block name for context
    const blockName = block.dataset.blockName;

    // Extract relevant text from the block (headings, descriptions)
    const heading = block.querySelector('h1, h2, h3');
    const description = block.querySelector('p:not(:has(a.button))');

    if (heading) {
      context += heading.textContent.trim();
    }
    if (description) {
      context += ` - ${description.textContent.trim()}`;
    }

    // For specific blocks, extract more context
    if (blockName === 'comparison-cards' || blockName === 'comparison-table') {
      // For comparison, get the item name if clicking on a specific card
      const card = button.closest('.comparison-card, .comparison-item');
      if (card) {
        const itemName = card.querySelector('h3, .item-name, .card-title');
        if (itemName) {
          context = itemName.textContent.trim();
        }
      }
    } else if (blockName === 'feature-cards') {
      // Get the specific feature card context
      const card = button.closest('.feature-card');
      if (card) {
        const cardTitle = card.querySelector('h3, h4');
        const cardDesc = card.querySelector('p');
        context = cardTitle ? cardTitle.textContent.trim() : '';
        if (cardDesc) {
          context += ` - ${cardDesc.textContent.trim()}`;
        }
      }
    } else if (blockName === 'recipe-detail' || blockName === 'product-detail') {
      // Use the page title for detail pages
      const pageTitle = document.querySelector('.ai-hero h1, h1');
      if (pageTitle) {
        context = pageTitle.textContent.trim();
      }
    }
  }

  // If no block context, try section context
  if (!context && section) {
    const sectionHeading = section.querySelector('h1, h2, h3');
    if (sectionHeading) {
      context = sectionHeading.textContent.trim();
    }
  }

  // Build the query combining button text and context
  let query = buttonText;
  if (context && !buttonText.toLowerCase().includes(context.toLowerCase().slice(0, 20))) {
    query = `${buttonText}: ${context}`;
  }

  // Limit query length
  if (query.length > 200) {
    query = query.slice(0, 200);
  }

  return query;
}

/**
 * Set up global button click handler for adaptive navigation
 * @param {Element} main - Main content element
 */
function setupButtonNavigation(main) {
  // Delegate click events on main for all buttons
  main.addEventListener('click', (e) => {
    // Find if a button or link with button class was clicked
    const button = e.target.closest('a.button, button.button, .cta-button, [data-adaptive-action]');

    if (!button) return;

    // Skip if button has explicit href to external site or specific page
    if (button.tagName === 'A') {
      const href = button.getAttribute('href');
      if (href && (href.startsWith('http') || href.startsWith('/') && !href.startsWith('/?'))) {
        // Allow normal navigation for external links or explicit paths
        return;
      }
    }

    // Skip if button has data-no-generate attribute
    if (button.hasAttribute('data-no-generate')) {
      return;
    }

    // Skip search/submit buttons
    if (button.closest('.search-bar, .search-wrapper')) {
      return;
    }

    // Prevent default action
    e.preventDefault();

    // Extract context and navigate
    const query = extractButtonContext(button);
    console.log('[AdaptiveWeb] Button clicked, generating page for:', query);

    // Import and call navigateToQuery
    import('./router.js').then(({ navigateToQuery }) => {
      navigateToQuery(query);
    });
  });
}

/**
 * Set up navigation event handlers
 * @param {Element} main - Main content element
 */
function setupNavigation(main) {
  const demoMode = isDemoMode();

  // Set up button navigation
  setupButtonNavigation(main);

  // Handle custom navigation events
  window.addEventListener('adaptive-navigate', async (e) => {
    const { mode, query, pageId } = e.detail;

    try {
      switch (mode) {
        case 'generate': {
          const updateProgress = renderProgressLoading(main);
          let newPage;
          if (demoMode) {
            await new Promise((resolve) => { setTimeout(resolve, 1500); });
            newPage = getMockPageData(query);
          } else {
            newPage = await generatePage(query, updateProgress);
          }
          await renderPage(newPage, main);
          // Trigger image generation if needed
          if (newPage?.id && !newPage.images_ready) {
            triggerImageGeneration(newPage.id, newPage, main);
          }
          break;
        }

        case 'view':
          renderLoading(main);
          let existingPage;
          if (demoMode) {
            await new Promise((resolve) => { setTimeout(resolve, 500); });
            existingPage = getMockPageData('Sample Page');
          } else {
            existingPage = await getPage(pageId);
          }
          if (existingPage) {
            await renderPage(existingPage, main);
            // Trigger image generation if needed
            if (existingPage?.id && !existingPage.images_ready) {
              triggerImageGeneration(existingPage.id, existingPage, main);
            }
          } else {
            renderError(main, 'Page not found');
          }
          break;

        case 'homepage':
        default:
          let topics = [];
          if (!demoMode) {
            try {
              topics = await getSuggestedTopics();
            } catch (e) {
              // Use defaults
            }
          }
          await renderHomepage(topics, main);
          break;
      }
    } catch (error) {
      console.error('Navigation error:', error);
      renderError(main, error.message);
    }
  });

  // Handle browser back/forward
  onPopState(async ({ mode, id, q }) => {
    try {
      if (mode === 'generate' && q) {
        const updateProgress = renderProgressLoading(main);
        let pageData;
        if (demoMode) {
          await new Promise((resolve) => { setTimeout(resolve, 1500); });
          pageData = getMockPageData(q);
        } else {
          pageData = await generatePage(q, updateProgress);
        }
        await renderPage(pageData, main);
        // Trigger image generation if needed
        if (pageData?.id && !pageData.images_ready) {
          triggerImageGeneration(pageData.id, pageData, main);
        }
      } else if (mode === 'view' && id) {
        renderLoading(main);
        let pageData;
        if (demoMode) {
          await new Promise((resolve) => { setTimeout(resolve, 500); });
          pageData = getMockPageData('Sample Page');
        } else {
          pageData = await getPage(id);
        }
        if (pageData) {
          await renderPage(pageData, main);
          // Trigger image generation if needed
          if (pageData?.id && !pageData.images_ready) {
            triggerImageGeneration(pageData.id, pageData, main);
          }
        }
      } else {
        let topics = [];
        if (!demoMode) {
          try {
            topics = await getSuggestedTopics();
          } catch (e) {
            // Use defaults
          }
        }
        await renderHomepage(topics, main);
      }
    } catch (error) {
      renderError(main, error.message);
    }
  });
}

async function loadPage() {
  let main = document.querySelector('main');

  const configured = isConfigured();
  const adaptiveApp = isAdaptiveApp();
  console.log('[AdaptiveWeb] loadPage:', {
    configured,
    adaptiveApp,
    search: window.location.search,
    pathname: window.location.pathname,
  });

  // Check if API is configured and we're in adaptive mode
  if (configured && adaptiveApp) {
    // Ensure main element exists for adaptive mode
    if (!main) {
      main = document.createElement('main');
      document.body.appendChild(main);
    } else {
      // Clear any existing content (e.g., 404 page) immediately to prevent flash
      main.innerHTML = '';
      main.className = '';
    }

    // Ensure header/footer elements exist
    if (!document.querySelector('header')) {
      const header = document.createElement('header');
      document.body.insertBefore(header, main);
    }
    if (!document.querySelector('footer')) {
      const footer = document.createElement('footer');
      document.body.appendChild(footer);
    }

    // Initialize router
    initRouter();

    // Load block CSS files for adaptive mode
    const blockCSS = [
      'ai-hero',
      'ai-content',
      'feature-cards',
      'faq-accordion',
      'cta-section',
      'related-topics',
      'homepage-suggestions',
      // New blocks for flexible pipeline
      'comparison-table',
      'comparison-cards',
      'specs-table',
      'step-by-step',
      'text-section',
      'interactive-guide',
      'recipe-detail',
      'product-detail',
    ];
    blockCSS.forEach((block) => {
      loadCSS(`${window.hlx.codeBasePath}/blocks/${block}/${block}.css`);
    });

    // Show body immediately for app mode
    document.body.classList.add('appear');

    // Load header/footer immediately so they're visible during page generation
    loadHeader(document.querySelector('header'));
    loadFooter(document.querySelector('footer'));

    // Set up navigation handlers
    setupNavigation(main);

    // Handle initial page load
    await handleAdaptivePage(main);

    loadDelayed();
  } else {
    // Standard EDS page flow
    await loadEager(document);
    await loadLazy(document);
    loadDelayed();
  }
}

loadPage();
