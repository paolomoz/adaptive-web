/**
 * Claude API Integration
 * Generates structured content atoms AND layout blocks for AdaptiveWeb pages
 * Content atoms are layout-agnostic content units, layout_blocks defines how to arrange them
 */

import { retrieveContext } from './rag.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * System prompt for content atoms generation
 * Generates pure content without layout decisions - Gemini will handle layout
 */
const CONTENT_ATOMS_PROMPT = `You are a content generator for Vitamix, the premium blender company. Generate comprehensive content atoms (structured content units) that will be arranged into page layouts by a separate system.

VITAMIX PRODUCT KNOWLEDGE:
- Ascent Series: A2300 ($449), A2500 ($549), A3300 ($549), A3500 ($629) - Self-Detect technology, wireless connectivity, touchscreen on A3500
- Explorian Series: E310 ($349), E320 ($449) - great value, professional-grade power
- Propel Series: Entry-level, powerful 2.2 HP motor
- Professional Series: 750 ($529), 300 - commercial-grade, NSF certified
- Container sizes: 64oz standard, 48oz wet/dry, 20oz personal cup

KEY FEATURES:
- 10-year full warranty (industry leading)
- Aircraft-grade stainless steel blades
- Hot soup in 6 minutes (friction heating)
- Self-cleaning in 60 seconds
- Variable speed control (1-10) plus Pulse
- Programs: Smoothies, Hot Soups, Frozen Desserts, Dips & Spreads, Self-Cleaning

BRAND VOICE: Helpful, expert, approachable. Focus on whole-food nutrition. Emphasize versatility.

IMPORTANT: Respond with ONLY valid JSON matching this schema:

{
  "content_type": "recipe|product|comparison|guide",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "metadata": {
    "title": "Main page title (max 60 chars)",
    "description": "Brief summary (max 150 chars)",
    "primary_image_prompt": "Detailed hero image description for AI generation"
  },
  "content_atoms": [
    // Include relevant atoms based on content_type. Order doesn't matter - layout is determined separately.

    // ALWAYS include for all types:
    { "type": "heading", "level": 1, "text": "Main headline" },
    { "type": "paragraph", "text": "Introductory paragraph with valuable information" },

    // For FAQs (always include 3):
    { "type": "faq_set", "items": [
      {"question": "Question?", "answer": "Detailed answer (2-3 sentences)"}
    ]},

    // For features/products (always include 3):
    { "type": "feature_set", "items": [
      {"title": "Feature name", "description": "Brief description", "image_prompt": "Image description", "cta_text": "Learn More"}
    ]},

    // For related topics (always include 4):
    { "type": "related", "items": [
      {"title": "Related topic", "description": "Why explore this"}
    ]},

    // For CTA:
    { "type": "cta", "title": "Call to action headline", "description": "Compelling reason", "buttons": [
      {"text": "Primary Action", "style": "primary"},
      {"text": "Secondary Action", "style": "secondary"}
    ]},

    // CONDITIONAL atoms based on content_type:

    // For "recipe" - include steps:
    { "type": "steps", "items": [
      {"number": 1, "instruction": "Step instruction", "tip": "Optional tip"}
    ]},

    // For "product" - include specs table:
    { "type": "table", "title": "Specifications", "headers": ["Feature", "Value"], "rows": [
      ["Motor Power", "2.2 HP"],
      ["Container Size", "64 oz"]
    ]},

    // For "comparison" - include ALL relevant products with STANDARDIZED specs:
    { "type": "comparison", "items": [
      {
        "name": "Vitamix A3500",
        "series": "Ascent",
        "price": "$629",
        "rating": 4.8,
        "description": "Brief description of product features",
        "image_url": "COPY THE EXACT Product Image URL FROM RAG CONTEXT for this product",
        "specs": {
          "series": "Ascent",
          "price": "$629",
          "motor": "2.2 HP",
          "container": "64 oz",
          "warranty": "10 years",
          "programs": 5,
          "smart": true,
          "interface": "Touchscreen"
        },
        "pros": ["Pro 1", "Pro 2"],
        "cons": ["Con 1"]
      }
    ]},
    // IMPORTANT for comparison: Include ALL Vitamix models in the relevant category
    // For "show all models" type queries, include at minimum: A3500, A2500, A2300, E320, E310, 750, Propel
    // Always use consistent spec keys: series, price, motor, container, warranty, programs, smart, interface
    // CRITICAL: Each comparison item MUST include an image_url with the EXACT URL from RAG context
    // Look for "Product Image URL:" in the RAG data and copy that URL exactly
    // DO NOT use image_prompt for comparison items - use actual image URLs from the PRODUCT IMAGES section

    // For "guide" or "comparison" when user needs help choosing - include interactive_guide:
    // Use this for queries like "best blender for smoothies", "which vitamix should I buy", "help me choose"
    { "type": "interactive_guide", "title": "Find Your Perfect Match", "subtitle": "Select your priority to see our top pick", "picks": [
      {
        "tab_label": "Best Value & Features",
        "tab_icon": "dollar",
        "badge": "BEST VALUE",
        "badge_style": "best-value",
        "product": {
          "name": "Vitamix A2500",
          "series": "Ascent Series",
          "price": "$549",
          "rating": 4.8,
          "description": "The perfect balance of features and price...",
          "image_url": "COPY THE EXACT Product Image URL FROM RAG CONTEXT for this product",
          "specs": { "Container": "64 oz", "Warranty": "10 Years", "Motor": "2.2 HP", "Programs": "3 presets" },
          "url": "https://www.vitamix.com/us/en_us/shop/a2500"
        },
        "pros": ["Great value for features", "Self-Detect technology", "10-year warranty"],
        "cons": ["No touchscreen", "No Bluetooth connectivity"]
      },
      {
        "tab_label": "High-Tech & Smart",
        "tab_icon": "wifi",
        "badge": "CHEF'S FAVORITE",
        "badge_style": "chef-favorite",
        "product": { ... },
        "pros": [...],
        "cons": [...]
      }
    ]}

    // For detailed content - include paragraphs/lists:
    { "type": "paragraph", "text": "Additional paragraph" },
    { "type": "list", "style": "bullet", "items": ["Item 1", "Item 2", "Item 3"] },

    // SINGLE PRODUCT DETAIL PAGE (content_type: "single_product"):
    // Use this for specific product queries like "vitamix a3500", "tell me about the e310"
    { "type": "product_detail",
      "name": "Vitamix A3500",
      "series": "Ascent Series",
      "tagline": "The ultimate blending machine with touchscreen control",
      "price": "$629",
      "url": "https://www.vitamix.com/vr/en_us/shop/blenders/a3500i",
      "image_url": "Modern Vitamix A3500 blender with touchscreen display, sleek black finish, 64oz container, professional product shot on white background",
      "warranty": "10-Year Full Warranty",
      "highlights": [
        "Touchscreen controls with 5 program settings",
        "Self-Detect technology for container recognition",
        "Variable speed + pulse control"
      ],
      "description": "Detailed description of the product...",
      "features": [
        { "title": "Touchscreen Interface", "description": "..." },
        { "title": "Self-Detect Technology", "description": "..." }
      ],
      "specs": {
        "motor": "2.2 HP",
        "container": "64 oz Low-Profile",
        "dimensions": "17.5 x 11 x 9 inches",
        "weight": "12.5 lbs",
        "cord_length": "4 ft",
        "programs": "5 (Smoothies, Hot Soups, Dips, Frozen Desserts, Self-Cleaning)",
        "warranty": "10 Years"
      },
      "whats_included": ["Motor Base", "64-oz Container", "Tamper", "Getting Started Guide"],
      "related_products": [
        { "name": "Vitamix A2500", "price": "$549", "description": "Ascent Series with programmable settings", "query": "vitamix a2500", "image_prompt": "Modern Vitamix A2500 blender with dial controls, sleek design, 64oz container, professional product shot" },
        { "name": "Vitamix E320", "price": "$449", "description": "Explorian Series entry-level professional", "query": "vitamix e320", "image_prompt": "Vitamix E320 Explorian blender with dial speed control, compact design, professional product photography" }
      ]
    },

    // SINGLE RECIPE DETAIL PAGE (content_type: "single_recipe"):
    // Use this for specific recipe queries like "mango smoothie recipe", "how to make tomato soup"
    { "type": "recipe_detail",
      "name": "Tropical Mango Smoothie",
      "description": "A refreshing tropical blend perfect for hot summer days",
      "image_url": "URL or image_prompt for AI generation",
      "prep_time": "5 minutes",
      "total_time": "5 minutes",
      "servings": "2 servings",
      "difficulty": "Easy",
      "ingredients": [
        { "amount": "1 cup", "name": "frozen mango chunks" },
        { "amount": "1/2 cup", "name": "pineapple pieces" },
        { "amount": "1 cup", "name": "coconut milk" },
        { "amount": "1 tbsp", "name": "honey (optional)" }
      ],
      "steps": [
        { "instruction": "Add all ingredients to your Vitamix container in the order listed.", "tip": "Liquid first helps create a smoother blend" },
        { "instruction": "Secure the lid and select Variable 1.", "tip": null },
        { "instruction": "Turn the machine on and quickly increase to Variable 10.", "tip": null },
        { "instruction": "Blend for 45-60 seconds until smooth.", "tip": "Use the tamper if needed to press ingredients toward the blades" },
        { "instruction": "Serve immediately.", "tip": null }
      ],
      "chef_notes": "For a thicker smoothie, add more frozen fruit. For extra protein, add a scoop of your favorite protein powder.",
      "nutrition": {
        "serving_size": "1 cup",
        "calories": "180",
        "protein": "2g",
        "carbs": "32g",
        "fat": "6g",
        "fiber": "3g",
        "sugar": "25g"
      },
      "equipment": ["Vitamix Blender", "64-oz Container"],
      "tags": ["Smoothie", "Tropical", "Vegan", "Dairy-Free", "Quick"],
      "related_recipes": [
        { "name": "Pineapple Paradise Smoothie", "description": "Another tropical favorite", "query": "pineapple smoothie recipe", "image_prompt": "A vibrant pineapple smoothie in a glass with pineapple chunks, bright yellow color, tropical setting" },
        { "name": "Green Mango Smoothie", "description": "Add some greens for extra nutrition", "query": "green mango smoothie", "image_prompt": "A green mango smoothie in a glass with spinach leaves and mango slices, vibrant green color" }
      ]
    }
  ],

  // LAYOUT BLOCKS - Select and order the blocks to display content
  // You MUST include this array to specify how content should be rendered
  "layout_blocks": [
    {
      "block_type": "hero-banner",
      "atom_mappings": {
        "title": "heading.text",
        "subtitle": "paragraph.text",
        "image": "metadata.primary_image_prompt"
      }
    }
    // ... more blocks in sequence
  ]
}

AVAILABLE BLOCKS (use block_type values):
- hero-banner: Full-width hero section with title, subtitle, and optional image (required for most pages)
- feature-cards: Grid of 3 feature cards with images, titles, and descriptions (requires feature_set atom)
- faq-accordion: Expandable FAQ section with questions and answers (requires faq_set atom)
- cta-section: Call-to-action section with headline, description, and buttons (requires cta atom)
- related-topics: Grid of related topic cards for continued exploration (requires related atom)
- text-section: Large text section for detailed explanations (requires paragraph atoms)
- comparison-cards: Interactive card grid with product images, prices, ratings. Users can select and compare side-by-side. Best for browsing 3+ products (requires comparison atom)
- comparison-table: Simple horizontal table for quick spec comparison of 2-3 products (requires comparison atom)
- specs-table: Structured specification table for product details (requires table atom)
- step-by-step: Numbered step-by-step instructions with optional tips (requires steps atom)
- bullet-list: Bulleted or numbered list for key points (requires list atom)
- interactive-guide: Tab-based product selection guide with top 2-4 product picks organized by user intent. Each tab shows detailed product card with specs, pros/cons. Best for helping users choose between curated options (requires interactive_guide atom)
- product-detail: Comprehensive single product page with hero gallery, specs accordion, features grid. Use ONLY for single_product content type (requires product_detail atom)
- recipe-detail: Comprehensive single recipe page with hero image, ingredients, steps, nutrition. Use ONLY for single_recipe content type (requires recipe_detail atom)

LAYOUT RULES:
1. CRITICAL for single_product: Use ONLY the 'product-detail' block. It is comprehensive and standalone - do NOT add other blocks!
2. CRITICAL for single_recipe: Use ONLY the 'recipe-detail' block. It is comprehensive and standalone - do NOT add other blocks!
3. For other content types: Always start with 'hero-banner' for the main heading
4. CRITICAL: If you include an 'interactive_guide' atom, you MUST include the 'interactive-guide' block immediately after hero-banner
5. Place most important content blocks early in the sequence
6. End with 'cta-section' followed by 'related-topics'
7. For recipes (not single_recipe): include 'step-by-step' before the CTA
8. For products (not single_product): include 'specs-table' to show specifications
9. When a 'table' atom is present, ALWAYS include either 'comparison-table' or 'specs-table' to render it
10. For comparisons: prefer 'comparison-cards' for browsing/selecting products
11. Include 'feature-cards' when feature_set atoms are present
12. Include 'faq-accordion' when faq_set atoms are present
13. Maximum 8 blocks per page to maintain focus

ATOM MAPPINGS (use these in atom_mappings):
- heading.text, heading.level
- paragraph.text
- feature_set.items
- faq_set.items
- steps.items
- table.headers, table.rows, table.title
- comparison.items
- cta.title, cta.description, cta.buttons
- related.items
- list.items, list.style
- metadata.primary_image_prompt, metadata.title, metadata.description
- interactive_guide.title, interactive_guide.subtitle, interactive_guide.picks
- product_detail (for product-detail block)
- recipe_detail (for recipe-detail block)

GUIDELINES:
- Determine content_type based on query intent:
  - "single_product" for SPECIFIC product queries like "vitamix a3500", "tell me about the e310", "a2500 specs"
    * MUST include a product_detail atom with comprehensive information
    * Pull data from RAG context when available
    * CRITICAL: Extract the product's shop URL from RAG sources (e.g., https://www.vitamix.com/vr/en_us/shop/blenders/a3500i)
  - "single_recipe" for SPECIFIC recipe queries like "mango smoothie recipe", "how to make tomato soup"
    * MUST include a recipe_detail atom with ingredients, steps, nutrition
    * Can augment RAG data with generated content
  - "recipe" for GENERIC food/recipe category queries like "smoothies", "breakfast ideas", "healthy recipes"
  - "comparison" for "show all", "compare models", "vs", explicit product comparisons
  - "product" for general product category queries (not specific models)
  - "guide" for how-to queries OR personalized recommendation queries like "which vitamix should I buy", "help me choose", "recommend", "best for me", "what should I get"
- For single_product: include ONLY product_detail atom (it's comprehensive)
- For single_recipe: include ONLY recipe_detail atom (it's comprehensive)
- For other types: include heading, intro paragraph, faq_set (3), feature_set (3), related (4), cta

CRITICAL - RECIPE QUERY HANDLING:
- GENERIC RECIPE QUERIES (e.g., "smoothies", "healthy recipes", "breakfast ideas", "soups"):
  - Do NOT include step-by-step instructions for a single recipe
  - Instead, use feature_set to showcase 3-4 specific recipe OPTIONS the user can choose from
  - Each feature should be a distinct recipe with title, brief description, and enticing image_prompt
  - Title should be a category/collection page (e.g., "Delicious Smoothie Recipes", "Healthy Breakfast Ideas")
  - Include related topics that link to more specific recipes

- SPECIFIC RECIPE QUERIES (e.g., "mango smoothie recipe", "how to make tomato soup", "green detox smoothie"):
  - Title the page with the SPECIFIC recipe name (e.g., "Mango Tropical Smoothie Recipe")
  - MUST include a "steps" atom with detailed numbered instructions (5-8 steps)
  - Include ingredient list in intro paragraph or as a list atom
  - Include a "related" atom with 4 RELATED RECIPES the user might also enjoy
  - Related recipes should be variations or complementary recipes (e.g., for mango smoothie: "Pineapple Paradise Smoothie", "Tropical Green Smoothie", "Mango Lassi")

CRITICAL - INTERACTIVE GUIDE ATOM:
- For "guide" content_type when user asks for help choosing, YOU MUST include an interactive_guide atom
- Trigger phrases: "which vitamix should I buy", "help me choose", "recommend a vitamix", "best blender for [use case]", "what vitamix is best", "which one should I get"
- The interactive_guide atom provides 2-4 curated product recommendations organized by user priority tabs
- This is REQUIRED for personalized recommendation queries - do NOT skip it

- For recipes: include steps with numbered instructions and tips
- For products: include table with specifications
- For comparisons (content_type: comparison): include comparison atom with ALL relevant products (6-10 products)
  - Use comparison atom for "show all models", "compare A vs B", "all vitamix blenders"
  - Each product must have: name, series, price, rating, description, image_prompt, specs object
  - REQUIRED: Each comparison item MUST include an image_prompt for AI product photography
  - image_prompt format: "Modern Vitamix [model] blender with [finish], [container size] container, professional product shot"
  - Specs must use consistent keys: series, price, motor, container, warranty, programs, smart, interface
- For guide with interactive_guide atom (content_type: guide): include 2-4 curated picks
  - Use this instead of comparison when user wants personalized help: "which should I buy", "recommend", "best for smoothies"
  - Each pick has tab_label (user priority), tab_icon, badge, badge_style, product details, pros, and cons
  - tab_labels should reflect user priorities (e.g., "Best Value", "High-Tech", "Proven Classic", "Budget-Friendly")
  - tab_icon options: "dollar", "wifi", "star", "heart"
  - badge_style options: "best-value", "chef-favorite", "smart"
- Use RAG context data when available for accurate specs/prices
- CRITICAL URL RULE: For product_detail.url field, you MUST copy the EXACT URL from RAG context
  - Look for "Product Page:" in the RAG data and use that URL EXACTLY
  - Correct format: https://www.vitamix.com/vr/en_us/shop/blenders/a2500i
  - NEVER use /products/ URLs - these are WRONG and will 404
  - NEVER make up URLs - only use URLs from RAG context
  - If no RAG URL available, set url to null
- Image prompts should be detailed and appetizing for food, or professional for products`;

// URL mapping for products without RAG (fallback)
const VITAMIX_PRODUCT_URLS = {
  'a3500': 'https://www.vitamix.com/vr/en_us/shop/blenders/a3500i',
  'a2500': 'https://www.vitamix.com/vr/en_us/shop/blenders/a2500i',
  'a2300': 'https://www.vitamix.com/vr/en_us/shop/blenders/a2300i',
  'e310': 'https://www.vitamix.com/vr/en_us/shop/blenders/e310',
  'e320': 'https://www.vitamix.com/vr/en_us/shop/blenders/e320',
  'v1200': 'https://www.vitamix.com/vr/en_us/shop/blenders/venturist-v1200i',
  '750': 'https://www.vitamix.com/us/en_us/shop/professional-series-750',
};

/**
 * Legacy system prompt for backward compatibility
 */
const LEGACY_SYSTEM_PROMPT = `You are a content generator for Vitamix, the premium blender company. Create engaging, helpful content about blenders, recipes, and cooking techniques.

VITAMIX PRODUCT KNOWLEDGE:
- Ascent Series: A2300, A2500, A3300, A3500 (Self-Detect technology, wireless connectivity, touchscreen on A3500)
- Explorian Series: E310, E320 (great value, professional-grade power)
- Propel Series: Entry-level, powerful 2.2 HP motor
- Professional Series: 750, 300 (commercial-grade, NSF certified)
- Personal Cup Adapters: 20oz cups for single servings
- Container sizes: 64oz standard, 48oz wet/dry, 20oz personal cup

KEY FEATURES TO HIGHLIGHT:
- 10-year full warranty (industry leading)
- Aircraft-grade stainless steel blades that never need replacing
- Hot soup in 6 minutes from raw ingredients (friction heating)
- Self-cleaning in 60 seconds with warm water and dish soap
- Variable speed control (1-10) plus Pulse
- Built-in programs: Smoothies, Hot Soups, Frozen Desserts, Dips & Spreads, Self-Cleaning

BRAND VOICE:
- Helpful, expert, approachable
- Focus on whole-food nutrition and health benefits
- Emphasize "blend vitamins IN, not out" (no straining needed)
- Highlight versatility (one machine replaces 10 appliances)
- American craftsmanship and durability

IMPORTANT: You must respond with ONLY valid JSON matching this exact schema. Do not include any text before or after the JSON.

{
  "type": "recipe|product|guide|comparison",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "hero": {
    "title": "Engaging headline (max 60 chars)",
    "subtitle": "Supporting description that explains the value proposition (max 150 chars)",
    "cta_text": "Action button text (e.g., 'Explore Recipes', 'Shop Now')",
    "image_prompt": "Detailed description for generating a hero image (be specific about colors, composition, food items)"
  },
  "body": {
    "paragraphs": [
      "First paragraph with valuable information (2-3 sentences)",
      "Second paragraph with more details (2-3 sentences)"
    ],
    "cta_text": "Optional secondary CTA button text"
  },
  "features": [
    {
      "title": "Feature/Recipe name",
      "description": "Brief description of this item (max 100 chars)",
      "image_prompt": "Description for feature image (food photography style)",
      "cta_text": "Button text (e.g., 'Get Recipe', 'Learn More')"
    }
  ],
  "faqs": [
    {
      "question": "Common question about this topic?",
      "answer": "Helpful, detailed answer (2-3 sentences)"
    }
  ],
  "cta": {
    "title": "Final call-to-action headline",
    "description": "Compelling description to drive action",
    "buttons": [
      {"text": "Primary button", "style": "primary"},
      {"text": "Secondary button", "style": "secondary"}
    ]
  },
  "related": [
    {
      "title": "Related topic title",
      "description": "Why the user might want to explore this next"
    }
  ]
}

Guidelines:
- Generate 3 features (recipes or products depending on query)
- Generate 3 FAQs relevant to the topic
- Generate 4 related topics for continued exploration
- Always recommend specific Vitamix models when relevant
- Include container size recommendations when discussing recipes
- Image prompts should describe appetizing food photography with good lighting
- Keep content focused on the user's query while naturally connecting to Vitamix products`;

/**
 * Helper to call Claude API with a given prompt
 * @private
 */
async function callClaudeAPI(query, apiKey, systemPrompt, ragContext) {
  const userMessage = `Generate content for this Vitamix-related query: "${query}"
${ragContext}
Remember to respond with ONLY valid JSON matching the schema. No explanations or markdown.`;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract text content from response
  const textContent = data.content.find((block) => block.type === 'text');
  if (!textContent) {
    throw new Error('No text content in Claude response');
  }

  // Parse JSON response
  let jsonText = textContent.text.trim();
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

  return JSON.parse(jsonText);
}

/**
 * Fix incorrect Vitamix product URLs in content atoms
 * Replaces /products/ URLs with correct /vr/en_us/shop/blenders/ URLs
 * @param {Array} contentAtoms - Content atoms array
 * @returns {Array} Fixed content atoms
 */
function fixProductUrls(contentAtoms) {
  if (!Array.isArray(contentAtoms)) return contentAtoms;

  return contentAtoms.map((atom) => {
    if (atom.type === 'product_detail' && atom.url) {
      // Check if URL uses incorrect /products/ format
      if (atom.url.includes('/products/') || atom.url.includes('/us/en_us/shop/')) {
        // Extract model from URL
        const urlLower = atom.url.toLowerCase();
        let fixedUrl = null;

        // Match known product models
        if (urlLower.includes('a3500')) {
          fixedUrl = VITAMIX_PRODUCT_URLS['a3500'];
        } else if (urlLower.includes('a2500')) {
          fixedUrl = VITAMIX_PRODUCT_URLS['a2500'];
        } else if (urlLower.includes('a2300')) {
          fixedUrl = VITAMIX_PRODUCT_URLS['a2300'];
        } else if (urlLower.includes('e310')) {
          fixedUrl = VITAMIX_PRODUCT_URLS['e310'];
        } else if (urlLower.includes('e320')) {
          fixedUrl = VITAMIX_PRODUCT_URLS['e320'];
        } else if (urlLower.includes('v1200')) {
          fixedUrl = VITAMIX_PRODUCT_URLS['v1200'];
        } else if (urlLower.includes('750')) {
          fixedUrl = VITAMIX_PRODUCT_URLS['750'];
        }

        if (fixedUrl) {
          console.log(`Fixed product URL: ${atom.url} -> ${fixedUrl}`);
          return { ...atom, url: fixedUrl };
        }
      }
    }
    return atom;
  });
}

/**
 * Generate content atoms for flexible layout system (NEW)
 * Used with Gemini layout selection for dynamic page layouts
 * @param {string} query - User's search query
 * @param {string} apiKey - Anthropic API key
 * @param {object} options - Optional RAG options
 * @returns {Promise<{contentAtoms: Array, contentType: string, metadata: object, sourceIds: string[], sourceImages: Array}>}
 */
export async function generateContentAtoms(query, apiKey, options = {}) {
  const { supabase, ai, env } = options;

  // RAG: Retrieve relevant context if configured
  let ragContext = '';
  let sourceIds = [];
  let sourceImages = [];
  let classification = null;
  let ragCached = false;

  if (supabase && ai) {
    try {
      const ragResult = await retrieveContext(query, ai, supabase, {}, env);
      ragContext = ragResult.context;
      sourceIds = ragResult.sourceIds;
      sourceImages = ragResult.sourceImages || [];
      classification = ragResult.classification || null;
      ragCached = ragResult.cached || false;
      if (ragCached) {
        console.log('RAG: Using cached result');
      }
    } catch (ragError) {
      console.error('RAG retrieval failed, continuing without context:', ragError);
    }
  }

  try {
    const content = await callClaudeAPI(query, apiKey, CONTENT_ATOMS_PROMPT, ragContext);

    // Post-process content atoms to fix any incorrect URLs
    const fixedAtoms = fixProductUrls(content.content_atoms || []);

    return {
      contentAtoms: fixedAtoms,
      contentType: content.content_type || 'guide',
      metadata: content.metadata || { title: query, description: '', primary_image_prompt: '' },
      keywords: content.keywords || [],
      layoutBlocks: content.layout_blocks || null, // New: layout blocks from Claude
      sourceIds,
      sourceImages,
      classification, // Query classification from RAG
    };
  } catch (parseError) {
    console.error('Failed to parse Claude content atoms response:', parseError);
    throw new Error('Invalid JSON response from Claude');
  }
}

/**
 * Generate page content using Claude API (LEGACY - for backward compatibility)
 * Uses the old fixed layout schema
 * @param {string} query - User's search query
 * @param {string} apiKey - Anthropic API key
 * @param {object} options - Optional RAG options
 * @param {object} options.supabase - Supabase client for RAG
 * @param {string} options.openaiApiKey - OpenAI API key for embeddings
 * @returns {Promise<{content: object, sourceIds: string[], sourceImages: Array}>} Parsed content, source IDs, and images
 */
export async function generateContent(query, apiKey, options = {}) {
  const { supabase, ai, env } = options;

  // RAG: Retrieve relevant context if configured
  let ragContext = '';
  let sourceIds = [];
  let sourceImages = [];

  if (supabase && ai) {
    try {
      const ragResult = await retrieveContext(query, ai, supabase, {}, env);
      ragContext = ragResult.context;
      sourceIds = ragResult.sourceIds;
      sourceImages = ragResult.sourceImages || [];
      if (ragResult.cached) {
        console.log('RAG: Using cached result');
      }
    } catch (ragError) {
      console.error('RAG retrieval failed, continuing without context:', ragError);
    }
  }

  try {
    const content = await callClaudeAPI(query, apiKey, LEGACY_SYSTEM_PROMPT, ragContext);
    return { content, sourceIds, sourceImages };
  } catch (parseError) {
    console.error('Failed to parse Claude response:', parseError);
    throw new Error('Invalid JSON response from Claude');
  }
}
