/**
 * AI Content Block
 * Rich body content section
 */

/**
 * Decorate the AI content block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('ai-content');

  // Extract paragraphs and CTA from block rows
  const rows = [...block.children];
  const paragraphs = [];
  let ctaElement = null;

  rows.forEach((row) => {
    // Check for button/link (CTA)
    const button = row.querySelector('a.button, a');
    if (button && button.classList.contains('button')) {
      ctaElement = button.cloneNode(true);
      return;
    }

    // Get paragraph content
    const p = row.querySelector('p');
    if (p) {
      paragraphs.push(p.innerHTML);
    } else {
      const text = row.textContent.trim();
      if (text) {
        paragraphs.push(text);
      }
    }
  });

  // Clear block and rebuild
  block.textContent = '';

  // Create content container
  const container = document.createElement('div');
  container.className = 'ai-content-body';

  // Add paragraphs
  paragraphs.forEach((content) => {
    const p = document.createElement('p');
    p.innerHTML = content;
    container.appendChild(p);
  });

  // Add CTA if present
  if (ctaElement) {
    const ctaWrapper = document.createElement('div');
    ctaWrapper.className = 'ai-content-cta';
    ctaWrapper.appendChild(ctaElement);
    container.appendChild(ctaWrapper);
  }

  block.appendChild(container);
}
