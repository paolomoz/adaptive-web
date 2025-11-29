/**
 * Generate Images API Endpoint
 * Generates images for an existing page
 */

import { generateImages as generateImagenImages } from './lib/imagen.js';
import { createClient as createCloudflareClient } from './lib/cloudflare-db.js';

/**
 * Generate images handler
 * @param {object} body - Request body with page_id and prompts
 * @param {object} env - Worker environment
 */
export async function generateImages(body, env) {
  const { page_id: pageId, prompts } = body;

  if (!pageId) {
    throw new Error('Page ID is required');
  }

  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
    throw new Error('Prompts array is required');
  }

  // Validate prompts structure
  const validPrompts = prompts.filter(
    (p) => p.prompt && typeof p.prompt === 'string' && p.type,
  );

  if (validPrompts.length === 0) {
    throw new Error('No valid prompts provided');
  }

  // Generate images with Imagen 3 (via Vertex AI)
  const images = await generateImagenImages(
    validPrompts,
    env.GOOGLE_SERVICE_ACCOUNT_KEY,
    env.GOOGLE_CLOUD_PROJECT,
    env.IMAGES,
    pageId,
  );

  // Get current page data
  const db = createCloudflareClient(env);
  const page = await db.getPage(pageId);

  if (!page) {
    throw new Error('Page not found');
  }

  // Build update object
  const updates = { images_ready: true };

  // Detect if this is flexible pipeline (has content_atoms)
  const isFlexiblePipeline = page.content_atoms && page.layout_blocks;

  // Update hero image
  const heroImage = images.find((img) => img.type === 'hero');
  if (heroImage) {
    if (isFlexiblePipeline) {
      // Flexible pipeline: store in metadata.image_url
      updates.metadata = {
        ...(page.metadata || {}),
        image_url: heroImage.url,
      };
    } else {
      // Legacy pipeline: store in hero object
      updates.hero = { ...page.hero, image_url: heroImage.url };
    }
  }

  // Update feature images
  const featureImages = images.filter((img) => img.type === 'feature');
  if (featureImages.length > 0) {
    if (isFlexiblePipeline && page.content_atoms) {
      // Flexible pipeline: update feature_set atom in content_atoms
      const updatedAtoms = [...page.content_atoms];
      const featureSetIndex = updatedAtoms.findIndex((a) => a.type === 'feature_set');
      if (featureSetIndex >= 0 && updatedAtoms[featureSetIndex].items) {
        const updatedItems = [...updatedAtoms[featureSetIndex].items];
        featureImages.forEach((img) => {
          if (typeof img.index === 'number' && updatedItems[img.index]) {
            updatedItems[img.index] = {
              ...updatedItems[img.index],
              image_url: img.url,
            };
          }
        });
        updatedAtoms[featureSetIndex] = {
          ...updatedAtoms[featureSetIndex],
          items: updatedItems,
        };
        updates.content_atoms = updatedAtoms;
      }
    } else {
      // Legacy pipeline: update features array
      const updatedFeatures = [...(page.features || [])];
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

  // Update interactive_guide product images in content_atoms
  const guideImages = images.filter((img) => img.type === 'guide_product');
  if (guideImages.length > 0 && page.content_atoms) {
    const updatedAtoms = updates.content_atoms || [...page.content_atoms];
    const guideAtom = updatedAtoms.find((a) => a.type === 'interactive_guide');
    if (guideAtom && guideAtom.picks) {
      guideImages.forEach((img) => {
        if (typeof img.index === 'number' && guideAtom.picks[img.index]) {
          guideAtom.picks[img.index].product = {
            ...guideAtom.picks[img.index].product,
            image_url: img.url,
          };
        }
      });
      updates.content_atoms = updatedAtoms;
    }
  }

  // Update recipe_detail image in content_atoms and metadata
  const recipeImage = images.find((img) => img.type === 'recipe');
  if (recipeImage && page.content_atoms) {
    const updatedAtoms = updates.content_atoms || [...page.content_atoms];
    const recipeAtomIndex = updatedAtoms.findIndex((a) => a.type === 'recipe_detail');
    if (recipeAtomIndex >= 0) {
      updatedAtoms[recipeAtomIndex] = {
        ...updatedAtoms[recipeAtomIndex],
        image_url: recipeImage.url,
      };
      updates.content_atoms = updatedAtoms;
    }
    // Also update metadata for hero display
    updates.metadata = {
      ...(page.metadata || {}),
      image_url: recipeImage.url,
    };
  }

  // Update product_detail image in content_atoms and metadata
  const productImage = images.find((img) => img.type === 'product');
  if (productImage && page.content_atoms) {
    const updatedAtoms = updates.content_atoms || [...page.content_atoms];
    const productAtomIndex = updatedAtoms.findIndex((a) => a.type === 'product_detail');
    if (productAtomIndex >= 0) {
      updatedAtoms[productAtomIndex] = {
        ...updatedAtoms[productAtomIndex],
        image_url: productImage.url,
      };
      updates.content_atoms = updatedAtoms;
    }
    // Also update metadata for hero display
    updates.metadata = {
      ...(page.metadata || {}),
      image_url: productImage.url,
    };
  }

  // Update related_recipe images in recipe_detail atom
  const relatedRecipeImages = images.filter((img) => img.type === 'related_recipe');
  if (relatedRecipeImages.length > 0 && page.content_atoms) {
    const updatedAtoms = updates.content_atoms || [...page.content_atoms];
    const recipeAtomIndex = updatedAtoms.findIndex((a) => a.type === 'recipe_detail');
    if (recipeAtomIndex >= 0 && updatedAtoms[recipeAtomIndex].related_recipes) {
      const updatedRelated = [...updatedAtoms[recipeAtomIndex].related_recipes];
      relatedRecipeImages.forEach((img) => {
        if (typeof img.index === 'number' && updatedRelated[img.index]) {
          updatedRelated[img.index] = {
            ...updatedRelated[img.index],
            image_url: img.url,
          };
        }
      });
      updatedAtoms[recipeAtomIndex] = {
        ...updatedAtoms[recipeAtomIndex],
        related_recipes: updatedRelated,
      };
      updates.content_atoms = updatedAtoms;
    }
  }

  // Update related_product images in product_detail atom
  const relatedProductImages = images.filter((img) => img.type === 'related_product');
  if (relatedProductImages.length > 0 && page.content_atoms) {
    const updatedAtoms = updates.content_atoms || [...page.content_atoms];
    const productAtomIndex = updatedAtoms.findIndex((a) => a.type === 'product_detail');
    if (productAtomIndex >= 0 && updatedAtoms[productAtomIndex].related_products) {
      const updatedRelated = [...updatedAtoms[productAtomIndex].related_products];
      relatedProductImages.forEach((img) => {
        if (typeof img.index === 'number' && updatedRelated[img.index]) {
          updatedRelated[img.index] = {
            ...updatedRelated[img.index],
            image_url: img.url,
          };
        }
      });
      updatedAtoms[productAtomIndex] = {
        ...updatedAtoms[productAtomIndex],
        related_products: updatedRelated,
      };
      updates.content_atoms = updatedAtoms;
    }
  }

  // Update page in database
  await db.updatePage(pageId, updates);

  return {
    success: true,
    page_id: pageId,
    images_generated: images.length,
    images,
  };
}
