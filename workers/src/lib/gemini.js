/**
 * Gemini Layout Selector
 * Uses Gemini 1.5 Flash to select optimal EDS block layouts based on content atoms
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * Block library with metadata for layout selection
 * Each block defines:
 * - for: content types this block is optimized for
 * - required: atom types needed to populate this block
 * - priority: selection priority (higher = more likely to be selected)
 */
const BLOCK_LIBRARY = {
  // Universal blocks (used for all content types)
  'hero-banner': {
    for: ['all'],
    required: ['heading'],
    priority: 100,
    description: 'Full-width hero section with title, subtitle, and optional image',
  },
  'feature-cards': {
    for: ['all'],
    required: ['feature_set'],
    priority: 80,
    description: 'Grid of 3 feature cards with images, titles, and descriptions',
  },
  'faq-accordion': {
    for: ['all'],
    required: ['faq_set'],
    priority: 70,
    description: 'Expandable FAQ section with questions and answers',
  },
  'cta-section': {
    for: ['all'],
    required: ['cta'],
    priority: 60,
    description: 'Call-to-action section with headline, description, and buttons',
  },
  'related-topics': {
    for: ['all'],
    required: ['related'],
    priority: 50,
    description: 'Grid of related topic cards for continued exploration',
  },

  // Content-specific blocks
  'text-section': {
    for: ['guide', 'recipe', 'product'],
    required: ['paragraph'],
    priority: 75,
    description: 'Large text section for detailed explanations or descriptions',
  },
  'comparison-table': {
    for: ['comparison'],
    required: ['comparison'],
    priority: 70,
    description: 'Simple horizontal table for quick spec comparison of 2-3 products',
  },
  'comparison-cards': {
    for: ['comparison', 'product'],
    required: ['comparison'],
    priority: 95,
    description: 'Interactive card grid with product images, prices, and ratings. Users can select multiple products and compare side-by-side in overlay modal. Best for browsing and comparing 3+ products.',
  },
  'specs-table': {
    for: ['product'],
    required: ['table'],
    priority: 90,
    description: 'Structured specification table for product details',
  },
  'step-by-step': {
    for: ['recipe', 'guide'],
    required: ['steps'],
    priority: 90,
    description: 'Numbered step-by-step instructions with optional tips',
  },
  'bullet-list': {
    for: ['guide', 'product'],
    required: ['list'],
    priority: 65,
    description: 'Bulleted or numbered list for key points',
  },
  'interactive-guide': {
    for: ['comparison', 'guide'],
    required: ['interactive_guide'],
    priority: 95,
    description: 'Tab-based product selection guide with top 2-4 product picks organized by user intent (e.g., Best Value, High-Tech, Proven Classic). Each tab shows a detailed product card with specs, pros/cons, and actions. Includes a "Compare All" button that opens a comparison table overlay. Best for helping users choose between a few curated options.',
  },
};

/**
 * System prompt for Gemini layout selection
 */
const LAYOUT_SYSTEM_PROMPT = `You are a layout selector for AdaptiveWeb pages. Your job is to analyze content atoms and select the optimal sequence of EDS blocks to display that content.

AVAILABLE BLOCKS:
${Object.entries(BLOCK_LIBRARY).map(([name, meta]) => `- ${name}: ${meta.description} (best for: ${meta.for.join(', ')})`).join('\n')}

LAYOUT RULES:
1. Always start with 'hero-banner' for the main heading
2. **CRITICAL**: If an 'interactive_guide' atom is present, you MUST include the 'interactive-guide' block immediately after hero-banner. This is mandatory - do NOT skip it!
3. Place most important content blocks early in the sequence
4. End with 'cta-section' followed by 'related-topics'
5. For recipes: include 'step-by-step' before the CTA
6. For products: include 'specs-table' to show specifications
7. IMPORTANT - When a 'table' atom is present, ALWAYS include either 'comparison-table' or 'specs-table' to render it. Tables are explicitly requested content.
8. For comparisons: prefer 'comparison-cards' for browsing/selecting products, but use 'comparison-table' when user explicitly asks for a "table" or when a table atom is present
9. Use 'text-section' when there are multiple descriptive paragraphs
10. Include 'feature-cards' when feature_set atoms are present
11. Include 'faq-accordion' when faq_set atoms are present
12. Maximum 8 blocks per page to maintain focus
13. For queries like "show all models", "compare blenders" - use comparison-cards
14. For queries containing "table", "chart", "specs", "specifications" - MUST include comparison-table or specs-table

RESPONSE FORMAT:
Respond with ONLY valid JSON matching this schema:
{
  "layout_rationale": "Brief explanation of why this layout was chosen",
  "blocks": [
    {
      "block_type": "hero-banner",
      "atom_mappings": {
        "title": "heading.text",
        "subtitle": "paragraph.text",
        "image": "metadata.primary_image_prompt"
      }
    }
  ]
}

The atom_mappings object tells the renderer which content atoms to use for each block slot.
Common mappings:
- heading.text, heading.level
- paragraph.text (use first paragraph for hero subtitle)
- feature_set.items
- faq_set.items
- steps.items
- table.headers, table.rows, table.title
- comparison.items
- cta.title, cta.description, cta.buttons
- related.items
- list.items, list.style
- metadata.primary_image_prompt, metadata.title, metadata.description
- interactive_guide.title, interactive_guide.subtitle, interactive_guide.picks`;

/**
 * Select optimal block layout for content atoms
 * @param {Array} contentAtoms - Array of content atoms from Claude
 * @param {string} contentType - Content type (recipe, product, comparison, guide)
 * @param {object} metadata - Page metadata from Claude
 * @param {string} apiKey - Gemini API key
 * @param {string} originalQuery - Original user query (optional, for keyword detection)
 * @returns {Promise<{blocks: Array, rationale: string}>} Selected layout
 */
export async function selectBlockLayout(contentAtoms, contentType, metadata, apiKey, originalQuery = '') {
  // Build content summary for Gemini
  const atomSummary = summarizeAtoms(contentAtoms);

  const userPrompt = `Select the optimal block layout for this ${contentType} page.

USER QUERY: "${originalQuery}"

PAGE METADATA:
- Title: ${metadata.title || 'Untitled'}
- Description: ${metadata.description || 'No description'}

AVAILABLE CONTENT ATOMS:
${atomSummary}

Select blocks that best present this content. Remember to:
- Start with hero-banner
- Include appropriate content-specific blocks for "${contentType}" type
- End with cta-section and related-topics
- Only include blocks that have matching content atoms
- If the user query contains "table", "chart", or "specs", you MUST include a table block`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: LAYOUT_SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.3, // Low temperature for consistent layouts
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract text content from response
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    console.error('No text content in Gemini response, using fallback layout');
    return getFallbackLayout(contentType, contentAtoms);
  }

  try {
    // Parse JSON response
    let jsonText = textContent.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const layout = JSON.parse(jsonText);

    // Validate and return
    if (!layout.blocks || !Array.isArray(layout.blocks)) {
      console.error('Invalid layout structure, using fallback');
      return getFallbackLayout(contentType, contentAtoms);
    }

    console.log(`Gemini selected ${layout.blocks.length} blocks: ${layout.blocks.map((b) => b.block_type).join(', ')}`);

    // Post-process: Ensure interactive-guide block is included if atom exists
    const hasInteractiveGuideAtom = contentAtoms.some((a) => a.type === 'interactive_guide');
    const hasInteractiveGuideBlock = layout.blocks.some((b) => b.block_type === 'interactive-guide');

    if (hasInteractiveGuideAtom && !hasInteractiveGuideBlock) {
      console.log('Adding missing interactive-guide block (atom exists but Gemini did not select it)');
      // Insert after hero-banner (position 1)
      const interactiveGuideBlock = {
        block_type: 'interactive-guide',
        atom_mappings: {
          title: 'interactive_guide.title',
          subtitle: 'interactive_guide.subtitle',
          picks: 'interactive_guide.picks',
        },
      };
      layout.blocks.splice(1, 0, interactiveGuideBlock);
    }

    return {
      blocks: layout.blocks,
      rationale: layout.layout_rationale || 'Layout selected by Gemini',
    };
  } catch (parseError) {
    console.error('Failed to parse Gemini layout response:', parseError);
    return getFallbackLayout(contentType, contentAtoms);
  }
}

/**
 * Summarize content atoms for Gemini prompt
 * @param {Array} atoms - Content atoms array
 * @returns {string} Human-readable summary
 */
function summarizeAtoms(atoms) {
  const summary = [];
  const atomCounts = {};

  for (const atom of atoms) {
    const type = atom.type;
    atomCounts[type] = (atomCounts[type] || 0) + 1;

    // Add details for certain atom types
    if (type === 'heading') {
      summary.push(`- heading (level ${atom.level}): "${atom.text?.slice(0, 50)}..."`);
    } else if (type === 'paragraph') {
      summary.push(`- paragraph: "${atom.text?.slice(0, 80)}..."`);
    } else if (type === 'feature_set') {
      summary.push(`- feature_set: ${atom.items?.length || 0} features`);
    } else if (type === 'faq_set') {
      summary.push(`- faq_set: ${atom.items?.length || 0} FAQs`);
    } else if (type === 'steps') {
      summary.push(`- steps: ${atom.items?.length || 0} steps`);
    } else if (type === 'table') {
      summary.push(`- table: "${atom.title}" with ${atom.rows?.length || 0} rows`);
    } else if (type === 'comparison') {
      summary.push(`- comparison: ${atom.items?.length || 0} products to compare`);
    } else if (type === 'cta') {
      summary.push(`- cta: "${atom.title}"`);
    } else if (type === 'related') {
      summary.push(`- related: ${atom.items?.length || 0} related topics`);
    } else if (type === 'list') {
      summary.push(`- list (${atom.style}): ${atom.items?.length || 0} items`);
    } else if (type === 'interactive_guide') {
      summary.push(`- interactive_guide: "${atom.title}" with ${atom.picks?.length || 0} curated product picks (THIS IS IMPORTANT - use interactive-guide block!)`);
    }
  }

  return summary.join('\n');
}

/**
 * Get fallback layout when Gemini fails
 * Uses rule-based selection based on content type and available atoms
 * @param {string} contentType - Content type
 * @param {Array} atoms - Content atoms
 * @returns {{blocks: Array, rationale: string}} Fallback layout
 */
export function getFallbackLayout(contentType, atoms) {
  const atomTypes = new Set(atoms.map((a) => a.type));
  const blocks = [];

  // Always start with hero
  blocks.push({
    block_type: 'hero-banner',
    atom_mappings: {
      title: 'heading.text',
      subtitle: 'paragraph.text',
      image: 'metadata.primary_image_prompt',
    },
  });

  // Add text section if multiple paragraphs
  const paragraphCount = atoms.filter((a) => a.type === 'paragraph').length;
  if (paragraphCount > 1) {
    blocks.push({
      block_type: 'text-section',
      atom_mappings: { paragraphs: 'paragraph' },
    });
  }

  // Content-type specific blocks
  if (contentType === 'comparison' && atomTypes.has('comparison')) {
    // Use comparison-cards for interactive product browsing
    blocks.push({
      block_type: 'comparison-cards',
      atom_mappings: { items: 'comparison.items' },
    });
  }

  if (contentType === 'product' && atomTypes.has('table')) {
    blocks.push({
      block_type: 'specs-table',
      atom_mappings: {
        title: 'table.title',
        headers: 'table.headers',
        rows: 'table.rows',
      },
    });
  }

  if ((contentType === 'recipe' || contentType === 'guide') && atomTypes.has('steps')) {
    blocks.push({
      block_type: 'step-by-step',
      atom_mappings: { items: 'steps.items' },
    });
  }

  // Interactive guide for personalized recommendations (high priority)
  if (atomTypes.has('interactive_guide')) {
    blocks.push({
      block_type: 'interactive-guide',
      atom_mappings: {
        title: 'interactive_guide.title',
        subtitle: 'interactive_guide.subtitle',
        picks: 'interactive_guide.picks',
      },
    });
  }

  // Universal blocks
  if (atomTypes.has('feature_set')) {
    blocks.push({
      block_type: 'feature-cards',
      atom_mappings: { items: 'feature_set.items' },
    });
  }

  if (atomTypes.has('faq_set')) {
    blocks.push({
      block_type: 'faq-accordion',
      atom_mappings: { items: 'faq_set.items' },
    });
  }

  if (atomTypes.has('list')) {
    blocks.push({
      block_type: 'bullet-list',
      atom_mappings: {
        items: 'list.items',
        style: 'list.style',
      },
    });
  }

  // Always end with CTA and related
  if (atomTypes.has('cta')) {
    blocks.push({
      block_type: 'cta-section',
      atom_mappings: {
        title: 'cta.title',
        description: 'cta.description',
        buttons: 'cta.buttons',
      },
    });
  }

  if (atomTypes.has('related')) {
    blocks.push({
      block_type: 'related-topics',
      atom_mappings: { items: 'related.items' },
    });
  }

  return {
    blocks,
    rationale: `Fallback layout for ${contentType} with ${blocks.length} blocks`,
  };
}

/**
 * Get the block library metadata
 * Useful for debugging and documentation
 * @returns {object} Block library
 */
export function getBlockLibrary() {
  return BLOCK_LIBRARY;
}
