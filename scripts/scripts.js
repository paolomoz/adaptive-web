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
import { generatePage, getPage, isConfigured, isDemoMode, getMockPageData } from './api-client.js';
import {
  renderGeneratedPage,
  renderHomepage,
  renderLoading,
  renderError,
} from './page-renderer.js';
import { getSuggestedTopics } from './supabase-client.js';

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

  try {
    switch (mode) {
      case 'generate': {
        // Show loading state
        renderLoading(main);

        // Generate new page (use mock data in demo mode)
        let pageData;
        if (demoMode) {
          // Simulate loading delay in demo mode
          await new Promise((resolve) => { setTimeout(resolve, 1500); });
          pageData = getMockPageData(params.q);
        } else {
          pageData = await generatePage(params.q);
        }

        // Render the generated content
        await renderGeneratedPage(pageData, main);
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
          await renderGeneratedPage(pageData, main);
        } else {
          renderError(main, 'Page not found');
        }
        break;
      }

      case 'homepage':
      default: {
        // Load suggested topics and render homepage
        let topics = [];
        if (!demoMode) {
          try {
            topics = await getSuggestedTopics();
          } catch (e) {
            // Use defaults from homepage-suggestions block
          }
        }
        await renderHomepage(topics, main);
        break;
      }
    }
  } catch (error) {
    console.error('Adaptive page error:', error);
    renderError(main, error.message || 'Something went wrong');
  }
}

/**
 * Set up navigation event handlers
 * @param {Element} main - Main content element
 */
function setupNavigation(main) {
  const demoMode = isDemoMode();

  // Handle custom navigation events
  window.addEventListener('adaptive-navigate', async (e) => {
    const { mode, query, pageId } = e.detail;

    try {
      switch (mode) {
        case 'generate':
          renderLoading(main);
          let newPage;
          if (demoMode) {
            await new Promise((resolve) => { setTimeout(resolve, 1500); });
            newPage = getMockPageData(query);
          } else {
            newPage = await generatePage(query);
          }
          await renderGeneratedPage(newPage, main);
          break;

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
            await renderGeneratedPage(existingPage, main);
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
        renderLoading(main);
        let pageData;
        if (demoMode) {
          await new Promise((resolve) => { setTimeout(resolve, 1500); });
          pageData = getMockPageData(q);
        } else {
          pageData = await generatePage(q);
        }
        await renderGeneratedPage(pageData, main);
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
          await renderGeneratedPage(pageData, main);
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

  // Check if API is configured and we're in adaptive mode
  if (isConfigured() && isAdaptiveApp()) {
    // Ensure main element exists for adaptive mode
    if (!main) {
      main = document.createElement('main');
      document.body.appendChild(main);
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

    // Show body immediately for app mode
    document.body.classList.add('appear');

    // Set up navigation handlers
    setupNavigation(main);

    // Handle initial page load
    await handleAdaptivePage(main);

    // Load header/footer
    loadHeader(document.querySelector('header'));
    loadFooter(document.querySelector('footer'));

    loadDelayed();
  } else {
    // Standard EDS page flow
    await loadEager(document);
    await loadLazy(document);
    loadDelayed();
  }
}

loadPage();
