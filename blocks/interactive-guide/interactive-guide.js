/**
 * Interactive Guide Block
 * Tab-based product selection guide with comparison overlay
 * Note: This block is rendered dynamically by page-renderer.js
 * This file exists for EDS block loading compatibility
 */

/**
 * Decorate the interactive guide block
 * The actual rendering is done by renderInteractiveGuideBlock in page-renderer.js
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('interactive-guide');
}
