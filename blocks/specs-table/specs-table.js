/**
 * Specs Table Block
 * Structured specification table for product details
 */

/**
 * Decorate the specs table block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('specs-table');

  // Extract table data from block
  const rows = [...block.children];
  let title = '';
  const specs = [];

  rows.forEach((row) => {
    const cols = [...row.children];

    // Check for title row (single column with heading)
    const h3 = row.querySelector('h3');
    if (h3) {
      title = h3.textContent;
      return;
    }

    // Regular spec row (label, value)
    if (cols.length >= 2) {
      specs.push({
        label: cols[0].textContent.trim(),
        value: cols[1].textContent.trim(),
      });
    } else if (cols.length === 1) {
      // Single column might be "label: value" format
      const text = cols[0].textContent.trim();
      if (text.includes(':')) {
        const [label, value] = text.split(':').map((s) => s.trim());
        if (label && value) {
          specs.push({ label, value });
        }
      }
    }
  });

  // Clear block and rebuild
  block.textContent = '';

  // Create container
  const container = document.createElement('div');
  container.className = 'specs-table-container';

  // Add title if present
  if (title) {
    const titleEl = document.createElement('h3');
    titleEl.className = 'specs-table-title';
    titleEl.textContent = title;
    container.appendChild(titleEl);
  }

  // Create table
  const table = document.createElement('table');
  table.className = 'specs-table-grid';

  const tbody = document.createElement('tbody');

  specs.forEach((spec, index) => {
    const tr = document.createElement('tr');
    tr.className = index % 2 === 0 ? 'even' : 'odd';

    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = spec.label;

    const td = document.createElement('td');
    td.textContent = spec.value;

    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
  block.appendChild(container);
}
