/**
 * Step-by-Step Block
 * Clean numbered instructions - Vitamix style
 */

/**
 * Decorate the step-by-step block
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('step-by-step');

  // Extract steps from block rows
  const rows = [...block.children];
  const steps = [];

  rows.forEach((row) => {
    const cols = [...row.children];
    const step = {
      number: steps.length + 1,
      instruction: '',
      tip: '',
    };

    cols.forEach((col) => {
      const text = col.textContent.trim();

      // Check for step number
      const numMatch = text.match(/^(\d+)\.\s*/);
      if (numMatch) {
        step.number = parseInt(numMatch[1], 10);
        step.instruction = text.replace(numMatch[0], '').trim();
        return;
      }

      // Check for tip (marked with "Tip:" prefix or in a .tip class)
      if (text.toLowerCase().startsWith('tip:') || col.classList.contains('tip')) {
        step.tip = text.replace(/^tip:\s*/i, '').trim();
        return;
      }

      // Regular instruction text
      if (!step.instruction) {
        step.instruction = text;
      }
    });

    if (step.instruction) {
      steps.push(step);
    }
  });

  // Clear block and rebuild
  block.textContent = '';

  // Create steps container
  const container = document.createElement('div');
  container.className = 'steps-container';

  steps.forEach((step) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'step';

    // Step number (period added via CSS ::after)
    const numberEl = document.createElement('span');
    numberEl.className = 'step-number';
    numberEl.textContent = step.number;

    // Step content
    const content = document.createElement('div');
    content.className = 'step-content';

    const instruction = document.createElement('p');
    instruction.className = 'step-instruction';
    instruction.textContent = step.instruction;
    content.appendChild(instruction);

    if (step.tip) {
      const tipEl = document.createElement('div');
      tipEl.className = 'step-tip';

      const tipIcon = document.createElement('span');
      tipIcon.className = 'tip-icon';
      tipIcon.textContent = '\u2139'; // Info symbol (ℹ)

      const tipText = document.createElement('span');
      tipText.textContent = step.tip;

      tipEl.appendChild(tipIcon);
      tipEl.appendChild(tipText);
      content.appendChild(tipEl);
    }

    stepEl.appendChild(numberEl);
    stepEl.appendChild(content);
    container.appendChild(stepEl);
  });

  block.appendChild(container);
}
