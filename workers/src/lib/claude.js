/**
 * Claude API Integration
 * Generates structured content for AdaptiveWeb pages
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * System prompt for Vitamix content generation
 */
const SYSTEM_PROMPT = `You are a content generator for Vitamix, the premium blender company. Create engaging, helpful content about blenders, recipes, and cooking techniques.

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
- Use Vitamix brand voice: helpful, expert, approachable
- Image prompts should describe appetizing food photography with good lighting
- Keep content focused on the user's query while connecting to Vitamix products`;

/**
 * Generate page content using Claude API
 * @param {string} query - User's search query
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<object>} Parsed content object
 */
export async function generateContent(query, apiKey) {
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate content for this Vitamix-related query: "${query}"

Remember to respond with ONLY valid JSON matching the schema. No explanations or markdown.`,
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

    return JSON.parse(jsonText);
  } catch (parseError) {
    console.error('Failed to parse Claude response:', textContent.text);
    throw new Error('Invalid JSON response from Claude');
  }
}
