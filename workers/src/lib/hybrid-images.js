/**
 * Hybrid Image Strategy
 * Decides whether to use RAG images or generate with Imagen based on content type
 */

import { searchImages } from './image-search.js';

/**
 * Determine image strategy based on classification and content
 * @param {object} classification - Query classification from RAG
 * @param {Array} contentAtoms - Content atoms from Claude
 * @param {object} metadata - Page metadata
 * @returns {object} Strategy with decisions for each image type
 */
export function determineImageStrategy(classification, contentAtoms, metadata) {
  const strategy = {
    hero: 'generate', // Default: generate hero images
    features: 'generate',
    products: 'rag', // Always try RAG for product images
    recipes: 'rag', // Always try RAG for recipe images
    comparison: 'rag',
    guide: 'rag',
  };

  // For product queries, try to use real product images
  if (classification.type === 'product' || classification.needsProductImages) {
    strategy.hero = 'rag_or_generate'; // Try RAG first, fall back to generate
    strategy.features = 'rag_or_generate';
  }

  // For recipe queries, generate images with Imagen 3 (better quality than RAG)
  if (classification.type === 'recipe' || classification.type === 'single_recipe' || classification.needsRecipeImages) {
    strategy.hero = 'generate';
    strategy.recipes = 'generate';
    strategy.features = 'generate';
  }

  // For single product pages
  if (classification.type === 'single_product') {
    strategy.hero = 'rag_or_generate';
    strategy.features = 'rag_or_generate';
  }

  // For blog/lifestyle content, generate creative images
  if (classification.type === 'blog' || classification.type === 'general') {
    strategy.hero = 'generate';
    strategy.features = 'generate';
  }

  return strategy;
}

/**
 * Find matching images for content atoms using semantic search
 * @param {Array} contentAtoms - Content atoms from Claude
 * @param {object} metadata - Page metadata
 * @param {object} classification - Query classification
 * @param {object} env - Worker environment
 * @returns {Promise<object>} Matched images for each atom type
 */
export async function findMatchingImages(contentAtoms, metadata, classification, env) {
  const matches = {
    hero: null,
    features: [],
    comparison: [],
    guide: [],
    recipe: null,
    product: null,
  };

  // Search for hero image based on title/description
  // Skip for recipes - always generate recipe hero images with Imagen 3
  const isRecipe = classification?.type === 'recipe' || classification?.type === 'single_recipe';

  if (metadata?.title && !isRecipe) {
    const heroImages = await searchImages(metadata.title, env, {
      limit: 1,
      threshold: 0.6,
    });
    if (heroImages.length > 0) {
      matches.hero = heroImages[0];
    }
  }

  // Search for feature images
  const featureSet = contentAtoms.find((a) => a.type === 'feature_set');
  if (featureSet?.items) {
    for (const feature of featureSet.items) {
      const searchQuery = feature.title || feature.description;
      if (searchQuery) {
        const images = await searchImages(searchQuery, env, {
          limit: 1,
          threshold: 0.55,
        });
        matches.features.push(images[0] || null);
      } else {
        matches.features.push(null);
      }
    }
  }

  // Search for comparison/product images
  // Note: Don't filter by imageType='product' - product images are tagged as 'page' type
  // but have model names in alt_text (e.g., "A3500 Ascent", "A2500 Ascent")
  const comparison = contentAtoms.find((a) => a.type === 'comparison');
  if (comparison?.items) {
    for (const item of comparison.items) {
      // Extract model number for more precise search (e.g., "A3500" from "Vitamix A3500")
      const productName = item.name || item.title || '';
      const modelMatch = productName.match(/([AaEe]?\d{3,4})/);
      const modelNumber = modelMatch ? modelMatch[1].toUpperCase() : null;

      // Build search query - prioritize model number + series, fall back to full name
      let searchQuery = productName;
      if (modelNumber && item.series) {
        searchQuery = `${modelNumber} ${item.series}`;
      } else if (modelNumber) {
        searchQuery = modelNumber;
      }

      if (searchQuery) {
        // Search without imageType filter to find product images tagged as 'page'
        const images = await searchImages(searchQuery, env, {
          limit: 3, // Get multiple results to find best match
          threshold: 0.4, // Lower threshold for product model searches
        });

        // Find best match - prefer images with alt_text containing the model number
        let bestMatch = images[0] || null;
        if (modelNumber && images.length > 1) {
          const exactMatch = images.find((img) =>
            img.alt?.toUpperCase().includes(modelNumber)
          );
          if (exactMatch) {
            bestMatch = exactMatch;
          }
        }
        matches.comparison.push(bestMatch);
      } else {
        matches.comparison.push(null);
      }
    }
  }

  // Search for interactive guide product images
  // Uses same logic as comparison - extract model number for precise matching
  const guide = contentAtoms.find((a) => a.type === 'interactive_guide');
  if (guide?.picks) {
    for (const pick of guide.picks) {
      const productName = pick.product?.name || pick.tab_label || '';
      const modelMatch = productName.match(/([AaEe]?\d{3,4})/);
      const modelNumber = modelMatch ? modelMatch[1].toUpperCase() : null;

      let searchQuery = productName;
      if (modelNumber && pick.product?.series) {
        searchQuery = `${modelNumber} ${pick.product.series}`;
      } else if (modelNumber) {
        searchQuery = modelNumber;
      }

      if (searchQuery) {
        const images = await searchImages(searchQuery, env, {
          limit: 3,
          threshold: 0.4,
        });

        let bestMatch = images[0] || null;
        if (modelNumber && images.length > 1) {
          const exactMatch = images.find((img) =>
            img.alt?.toUpperCase().includes(modelNumber)
          );
          if (exactMatch) {
            bestMatch = exactMatch;
          }
        }
        matches.guide.push(bestMatch);
      } else {
        matches.guide.push(null);
      }
    }
  }

  // Search for recipe detail image
  const recipeDetail = contentAtoms.find((a) => a.type === 'recipe_detail');
  if (recipeDetail?.name) {
    const images = await searchImages(recipeDetail.name, env, {
      limit: 1,
      threshold: 0.55,
      imageType: 'recipe',
    });
    if (images.length > 0) {
      matches.recipe = images[0];
    }
  }

  // Search for product detail image
  // Uses same logic as comparison - extract model number for precise matching
  const productDetail = contentAtoms.find((a) => a.type === 'product_detail');
  if (productDetail?.name) {
    const productName = productDetail.name || '';
    const modelMatch = productName.match(/([AaEe]?\d{3,4})/);
    const modelNumber = modelMatch ? modelMatch[1].toUpperCase() : null;

    let searchQuery = productName;
    if (modelNumber && productDetail.series) {
      searchQuery = `${modelNumber} ${productDetail.series}`;
    } else if (modelNumber) {
      searchQuery = modelNumber;
    }

    const images = await searchImages(searchQuery, env, {
      limit: 3,
      threshold: 0.4,
    });

    if (images.length > 0) {
      // Find best match - prefer images with alt_text containing the model number
      let bestMatch = images[0];
      if (modelNumber && images.length > 1) {
        const exactMatch = images.find((img) =>
          img.alt?.toUpperCase().includes(modelNumber)
        );
        if (exactMatch) {
          bestMatch = exactMatch;
        }
      }
      matches.product = bestMatch;
    }
  }

  return matches;
}

/**
 * Apply matched RAG images to page data
 * @param {object} pageData - Page data to modify
 * @param {object} matches - Matched images from findMatchingImages
 * @param {object} strategy - Image strategy from determineImageStrategy
 * @returns {object} Modified page data and remaining prompts for generation
 */
export function applyMatchedImages(pageData, matches, strategy) {
  const modifiedData = { ...pageData };
  const remainingPrompts = [];

  // Apply hero image
  if (matches.hero && (strategy.hero === 'rag' || strategy.hero === 'rag_or_generate')) {
    if (modifiedData.metadata) {
      modifiedData.metadata = {
        ...modifiedData.metadata,
        image_url: matches.hero.url,
      };
    }
  } else if (modifiedData.metadata?.primary_image_prompt) {
    // Need to generate hero
    remainingPrompts.push({
      type: 'hero',
      prompt: modifiedData.metadata.primary_image_prompt,
    });
  }

  // Apply to content_atoms
  if (modifiedData.content_atoms) {
    modifiedData.content_atoms = modifiedData.content_atoms.map((atom) => {
      // Handle feature_set atoms
      if (atom.type === 'feature_set' && atom.items) {
        const updatedItems = atom.items.map((item, i) => {
          const matchedImage = matches.features[i];
          if (matchedImage && (strategy.features === 'rag' || strategy.features === 'rag_or_generate')) {
            return { ...item, image_url: matchedImage.url };
          } else if (item.image_prompt) {
            // Need to generate
            remainingPrompts.push({
              type: 'feature',
              index: i,
              prompt: item.image_prompt,
            });
          }
          return item;
        });
        return { ...atom, items: updatedItems };
      }

      // Handle comparison atoms
      if (atom.type === 'comparison' && atom.items) {
        const updatedItems = atom.items.map((item, i) => {
          const matchedImage = matches.comparison[i];
          if (matchedImage) {
            return { ...item, image_url: matchedImage.url };
          } else if (item.image_prompt) {
            remainingPrompts.push({
              type: 'comparison',
              index: i,
              prompt: item.image_prompt,
            });
          }
          return item;
        });
        return { ...atom, items: updatedItems };
      }

      // Handle interactive_guide atoms
      if (atom.type === 'interactive_guide' && atom.picks) {
        const updatedPicks = atom.picks.map((pick, i) => {
          const matchedImage = matches.guide[i];
          if (matchedImage && pick.product) {
            return {
              ...pick,
              product: { ...pick.product, image_url: matchedImage.url },
            };
          } else if (pick.product?.image_url && !pick.product.image_url.startsWith('http')) {
            remainingPrompts.push({
              type: 'guide_product',
              index: i,
              prompt: pick.product.image_url,
            });
          }
          return pick;
        });
        return { ...atom, picks: updatedPicks };
      }

      // Handle recipe_detail atoms
      if (atom.type === 'recipe_detail') {
        // For recipes, prefer Imagen 3 generation over RAG
        if (strategy.recipes === 'generate') {
          // Always generate recipe images with Imagen 3
          const prompt = atom.image_url && !atom.image_url.startsWith('http')
            ? atom.image_url
            : modifiedData.metadata?.primary_image_prompt;
          if (prompt) {
            remainingPrompts.push({
              type: 'recipe',
              prompt,
            });
          }
          return atom;
        }
        // Fallback to RAG if strategy allows
        if (matches.recipe && (strategy.recipes === 'rag' || strategy.recipes === 'rag_or_generate')) {
          if (modifiedData.metadata) {
            modifiedData.metadata = {
              ...modifiedData.metadata,
              image_url: matches.recipe.url,
            };
          }
          return { ...atom, image_url: matches.recipe.url };
        } else if (atom.image_url && !atom.image_url.startsWith('http')) {
          remainingPrompts.push({
            type: 'recipe',
            prompt: atom.image_url,
          });
        }
        return atom;
      }

      // Handle product_detail atoms
      if (atom.type === 'product_detail') {
        if (matches.product) {
          // Also update metadata with product image for hero display
          if (modifiedData.metadata) {
            modifiedData.metadata = {
              ...modifiedData.metadata,
              image_url: matches.product.url,
            };
          }
          return { ...atom, image_url: matches.product.url };
        } else if (atom.image_url && !atom.image_url.startsWith('http')) {
          remainingPrompts.push({
            type: 'product',
            prompt: atom.image_url,
          });
        }
        return atom;
      }

      return atom;
    });
  }

  // If we applied any RAG images, mark as partially ready
  const hasRagImages = matches.hero ||
    matches.features.some(Boolean) ||
    matches.comparison.some(Boolean) ||
    matches.guide.some(Boolean) ||
    matches.recipe ||
    matches.product;

  if (hasRagImages && remainingPrompts.length === 0) {
    modifiedData.images_ready = true;
  }

  return { pageData: modifiedData, remainingPrompts };
}
