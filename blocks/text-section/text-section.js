/**
 * Text Section Block
 * Large text section for detailed explanations or descriptions
 */

/**
 * Decorate the text section block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('text-section');

  // Extract content from block rows
  const rows = [...block.children];
  const content = {
    title: '',
    paragraphs: [],
  };

  rows.forEach((row) => {
    const cols = [...row.children];

    cols.forEach((col) => {
      // Check for heading
      const h2 = col.querySelector('h2');
      const h3 = col.querySelector('h3');
      if (h2) {
        content.title = h2.textContent;
        return;
      }
      if (h3 && !content.title) {
        content.title = h3.textContent;
        return;
      }

      // Check for paragraphs
      const paragraphs = col.querySelectorAll('p');
      if (paragraphs.length > 0) {
        paragraphs.forEach((p) => {
          const text = p.textContent.trim();
          if (text) {
            content.paragraphs.push(text);
          }
        });
        return;
      }

      // Raw text content
      const text = col.textContent.trim();
      if (text && !content.title) {
        content.paragraphs.push(text);
      }
    });
  });

  // Clear block and rebuild
  block.textContent = '';

  // Create container
  const container = document.createElement('div');
  container.className = 'text-section-container';

  // Add title if present
  if (content.title) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-section-title';
    titleEl.textContent = content.title;
    container.appendChild(titleEl);
  }

  // Add paragraphs
  if (content.paragraphs.length > 0) {
    const textContent = document.createElement('div');
    textContent.className = 'text-section-content';

    content.paragraphs.forEach((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      textContent.appendChild(p);
    });

    container.appendChild(textContent);
  }

  block.appendChild(container);
}
