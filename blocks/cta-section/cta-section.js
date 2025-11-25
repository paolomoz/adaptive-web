/**
 * CTA Section Block
 * Final call-to-action banner
 */

/**
 * Decorate the CTA section block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('cta-section');

  // Extract content from block rows
  const rows = [...block.children];
  let title = '';
  let description = '';
  const buttons = [];

  rows.forEach((row) => {
    // Check for heading
    const h2 = row.querySelector('h2');
    if (h2) {
      title = h2.textContent;
      return;
    }

    // Check for buttons
    const btns = row.querySelectorAll('a.button, a');
    if (btns.length > 0) {
      btns.forEach((btn) => {
        buttons.push({
          text: btn.textContent,
          href: btn.href,
          isPrimary: !btn.classList.contains('secondary'),
        });
      });
      return;
    }

    // Get description
    const p = row.querySelector('p');
    if (p) {
      description = p.textContent;
    } else {
      const text = row.textContent.trim();
      if (text && !description) {
        description = text;
      }
    }
  });

  // Clear block and rebuild
  block.textContent = '';

  // Create CTA container
  const container = document.createElement('div');
  container.className = 'cta-container';

  // Title
  if (title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    container.appendChild(h2);
  }

  // Description
  if (description) {
    const p = document.createElement('p');
    p.textContent = description;
    container.appendChild(p);
  }

  // Buttons
  if (buttons.length > 0) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'cta-buttons';

    buttons.forEach((btn) => {
      const a = document.createElement('a');
      a.href = btn.href || '#';
      a.className = btn.isPrimary ? 'button' : 'button secondary';
      a.textContent = btn.text;
      buttonContainer.appendChild(a);
    });

    container.appendChild(buttonContainer);
  }

  block.appendChild(container);
}
