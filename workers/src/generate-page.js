/**
 * Generate Page API Endpoint
 * Creates AI-generated content for a user query
 *
 * Supports two pipelines:
 * 1. Legacy (default): Claude generates fixed-layout content
 * 2. Flexible: Claude → Imagen (Claude generates content + layout, Imagen for images)
 */

import { generateContent, generateContentAtoms } from './lib/claude.js';

/**
 * Timing tracker for monitoring generation performance
 */
class TimingTracker {
  constructor() {
    this.startTime = Date.now();
    this.phases = {};
    this.currentPhase = null;
    this.phaseStart = null;
  }

  startPhase(name) {
    if (this.currentPhase && this.phaseStart) {
      this.phases[this.currentPhase] = Date.now() - this.phaseStart;
    }
    this.currentPhase = name;
    this.phaseStart = Date.now();
  }

  endPhase() {
    if (this.currentPhase && this.phaseStart) {
      this.phases[this.currentPhase] = Date.now() - this.phaseStart;
      this.currentPhase = null;
      this.phaseStart = null;
    }
  }

  getTimings(extras = {}) {
    this.endPhase();
    return {
      total_ms: Date.now() - this.startTime,
      phases: this.phases,
      ...extras,
    };
  }
}
import { getFallbackLayout } from './lib/gemini.js';
import { createClient as createSupabaseClient } from './lib/supabase.js';
import { createClient as createCloudflareClient } from './lib/cloudflare-db.js';
import { generateImages as generateImagenImages } from './lib/imagen.js';
import { determineImageStrategy, findMatchingImages, applyMatchedImages } from './lib/hybrid-images.js';

/**
 * Get the appropriate database client based on feature flag
 * @param {object} env - Worker environment
 * @returns {object} Database client (Supabase or Cloudflare D1)
 */
function getDbClient(env) {
  const useCloudflare = env.USE_CLOUDFLARE_DB === 'true';
  if (useCloudflare) {
    console.log('Using Cloudflare D1/Vectorize backend');
    return createCloudflareClient(env);
  }
  console.log('Using Supabase backend');
  return createSupabaseClient(env);
}

/**
 * Extract image prompts from legacy content structure
 */
function extractImagePrompts(content) {
  const prompts = [];

  // Hero image
  if (content.hero?.image_prompt) {
    prompts.push({
      type: 'hero',
      prompt: content.hero.image_prompt,
    });
  }

  // Feature images
  if (content.features?.length) {
    content.features.forEach((feature, index) => {
      if (feature.image_prompt) {
        prompts.push({
          type: 'feature',
          index,
          prompt: feature.image_prompt,
        });
      }
    });
  }

  return prompts;
}

/**
 * Extract image prompts from flexible content atoms
 * @param {Array} contentAtoms - Content atoms from Claude
 * @param {object} metadata - Page metadata from Claude
 * @returns {Array} Image prompts for Imagen
 */
function extractImagePromptsFromAtoms(contentAtoms, metadata) {
  const prompts = [];

  // Hero image from metadata
  if (metadata?.primary_image_prompt) {
    prompts.push({
      type: 'hero',
      prompt: metadata.primary_image_prompt,
    });
  }

  // Feature images from feature_set atoms
  const featureSet = contentAtoms.find((a) => a.type === 'feature_set');
  if (featureSet?.items) {
    featureSet.items.forEach((feature, index) => {
      if (feature.image_prompt) {
        prompts.push({
          type: 'feature',
          index,
          prompt: feature.image_prompt,
        });
      }
    });
  }

  // Comparison product images from comparison atoms
  const comparison = contentAtoms.find((a) => a.type === 'comparison');
  if (comparison?.items) {
    comparison.items.forEach((product, index) => {
      if (product.image_prompt) {
        prompts.push({
          type: 'comparison',
          index,
          prompt: product.image_prompt,
        });
      }
    });
  }

  // Recipe image from recipe_detail atoms
  const recipeDetail = contentAtoms.find((a) => a.type === 'recipe_detail');
  if (recipeDetail?.image_url && !recipeDetail.image_url.startsWith('http')) {
    // image_url contains a prompt if it doesn't start with http
    prompts.push({
      type: 'recipe',
      prompt: recipeDetail.image_url,
    });
  }

  // Product image from product_detail atoms
  const productDetail = contentAtoms.find((a) => a.type === 'product_detail');
  if (productDetail?.image_url && !productDetail.image_url.startsWith('http')) {
    // image_url contains a prompt if it doesn't start with http
    prompts.push({
      type: 'product',
      prompt: productDetail.image_url,
    });
  }

  // Related recipe images from recipe_detail atoms
  if (recipeDetail?.related_recipes) {
    recipeDetail.related_recipes.forEach((recipe, index) => {
      if (recipe.image_prompt) {
        prompts.push({
          type: 'related_recipe',
          index,
          prompt: recipe.image_prompt,
        });
      }
    });
  }

  // Related product images from product_detail atoms
  if (productDetail?.related_products) {
    productDetail.related_products.forEach((product, index) => {
      if (product.image_prompt) {
        prompts.push({
          type: 'related_product',
          index,
          prompt: product.image_prompt,
        });
      }
    });
  }

  // Interactive guide product images
  const interactiveGuide = contentAtoms.find((a) => a.type === 'interactive_guide');
  if (interactiveGuide?.picks) {
    interactiveGuide.picks.forEach((pick, index) => {
      if (pick.product?.image_url && !pick.product.image_url.startsWith('http')) {
        // image_url contains a prompt if it doesn't start with http
        prompts.push({
          type: 'guide_product',
          index,
          prompt: pick.product.image_url,
        });
      }
    });
  }

  return prompts;
}

/**
 * Apply source images from RAG to page data (synchronously, before returning response)
 * Uses scraped Vitamix product images instead of generating new ones
 * @param {object} pageData - Page data to modify
 * @param {Array} sourceImages - Source images from RAG
 * @returns {object} Modified pageData with image URLs
 */
function applySourceImagesToPageData(pageData, sourceImages) {
  // Flatten all available images from sources
  const allImages = [];
  for (const source of sourceImages) {
    for (const imageUrl of source.images) {
      allImages.push({
        url: imageUrl,
        sourceId: source.sourceId,
        title: source.title,
      });
    }
  }

  if (allImages.length === 0) {
    return pageData;
  }

  console.log(`Applying ${allImages.length} source images to page data`);

  // Create modified page data
  const modifiedData = { ...pageData };

  // Assign hero image (first available)
  if (modifiedData.hero) {
    modifiedData.hero = { ...modifiedData.hero, image_url: allImages[0].url };
  }

  // Assign feature images (remaining images)
  if (modifiedData.features?.length > 0) {
    modifiedData.features = modifiedData.features.map((feature, i) => ({
      ...feature,
      // Use images 1, 2, 3... for features (0 is hero)
      image_url: allImages[(i + 1) % allImages.length].url,
    }));
  }

  // Mark images as ready since we're applying them synchronously
  modifiedData.images_ready = true;

  return modifiedData;
}

/**
 * Apply source images to flexible layout page data
 * @param {object} pageData - Flexible layout page data
 * @param {Array} sourceImages - Source images from RAG
 * @returns {object} Modified pageData with image URLs
 */
function applySourceImagesToFlexiblePageData(pageData, sourceImages) {
  // Flatten all available images from sources
  const allImages = [];
  for (const source of sourceImages) {
    for (const imageUrl of source.images) {
      allImages.push({
        url: imageUrl,
        sourceId: source.sourceId,
        title: source.title,
      });
    }
  }

  if (allImages.length === 0) {
    return pageData;
  }

  console.log(`Applying ${allImages.length} source images to flexible page data`);

  const modifiedData = { ...pageData };

  // Apply to metadata (hero image)
  if (modifiedData.metadata) {
    modifiedData.metadata = {
      ...modifiedData.metadata,
      image_url: allImages[0].url,
    };
  }

  // Helper to match product name to RAG source image
  // Matches "Vitamix A3500" to titles like "Vitamix A3500 Ascent Series" or "Ascent Series A3500"
  const findImageForProduct = (productName) => {
    if (!productName) return null;
    const normalizedName = productName.toLowerCase().replace(/vitamix\s*/i, '').trim();
    // Extract model number (e.g., "A3500", "E310", "750")
    const modelMatch = normalizedName.match(/([ae]?\d{3,4})/i);
    const modelNumber = modelMatch ? modelMatch[1].toLowerCase() : null;

    for (const img of allImages) {
      if (!img.title) continue;
      const normalizedTitle = img.title.toLowerCase();
      // Match by model number
      if (modelNumber && normalizedTitle.includes(modelNumber)) {
        return img.url;
      }
      // Match by normalized name
      if (normalizedTitle.includes(normalizedName)) {
        return img.url;
      }
    }
    return null;
  };

  // Apply to content_atoms
  if (modifiedData.content_atoms) {
    modifiedData.content_atoms = modifiedData.content_atoms.map((atom) => {
      // Handle feature_set atoms
      if (atom.type === 'feature_set' && atom.items) {
        return {
          ...atom,
          items: atom.items.map((item, i) => ({
            ...item,
            image_url: allImages[(i + 1) % allImages.length].url,
          })),
        };
      }
      // Handle comparison atoms - match product names to RAG source titles
      if (atom.type === 'comparison' && atom.items) {
        return {
          ...atom,
          items: atom.items.map((item) => {
            const matchedImage = findImageForProduct(item.name);
            if (matchedImage) {
              return { ...item, image_url: matchedImage };
            }
            return item;
          }),
        };
      }
      return atom;
    });
  }

  modifiedData.images_ready = true;
  return modifiedData;
}

/**
 * Update page in database with source images (background task)
 * Called after response is sent to update the database record
 */
async function updatePageWithSourceImages(pageId, sourceImages, env) {
  try {
    const supabase = getDbClient(env);

    // Flatten all available images from sources
    const allImages = [];
    for (const source of sourceImages) {
      for (const imageUrl of source.images) {
        allImages.push({ url: imageUrl });
      }
    }

    if (allImages.length === 0) return;

    const page = await supabase.getPage(pageId);
    if (!page) return;

    const updates = { images_ready: true };

    // Assign hero image
    if (page.hero) {
      updates.hero = { ...page.hero, image_url: allImages[0].url };
    }

    // Assign feature images
    if (page.features?.length > 0) {
      updates.features = page.features.map((feature, i) => ({
        ...feature,
        image_url: allImages[(i + 1) % allImages.length].url,
      }));
    }

    await supabase.updatePage(pageId, updates);
    console.log(`Source images updated in database for page ${pageId}`);
  } catch (error) {
    console.error('Failed to update page with source images:', error);
  }
}

/**
 * Background image generation task
 */
async function generateImagesBackground(pageId, prompts, env) {
  try {
    const supabase = getDbClient(env);

    // Generate images with Imagen 3 (via Vertex AI)
    const images = await generateImagenImages(
      prompts,
      env.GOOGLE_SERVICE_ACCOUNT_KEY,
      env.GOOGLE_CLOUD_PROJECT,
      env.IMAGES,
      pageId,
    );

    // Build update object
    const updates = { images_ready: true };

    // Find hero image
    const heroImage = images.find((img) => img.type === 'hero');
    if (heroImage) {
      // Get current page data to update hero
      const page = await supabase.getPage(pageId);
      if (page) {
        const updatedHero = { ...page.hero, image_url: heroImage.url };
        updates.hero = updatedHero;
      }
    }

    // Find feature images
    const featureImages = images.filter((img) => img.type === 'feature');
    if (featureImages.length > 0) {
      const page = await supabase.getPage(pageId);
      if (page?.features) {
        const updatedFeatures = [...page.features];
        featureImages.forEach((img) => {
          if (typeof img.index === 'number' && updatedFeatures[img.index]) {
            updatedFeatures[img.index] = {
              ...updatedFeatures[img.index],
              image_url: img.url,
            };
          }
        });
        updates.features = updatedFeatures;
      }
    }

    // Update page in database
    await supabase.updatePage(pageId, updates);
    console.log(`Images generated for page ${pageId}`);
  } catch (error) {
    console.error('Background image generation failed:', error);
  }
}

/**
 * Background image generation for flexible layout pages
 */
async function generateImagesBackgroundFlexible(pageId, prompts, env) {
  try {
    const supabase = getDbClient(env);

    // Generate images with Imagen 3 (via Vertex AI)
    const images = await generateImagenImages(
      prompts,
      env.GOOGLE_SERVICE_ACCOUNT_KEY,
      env.GOOGLE_CLOUD_PROJECT,
      env.IMAGES,
      pageId,
    );

    const page = await supabase.getPage(pageId);
    if (!page) return;

    const updates = { images_ready: true };

    // Find hero image and apply to metadata
    const heroImage = images.find((img) => img.type === 'hero');
    if (heroImage && page.metadata) {
      updates.metadata = { ...page.metadata, image_url: heroImage.url };
    }

    // Find feature images, comparison images, recipe images, and product images
    const featureImages = images.filter((img) => img.type === 'feature');
    const comparisonImages = images.filter((img) => img.type === 'comparison');
    const recipeImage = images.find((img) => img.type === 'recipe');
    const productImage = images.find((img) => img.type === 'product');
    const relatedRecipeImages = images.filter((img) => img.type === 'related_recipe');
    const relatedProductImages = images.filter((img) => img.type === 'related_product');
    const guideProductImages = images.filter((img) => img.type === 'guide_product');

    if ((featureImages.length > 0 || comparisonImages.length > 0 || recipeImage || productImage || relatedRecipeImages.length > 0 || relatedProductImages.length > 0 || guideProductImages.length > 0) && page.content_atoms) {
      updates.content_atoms = page.content_atoms.map((atom) => {
        // Apply feature images to feature_set atoms
        if (atom.type === 'feature_set' && atom.items) {
          return {
            ...atom,
            items: atom.items.map((item, i) => {
              const featureImg = featureImages.find((img) => img.index === i);
              return featureImg ? { ...item, image_url: featureImg.url } : item;
            }),
          };
        }
        // Apply comparison images to comparison atoms
        if (atom.type === 'comparison' && atom.items) {
          return {
            ...atom,
            items: atom.items.map((item, i) => {
              const comparisonImg = comparisonImages.find((img) => img.index === i);
              return comparisonImg ? { ...item, image_url: comparisonImg.url } : item;
            }),
          };
        }
        // Apply recipe image and related recipe images to recipe_detail atoms
        if (atom.type === 'recipe_detail') {
          let updatedAtom = { ...atom };
          if (recipeImage) {
            updatedAtom.image_url = recipeImage.url;
          }
          if (atom.related_recipes && relatedRecipeImages.length > 0) {
            updatedAtom.related_recipes = atom.related_recipes.map((recipe, i) => {
              const relatedImg = relatedRecipeImages.find((img) => img.index === i);
              return relatedImg ? { ...recipe, image_url: relatedImg.url } : recipe;
            });
          }
          return updatedAtom;
        }
        // Apply product image and related product images to product_detail atoms
        if (atom.type === 'product_detail') {
          let updatedAtom = { ...atom };
          if (productImage) {
            updatedAtom.image_url = productImage.url;
          }
          if (atom.related_products && relatedProductImages.length > 0) {
            updatedAtom.related_products = atom.related_products.map((product, i) => {
              const relatedImg = relatedProductImages.find((img) => img.index === i);
              return relatedImg ? { ...product, image_url: relatedImg.url } : product;
            });
          }
          return updatedAtom;
        }
        // Apply guide product images to interactive_guide atoms
        if (atom.type === 'interactive_guide' && atom.picks && guideProductImages.length > 0) {
          return {
            ...atom,
            picks: atom.picks.map((pick, i) => {
              const guideImg = guideProductImages.find((img) => img.index === i);
              if (guideImg && pick.product) {
                return {
                  ...pick,
                  product: { ...pick.product, image_url: guideImg.url },
                };
              }
              return pick;
            }),
          };
        }
        return atom;
      });
    }

    await supabase.updatePage(pageId, updates);
    console.log(`Images generated for flexible page ${pageId}`);
  } catch (error) {
    console.error('Background image generation failed (flexible):', error);
  }
}

/**
 * Normalize query for cache lookup
 * @param {string} query - User query
 * @returns {string} Normalized query
 */
function normalizeQuery(query) {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check for cached page with same query (24-hour TTL)
 * @param {string} query - Normalized query
 * @param {object} supabase - Supabase client
 * @returns {object|null} Cached page or null
 */
async function getCachedPage(query, supabase) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return supabase.findPageByQuery(query, twentyFourHoursAgo);
}

/**
 * Generate page using flexible multi-model pipeline
 * Claude → Gemini → Imagen
 */
async function generatePageFlexible(query, sessionId, supabase, env, ctx) {
  console.log('Using flexible multi-model pipeline');
  const timing = new TimingTracker();

  // Step 1: Claude generates content atoms with RAG (using Workers AI for embeddings)
  timing.startPhase('content_generation');
  const ragOptions = env.AI
    ? { supabase, ai: env.AI, env }
    : { env };

  const claudeResult = await generateContentAtoms(query, env.ANTHROPIC_API_KEY, ragOptions);
  const { contentAtoms, contentType, metadata, keywords, layoutBlocks, sourceIds, sourceImages, classification, timings: ragTimings } = claudeResult;

  console.log(`Claude generated ${contentAtoms.length} content atoms (type: ${contentType})`);
  if (classification) {
    console.log(`Query classification: ${classification.type} (confidence: ${(classification.confidence * 100).toFixed(0)}%)`);
  }

  // Step 2: Use Claude's layout selection (or fallback if invalid)
  timing.startPhase('layout_selection');
  let layoutResult;
  const isValidLayout = layoutBlocks && Array.isArray(layoutBlocks) && layoutBlocks.length > 0;

  if (isValidLayout) {
    layoutResult = { blocks: layoutBlocks };
    console.log(`Claude selected layout: ${layoutBlocks.map((b) => b.block_type).join(', ')}`);
  } else {
    console.log('Claude layout missing or invalid, using fallback');
    layoutResult = getFallbackLayout(contentType, contentAtoms);
    console.log(`Fallback layout: ${layoutResult.blocks.map((b) => b.block_type).join(', ')}`);
  }

  // Post-process: If query contains "table" and we have comparison data, ensure table block is included
  const lowerQuery = query.toLowerCase();
  const wantsTable = lowerQuery.includes('table') || lowerQuery.includes('chart') || lowerQuery.includes('specs');
  const hasComparison = contentAtoms.some((a) => a.type === 'comparison');
  const hasTableBlock = layoutResult.blocks.some((b) => b.block_type === 'comparison-table' || b.block_type === 'specs-table');

  if (wantsTable && hasComparison && !hasTableBlock) {
    // Replace comparison-cards with comparison-table, or add comparison-table after hero
    const cardsIndex = layoutResult.blocks.findIndex((b) => b.block_type === 'comparison-cards');
    const tableBlock = {
      block_type: 'comparison-table',
      atom_mappings: { items: 'comparison.items' },
    };
    if (cardsIndex >= 0) {
      // Replace cards with table
      layoutResult.blocks[cardsIndex] = tableBlock;
      console.log('Replaced comparison-cards with comparison-table (user requested table)');
    } else {
      // Insert table after hero-banner
      const heroIndex = layoutResult.blocks.findIndex((b) => b.block_type === 'hero-banner');
      layoutResult.blocks.splice(heroIndex + 1, 0, tableBlock);
      console.log('Added comparison-table block (user requested table)');
    }
  }

  // Prepare page data for database
  let pageData = {
    query,
    content_type: contentType,
    keywords,
    metadata,
    content_atoms: contentAtoms,
    layout_blocks: layoutResult.blocks,
    pipeline: 'flexible',
    images_ready: false,
    rag_enabled: sourceIds.length > 0,
    rag_source_ids: sourceIds.length > 0 ? sourceIds : null,
  };

  // Step 3: Hybrid image strategy - use RAG images where possible, generate the rest
  timing.startPhase('image_search');
  let remainingPrompts = [];
  let ragImageCount = 0;

  if (env.IMAGE_VECTORS && classification) {
    // Determine image strategy based on classification
    const imageStrategy = determineImageStrategy(classification, contentAtoms, metadata);
    console.log(`Image strategy: hero=${imageStrategy.hero}, features=${imageStrategy.features}`);

    // Find matching images from RAG using semantic search
    const matchedImages = await findMatchingImages(contentAtoms, metadata, classification, env);
    ragImageCount = [
      matchedImages.hero,
      ...matchedImages.features,
      ...matchedImages.comparison,
      ...matchedImages.guide,
      matchedImages.recipe,
      matchedImages.product,
    ].filter(Boolean).length;
    console.log(`Found ${ragImageCount} matching RAG images`);

    // Apply matched images to page data
    const result = applyMatchedImages(pageData, matchedImages, imageStrategy);
    pageData = result.pageData;
    remainingPrompts = result.remainingPrompts;

    if (remainingPrompts.length > 0) {
      console.log(`Will generate ${remainingPrompts.length} images with Imagen (RAG didn't cover all)`);
    } else if (ragImageCount > 0) {
      console.log(`All images from RAG - no Imagen generation needed`);
      pageData.images_ready = true;
    }
  } else {
    // Fallback: extract all prompts for Imagen generation
    remainingPrompts = extractImagePromptsFromAtoms(contentAtoms, metadata);
  }

  // Save to database
  timing.startPhase('database_save');
  const page = await supabase.insertPage(pageData);

  // Add to search history
  await supabase.addHistory(sessionId, query, page.id);

  // Generate remaining images with Imagen 3 (if any)
  timing.startPhase('image_generation_queue');
  let imagesToGenerate = 0;
  if (remainingPrompts.length > 0) {
    imagesToGenerate = remainingPrompts.length;
    ctx.waitUntil(generateImagesBackgroundFlexible(page.id, remainingPrompts, env));
    console.log(`Queued ${remainingPrompts.length} images for Imagen 3 generation`);
  }

  // Build timing report
  const timings = timing.getTimings({
    cache_hit: false,
    images_from_rag: ragImageCount,
    images_to_generate: imagesToGenerate,
    rag_sources: sourceIds.length,
    ...(ragTimings && { rag: ragTimings }),
  });

  console.log(`Timing: ${JSON.stringify(timings)}`);

  return {
    id: page.id,
    ...pageData,
    timings,
  };
}

/**
 * Generate page using legacy fixed-layout pipeline
 * Claude → Imagen (original behavior)
 */
async function generatePageLegacy(query, sessionId, supabase, env, ctx) {
  console.log('Using legacy fixed-layout pipeline');

  // Generate content with Claude (with RAG using Workers AI for embeddings)
  const ragOptions = env.AI
    ? { supabase, ai: env.AI, env }
    : { env };
  const { content, sourceIds, sourceImages } = await generateContent(query, env.ANTHROPIC_API_KEY, ragOptions);

  // Prepare page data for database
  const pageData = {
    query,
    content_type: content.type || 'article',
    keywords: content.keywords || [],
    hero: content.hero || {},
    body: content.body || {},
    features: content.features || [],
    faqs: content.faqs || [],
    cta: content.cta || {},
    related: content.related || [],
    pipeline: 'legacy',
    images_ready: false,
    rag_enabled: sourceIds.length > 0,
    rag_source_ids: sourceIds.length > 0 ? sourceIds : null,
  };

  // Save to database
  const page = await supabase.insertPage(pageData);

  // Add to search history
  await supabase.addHistory(sessionId, query, page.id);

  // Always generate images with Imagen 3 (AI-generated images are better quality)
  const imagePrompts = extractImagePrompts(content);
  if (imagePrompts.length > 0) {
    ctx.waitUntil(generateImagesBackground(page.id, imagePrompts, env));
    console.log(`Queued ${imagePrompts.length} images for Imagen 3 generation`);
  }

  return {
    id: page.id,
    ...pageData,
  };
}

/**
 * Generate page handler
 * @param {object} body - Request body with query, session_id, and optional pipeline flag
 * @param {object} env - Worker environment
 * @param {object} ctx - Execution context
 */
export async function generatePage(body, env, ctx) {
  const startTime = Date.now();
  const { query, session_id: sessionId, pipeline } = body;

  if (!query || typeof query !== 'string') {
    throw new Error('Query is required');
  }

  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  const supabase = getDbClient(env);
  const normalizedQuery = normalizeQuery(query);

  // Check for cached page (24-hour TTL)
  const cacheCheckStart = Date.now();
  const cachedPage = await getCachedPage(normalizedQuery, supabase);
  const cacheCheckTime = Date.now() - cacheCheckStart;

  if (cachedPage) {
    // Add to search history even for cached pages
    await supabase.addHistory(sessionId, query, cachedPage.id);
    return {
      ...cachedPage,
      cached: true,
      timings: {
        total_ms: Date.now() - startTime,
        phases: {
          cache_check: cacheCheckTime,
        },
        cache_hit: true,
      },
    };
  }

  // Determine which pipeline to use
  // Use flexible pipeline if:
  // 1. Explicitly requested via pipeline='flexible'
  // 2. GEMINI_API_KEY is configured (feature flag)
  const useFlexible = pipeline === 'flexible' || (env.GEMINI_API_KEY && pipeline !== 'legacy');

  if (useFlexible) {
    return generatePageFlexible(query, sessionId, supabase, env, ctx);
  }
  return generatePageLegacy(query, sessionId, supabase, env, ctx);
}
