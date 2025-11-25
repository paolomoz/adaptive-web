/**
 * FAQ Accordion Block
 * Collapsible question/answer pairs
 */

/**
 * Decorate the FAQ accordion block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('faq-accordion');

  // Extract FAQ items from block rows
  const rows = [...block.children];
  const faqs = rows.map((row) => {
    const cols = [...row.children];
    const faq = { question: '', answer: '' };

    cols.forEach((col) => {
      // Check for heading (question)
      const h3 = col.querySelector('h3');
      if (h3) {
        faq.question = h3.textContent;
        return;
      }

      // Get answer content
      const p = col.querySelector('p');
      if (p) {
        faq.answer = p.innerHTML;
      } else {
        const text = col.textContent.trim();
        if (text && !faq.answer) {
          faq.answer = text;
        }
      }
    });

    return faq;
  }).filter((faq) => faq.question && faq.answer);

  // Clear block and rebuild
  block.textContent = '';

  // Create accordion container
  const accordion = document.createElement('div');
  accordion.className = 'faq-list';

  faqs.forEach((faq, index) => {
    const item = document.createElement('div');
    item.className = 'faq-item';

    // Question header (clickable)
    const header = document.createElement('button');
    header.className = 'faq-question';
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-controls', `faq-answer-${index}`);
    header.innerHTML = `
      <span>${faq.question}</span>
      <svg class="faq-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    // Answer content (collapsible)
    const answer = document.createElement('div');
    answer.className = 'faq-answer';
    answer.id = `faq-answer-${index}`;
    answer.setAttribute('aria-hidden', 'true');

    const answerContent = document.createElement('div');
    answerContent.className = 'faq-answer-content';
    answerContent.innerHTML = `<p>${faq.answer}</p>`;
    answer.appendChild(answerContent);

    // Toggle functionality
    header.addEventListener('click', () => {
      const isExpanded = header.getAttribute('aria-expanded') === 'true';

      // Close all other items
      block.querySelectorAll('.faq-item.open').forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          openItem.querySelector('.faq-answer').setAttribute('aria-hidden', 'true');
        }
      });

      // Toggle current item
      item.classList.toggle('open', !isExpanded);
      header.setAttribute('aria-expanded', !isExpanded);
      answer.setAttribute('aria-hidden', isExpanded);
    });

    item.appendChild(header);
    item.appendChild(answer);
    accordion.appendChild(item);
  });

  block.appendChild(accordion);

  // Add "Ask Another Question" button
  const askButton = document.createElement('button');
  askButton.className = 'button secondary faq-ask-button';
  askButton.textContent = 'Ask Another Question';
  askButton.addEventListener('click', () => {
    // Scroll to search bar
    const searchBar = document.querySelector('.search-bar input');
    if (searchBar) {
      searchBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      searchBar.focus();
    }
  });
  block.appendChild(askButton);
}
