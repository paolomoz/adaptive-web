/**
 * Query Classifier
 * Classifies user queries to optimize RAG retrieval and image selection
 */

/**
 * Query classification types
 * @typedef {'product' | 'recipe' | 'blog' | 'support' | 'commercial' | 'general'} QueryType
 */

/**
 * Classification result
 * @typedef {Object} ClassificationResult
 * @property {QueryType} type - Primary query type
 * @property {number} confidence - Confidence score 0-1
 * @property {string[]} keywords - Extracted keywords
 * @property {boolean} needsProductImages - Whether real product images are needed
 * @property {boolean} needsRecipeImages - Whether real recipe images are needed
 */

// Pattern-based classification rules
const CLASSIFICATION_RULES = {
  product: {
    patterns: [
      /\b(blender|vitamix|ascent|explorian|propel|professional|a2[35]00|a3[35]00|e3[12]0|750|container|blade|tamper|cup|pitcher)\b/i,
      /\b(buy|price|cost|compare|vs|versus|best|which|review|model|series)\b/i,
      /\b(warranty|features?|specs?|specifications?|motor|watt|hp|horsepower)\b/i,
      /\b(gift|holiday|sale|deal|discount|bundle)\b/i,
    ],
    weight: 1.0,
  },
  recipe: {
    patterns: [
      /\b(recipe|smoothie|soup|sauce|dip|spread|butter|milk|juice|puree|blend)\b/i,
      /\b(make|cook|prepare|ingredient|cup|tbsp|tsp|oz|ounce)\b/i,
      /\b(healthy|vegan|vegetarian|gluten.?free|dairy.?free|keto|paleo)\b/i,
      /\b(breakfast|lunch|dinner|snack|dessert|appetizer)\b/i,
      /\b(almond|cashew|oat|banana|berry|mango|spinach|kale|avocado)\b/i,
    ],
    weight: 1.0,
  },
  blog: {
    patterns: [
      /\b(tips?|ideas?|ways?|how to|guide|article|learn|benefits?)\b/i,
      /\b(nutrition|health|wellness|lifestyle|kitchen|cooking)\b/i,
      /\b(meal prep|food waste|composting|sustainability)\b/i,
    ],
    weight: 0.8,
  },
  support: {
    patterns: [
      /\b(help|support|troubleshoot|fix|problem|issue|error|broken)\b/i,
      /\b(manual|instructions?|how do i|warranty|repair|service|return)\b/i,
      /\b(clean|cleaning|maintenance|care|store|storage)\b/i,
      /\b(register|registration|serial|contact)\b/i,
    ],
    weight: 0.9,
  },
  commercial: {
    patterns: [
      /\b(commercial|restaurant|business|foodservice|cafe|bar|hotel)\b/i,
      /\b(quiet one|drink machine|vita.?prep|blending station)\b/i,
      /\b(nsf|certified|volume|industrial)\b/i,
    ],
    weight: 0.9,
  },
};

// Keywords that strongly indicate specific types
const STRONG_INDICATORS = {
  product: ['vitamix', 'ascent', 'explorian', 'propel', 'a2300', 'a2500', 'a3300', 'a3500', 'e310', 'e320', '750'],
  recipe: ['recipe', 'smoothie', 'soup', 'sauce', 'ingredients'],
  support: ['warranty', 'repair', 'troubleshoot', 'manual'],
  commercial: ['commercial', 'restaurant', 'quiet one'],
};

/**
 * Classify a user query
 * @param {string} query - User's search query
 * @returns {ClassificationResult} Classification result
 */
export function classifyQuery(query) {
  const queryLower = query.toLowerCase();
  const scores = {};

  // Initialize scores
  for (const type of Object.keys(CLASSIFICATION_RULES)) {
    scores[type] = 0;
  }

  // Check strong indicators first
  for (const [type, indicators] of Object.entries(STRONG_INDICATORS)) {
    for (const indicator of indicators) {
      if (queryLower.includes(indicator)) {
        scores[type] += 2.0; // Strong boost
      }
    }
  }

  // Apply pattern matching
  for (const [type, rules] of Object.entries(CLASSIFICATION_RULES)) {
    for (const pattern of rules.patterns) {
      if (pattern.test(query)) {
        scores[type] += rules.weight;
      }
    }
  }

  // Find the highest scoring type
  let maxScore = 0;
  let primaryType = 'general';

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      primaryType = type;
    }
  }

  // Calculate confidence (normalize to 0-1)
  const confidence = Math.min(maxScore / 5.0, 1.0);

  // Extract keywords from query
  const keywords = extractKeywords(query);

  // Determine image needs
  const needsProductImages = primaryType === 'product' ||
    (primaryType === 'general' && scores.product > 0) ||
    primaryType === 'commercial';

  const needsRecipeImages = primaryType === 'recipe' ||
    (primaryType === 'blog' && scores.recipe > 0);

  return {
    type: primaryType,
    confidence,
    keywords,
    needsProductImages,
    needsRecipeImages,
    // Include scores for debugging/tuning
    _scores: scores,
  };
}

/**
 * Extract meaningful keywords from query
 * @param {string} query - User query
 * @returns {string[]} Extracted keywords
 */
function extractKeywords(query) {
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
    'because', 'until', 'while', 'although', 'though', 'after', 'before',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them',
    'their', 'theirs', 'themselves', 'best', 'good', 'great', 'make', 'get',
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Deduplicate while preserving order
  return [...new Set(words)];
}

/**
 * Get RAG filter options based on classification
 * @param {ClassificationResult} classification - Query classification
 * @returns {Object} Filter options for RAG retrieval
 */
export function getRAGFilterOptions(classification) {
  const options = {
    // Base options
    threshold: 0.65,
    limit: 5,
  };

  // Adjust based on type
  switch (classification.type) {
    case 'product':
      options.limit = 8; // More results for product comparisons
      options.preferredTypes = ['product', 'shop'];
      options.threshold = 0.6; // Slightly lower threshold to catch more products
      break;

    case 'recipe':
      options.limit = 6;
      options.preferredTypes = ['recipe'];
      options.threshold = 0.65;
      break;

    case 'blog':
      options.limit = 5;
      options.preferredTypes = ['blog', 'page'];
      break;

    case 'support':
      options.limit = 5;
      options.preferredTypes = ['support', 'page'];
      options.threshold = 0.6; // Lower threshold for support to catch edge cases
      break;

    case 'commercial':
      options.limit = 6;
      options.preferredTypes = ['commercial', 'product'];
      break;

    default:
      // General queries - broader search
      options.limit = 6;
      options.threshold = 0.65;
  }

  return options;
}
