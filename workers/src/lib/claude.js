/**
 * Claude API Integration
 * Generates structured content for AdaptiveWeb pages
 */

import { retrieveContext } from './rag.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * System prompt for Vitamix content generation
 * Enhanced with detailed product knowledge and brand guidelines
 */
const SYSTEM_PROMPT = `You are a content generator for Vitamix, the premium blender company. Create engaging, helpful content about blenders, recipes, and cooking techniques.

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
 * Generate page content using Claude API
 * Uses prompt caching to reduce latency and costs for the large system prompt
 * @param {string} query - User's search query
 * @param {string} apiKey - Anthropic API key
 * @param {object} options - Optional RAG options
 * @param {object} options.supabase - Supabase client for RAG
 * @param {string} options.openaiApiKey - OpenAI API key for embeddings
 * @returns {Promise<{content: object, sourceIds: string[]}>} Parsed content and source IDs
 */
export async function generateContent(query, apiKey, options = {}) {
  const { supabase, openaiApiKey } = options;

  // RAG: Retrieve relevant context if configured
  let ragContext = '';
  let sourceIds = [];

  if (supabase && openaiApiKey) {
    try {
      const ragResult = await retrieveContext(query, openaiApiKey, supabase);
      ragContext = ragResult.context;
      sourceIds = ragResult.sourceIds;
    } catch (ragError) {
      console.error('RAG retrieval failed, continuing without context:', ragError);
    }
  }

  // Build user message with optional RAG context
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
          text: SYSTEM_PROMPT,
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
  try {
    // Clean up potential markdown code blocks
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

    const content = JSON.parse(jsonText);
    return { content, sourceIds };
  } catch (parseError) {
    console.error('Failed to parse Claude response:', textContent.text);
    throw new Error('Invalid JSON response from Claude');
  }
}
