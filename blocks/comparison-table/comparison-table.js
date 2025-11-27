/**
 * Comparison Table Block
 * Side-by-side product comparison with specs, pros, and cons
 */

/**
 * Decorate the comparison table block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('comparison-table');

  // Extract comparison data from block rows
  const rows = [...block.children];
  const products = [];

  rows.forEach((row) => {
    const cols = [...row.children];
    const product = {
      name: '',
      specs: {},
      pros: [],
      cons: [],
    };

    cols.forEach((col) => {
      const text = col.textContent.trim();

      // Check for product name (heading)
      const h3 = col.querySelector('h3');
      if (h3) {
        product.name = h3.textContent;
        return;
      }

      // Check for specs (key: value format)
      if (text.includes(':') && !text.includes('Pro:') && !text.includes('Con:')) {
        const [key, value] = text.split(':').map((s) => s.trim());
        if (key && value) {
          product.specs[key] = value;
        }
        return;
      }

      // Check for pros list
      const prosList = col.querySelector('ul.pros, .pros');
      if (prosList || text.startsWith('Pro:')) {
        const items = prosList ? [...prosList.querySelectorAll('li')] : [col];
        items.forEach((item) => {
          const proText = item.textContent.replace('Pro:', '').trim();
          if (proText) product.pros.push(proText);
        });
        return;
      }

      // Check for cons list
      const consList = col.querySelector('ul.cons, .cons');
      if (consList || text.startsWith('Con:')) {
        const items = consList ? [...consList.querySelectorAll('li')] : [col];
        items.forEach((item) => {
          const conText = item.textContent.replace('Con:', '').trim();
          if (conText) product.cons.push(conText);
        });
      }
    });

    if (product.name) {
      products.push(product);
    }
  });

  // Clear block and rebuild
  block.textContent = '';

  // Create comparison grid
  const grid = document.createElement('div');
  grid.className = 'comparison-grid';

  // Get all unique spec keys
  const allSpecs = new Set();
  products.forEach((p) => Object.keys(p.specs).forEach((k) => allSpecs.add(k)));

  // Create product columns
  products.forEach((product, index) => {
    const column = document.createElement('div');
    column.className = 'comparison-product';
    column.dataset.index = index;

    // Product header
    const header = document.createElement('div');
    header.className = 'comparison-product-header';
    const h3 = document.createElement('h3');
    h3.textContent = product.name;
    header.appendChild(h3);
    column.appendChild(header);

    // Specs section
    if (allSpecs.size > 0) {
      const specsSection = document.createElement('div');
      specsSection.className = 'comparison-specs';

      allSpecs.forEach((specKey) => {
        const specRow = document.createElement('div');
        specRow.className = 'comparison-spec-row';

        const label = document.createElement('span');
        label.className = 'spec-label';
        label.textContent = specKey;

        const value = document.createElement('span');
        value.className = 'spec-value';
        value.textContent = product.specs[specKey] || '-';

        specRow.appendChild(label);
        specRow.appendChild(value);
        specsSection.appendChild(specRow);
      });

      column.appendChild(specsSection);
    }

    // Pros section
    if (product.pros.length > 0) {
      const prosSection = document.createElement('div');
      prosSection.className = 'comparison-pros';

      const prosTitle = document.createElement('h4');
      prosTitle.textContent = 'Pros';
      prosSection.appendChild(prosTitle);

      const prosList = document.createElement('ul');
      product.pros.forEach((pro) => {
        const li = document.createElement('li');
        li.textContent = pro;
        prosList.appendChild(li);
      });
      prosSection.appendChild(prosList);
      column.appendChild(prosSection);
    }

    // Cons section
    if (product.cons.length > 0) {
      const consSection = document.createElement('div');
      consSection.className = 'comparison-cons';

      const consTitle = document.createElement('h4');
      consTitle.textContent = 'Cons';
      consSection.appendChild(consTitle);

      const consList = document.createElement('ul');
      product.cons.forEach((con) => {
        const li = document.createElement('li');
        li.textContent = con;
        consList.appendChild(li);
      });
      consSection.appendChild(consList);
      column.appendChild(consSection);
    }

    grid.appendChild(column);
  });

  block.appendChild(grid);
}
