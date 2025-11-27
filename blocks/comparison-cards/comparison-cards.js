/**
 * Comparison Cards Block
 * Interactive card grid for product comparison with overlay modal
 * Note: This block is rendered dynamically by page-renderer.js
 * This file exists for EDS block loading compatibility
 */

/**
 * Decorate the comparison cards block
 * The actual rendering is done by renderComparisonCardsBlock in page-renderer.js
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('comparison-cards');
}
