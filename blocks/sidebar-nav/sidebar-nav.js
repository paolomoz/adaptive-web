/**
 * Sidebar Navigation Block
 * Search history and navigation
 */

import { getHistory, clearHistory } from '../../scripts/supabase-client.js';
import { navigateToPage, navigateToHome, getUrlParams } from '../../scripts/router.js';

/**
 * Format relative time
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted relative time
 */
function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

/**
 * Decorate the sidebar nav block
 * @param {Element} block - The block element
 */
export default async function decorate(block) {
  block.classList.add('sidebar-nav');

  // Create sidebar structure
  const sidebar = document.createElement('aside');
  sidebar.className = 'adaptive-sidebar';

  // Header
  const header = document.createElement('div');
  header.className = 'sidebar-header';
  header.innerHTML = `
    <a href="/" class="sidebar-brand">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      </svg>
      <span>Vitamix</span>
    </a>
    <button class="sidebar-toggle" aria-label="Toggle sidebar">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18"></path>
        <path d="m6 6 12 12"></path>
      </svg>
    </button>
  `;

  // Navigation section header
  const navHeader = document.createElement('div');
  navHeader.className = 'sidebar-nav-header';
  navHeader.innerHTML = `
    <h2>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
      </svg>
      Navigation
    </h2>
    <button class="clear-history" aria-label="Clear history">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
      </svg>
      Clear
    </button>
  `;

  // History list container
  const historyContainer = document.createElement('div');
  historyContainer.className = 'sidebar-history';
  historyContainer.innerHTML = `<div class="history-loading">Loading...</div>`;

  sidebar.appendChild(header);
  sidebar.appendChild(navHeader);
  sidebar.appendChild(historyContainer);

  // Clear block and add sidebar
  block.textContent = '';
  block.appendChild(sidebar);

  // Toggle functionality
  const toggleBtn = header.querySelector('.sidebar-toggle');
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Brand click - go home
  const brandLink = header.querySelector('.sidebar-brand');
  brandLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToHome();
  });

  // Clear history button
  const clearBtn = navHeader.querySelector('.clear-history');
  clearBtn.addEventListener('click', async () => {
    await clearHistory();
    renderHistory([]);
  });

  // Load and render history
  const currentPageId = getUrlParams().id;

  async function loadHistory() {
    try {
      const history = await getHistory(20);
      renderHistory(history, currentPageId);
    } catch (error) {
      console.error('Failed to load history:', error);
      renderHistory([]);
    }
  }

  function renderHistory(history, activeId = null) {
    if (history.length === 0) {
      historyContainer.innerHTML = `
        <div class="history-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <p>No searches yet</p>
          <p class="history-empty-hint">Start exploring to build your history</p>
        </div>
      `;
      return;
    }

    const list = document.createElement('ul');
    list.className = 'history-list';

    history.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      if (item.page_id === activeId) {
        li.classList.add('active');
      }

      li.innerHTML = `
        <div class="history-item-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </div>
        <div class="history-item-content">
          <div class="history-item-query">${item.query}</div>
          <div class="history-item-time">${formatRelativeTime(item.created_at)}</div>
        </div>
      `;

      li.addEventListener('click', () => {
        if (item.page_id) {
          navigateToPage(item.page_id);
        }
      });

      list.appendChild(li);
    });

    historyContainer.innerHTML = '';
    historyContainer.appendChild(list);
  }

  // Initial load
  await loadHistory();

  // Refresh on navigation
  window.addEventListener('adaptive-navigate', () => {
    loadHistory();
  });
}
