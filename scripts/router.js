/**
 * Router for AdaptiveWeb
 * Handles URL parameters and page state
 */

/**
 * Parse URL parameters
 * @returns {object} Parsed URL parameters
 */
export function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get('id'),
    q: params.get('q'),
    h: params.get('h'), // history/session context
  };
}

/**
 * Determine current page mode
 * @returns {string} 'homepage' | 'generate' | 'view'
 */
export function getPageMode() {
  const { id, q } = getUrlParams();

  if (q) return 'generate'; // New query to generate
  if (id) return 'view'; // Viewing existing page
  return 'homepage'; // Landing page with suggestions
}

/**
 * Update URL without page reload
 * @param {object} params - Parameters to set
 */
export function updateUrl(params) {
  const url = new URL(window.location.href);

  // Clear existing params
  url.search = '';

  // Set new params
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  window.history.pushState({}, '', url.toString());
}

/**
 * Navigate to a new query (triggers generation)
 * @param {string} query - Search query
 */
export function navigateToQuery(query) {
  updateUrl({ q: query });
  window.dispatchEvent(new CustomEvent('adaptive-navigate', {
    detail: { mode: 'generate', query },
  }));
}

/**
 * Navigate to an existing page
 * @param {string} pageId - Page UUID
 */
export function navigateToPage(pageId) {
  updateUrl({ id: pageId });
  window.dispatchEvent(new CustomEvent('adaptive-navigate', {
    detail: { mode: 'view', pageId },
  }));
}

/**
 * Navigate to homepage
 */
export function navigateToHome() {
  updateUrl({});
  window.dispatchEvent(new CustomEvent('adaptive-navigate', {
    detail: { mode: 'homepage' },
  }));
}

/**
 * Get shareable URL for current page
 * @param {string} pageId - Page UUID
 * @returns {string} Full shareable URL
 */
export function getShareUrl(pageId) {
  const url = new URL(window.location.origin);
  url.searchParams.set('id', pageId);
  return url.toString();
}

/**
 * Copy share URL to clipboard
 * @param {string} pageId - Page UUID
 * @returns {Promise<boolean>} Success status
 */
export async function copyShareUrl(pageId) {
  const url = getShareUrl(pageId);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (err) {
    console.error('Failed to copy URL:', err);
    return false;
  }
}

/**
 * Handle browser back/forward navigation
 * @param {function} callback - Function to handle navigation
 */
export function onPopState(callback) {
  window.addEventListener('popstate', () => {
    const mode = getPageMode();
    const params = getUrlParams();
    callback({ mode, ...params });
  });
}

/**
 * Initialize router and return current state
 * @returns {object} Current page state
 */
export function initRouter() {
  const mode = getPageMode();
  const params = getUrlParams();
  return { mode, ...params };
}
