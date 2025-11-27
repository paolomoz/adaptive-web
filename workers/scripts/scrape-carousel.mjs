#!/usr/bin/env node
/**
 * Vitamix Carousel Content Ingester
 * Adds the Holiday Gift Guide carousel products to RAG for dynamic carousel generation
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value && !key.startsWith('#')) {
      process.env[key.trim()] = value;
    }
  });
  console.log('Loaded environment from .env file');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Holiday Gift Guide carousel products (from vitamix.com/ca/en_us/)
// Type: carousel_item for special handling in RAG retrieval
const CAROUSEL_PRODUCTS = [
  {
    url: 'https://www.vitamix.com/ca/en_us/shop/ascent-x5',
    title: 'Ascent Series X5',
    subtitle: 'Smart Blending Technology',
    content: `The Vitamix Ascent Series X5 is our most advanced blender with Self-Detect technology, wireless connectivity, and touchscreen controls. Features include 5 program settings, variable speed control, and a built-in timer. Compatible with all Ascent accessories. Perfect for the home chef who wants premium blending technology.`,
    description: 'Our most advanced blender with touchscreen controls and smart technology.',
    cta_text: 'Shop Now',
    type: 'product', // Use 'product' type (valid in DB constraint)
    metadata: {
      carousel: 'holiday_gift_guide',
      position: 1,
      series: 'Ascent',
      model: 'X5',
      price: '$699.95',
      image_url: 'https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/a/s/ascent_x5_brushed_stainless_64oz_lp_front.png',
    },
  },
  {
    url: 'https://www.vitamix.com/ca/en_us/shop/vitamix-5200',
    title: 'Vitamix 5200',
    subtitle: 'The Original Classic',
    content: `The Vitamix 5200 is the original high-performance blender that started it all. With a powerful motor, variable speed control, and the ability to blend hot soups through friction, it's the proven choice for serious home cooks. Features a 64oz container and 7-year warranty.`,
    description: 'The time-tested classic blender that started the whole-food movement.',
    cta_text: 'Shop Now',
    type: 'product', // Use 'product' type (valid in DB constraint)
    metadata: {
      carousel: 'holiday_gift_guide',
      position: 2,
      series: 'Classic',
      model: '5200',
      price: '$499.95',
      image_url: 'https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/5/2/5200_black_64oz_lp_front.png',
    },
  },
  {
    url: 'https://www.vitamix.com/ca/en_us/shop/e310',
    title: 'Explorian E310',
    subtitle: 'Essentials at a Great Value',
    content: `The Vitamix Explorian E310 delivers professional-grade blending at an accessible price point. With 10 variable speeds, pulse feature, and a 48oz container, it's perfect for everyday smoothies, soups, and sauces. 5-year warranty included.`,
    description: 'Professional-grade blending power at an accessible price.',
    cta_text: 'Shop Now',
    type: 'product', // Use 'product' type (valid in DB constraint)
    metadata: {
      carousel: 'holiday_gift_guide',
      position: 3,
      series: 'Explorian',
      model: 'E310',
      price: '$349.95',
      image_url: 'https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/e/3/e310_black_48oz_lp_front.png',
    },
  },
  {
    url: 'https://www.vitamix.com/ca/en_us/shop/ascent-x5-smartprep',
    title: 'Ascent X5 SmartPrep',
    subtitle: 'Hands-Free Food Processing',
    content: `The Vitamix Ascent X5 SmartPrep combines our most advanced blender with the SmartPrep food processor attachment. Chop, dice, and slice with precision, then blend to perfection. Includes both the Ascent X5 blender and 12-cup food processor attachment.`,
    description: 'The ultimate kitchen prep system with blending and food processing.',
    cta_text: 'Shop Now',
    type: 'product', // Use 'product' type (valid in DB constraint)
    metadata: {
      carousel: 'holiday_gift_guide',
      position: 4,
      series: 'Ascent',
      model: 'X5 SmartPrep',
      price: '$899.95',
      image_url: 'https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/s/m/smartprep_kitchen_system_brushed_stainless_64oz_12cup_fp_lp_front.png',
    },
  },
  {
    url: 'https://www.vitamix.com/ca/en_us/shop/immersion-blender',
    title: 'Vitamix Immersion Blender',
    subtitle: 'Blend Right in the Pot',
    content: `The Vitamix Immersion Blender brings professional-quality results directly to your pots, bowls, and containers. Variable speed trigger, stainless steel blending arm, and quiet motor technology. Perfect for soups, sauces, and dressings. Includes blending cup and whisk attachment.`,
    description: 'Professional immersion blender for soups, sauces, and more.',
    cta_text: 'Shop Now',
    type: 'product', // Use 'product' type (valid in DB constraint)
    metadata: {
      carousel: 'holiday_gift_guide',
      position: 5,
      series: 'Immersion',
      model: 'Immersion Blender',
      price: '$179.95',
      image_url: 'https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/i/m/immersion_blender_stainless_lp_front.png',
    },
  },
  {
    url: 'https://www.vitamix.com/ca/en_us/shop/accessories',
    title: 'Vitamix Accessories',
    subtitle: 'Complete Your Blending Experience',
    content: `Expand your Vitamix capabilities with official accessories. From personal cups and food processors to tampers and cookbooks, we have everything you need. Self-Detect containers work with Ascent Series blenders for automatic program adjustments.`,
    description: 'Containers, cups, and attachments to expand your blending possibilities.',
    cta_text: 'Shop Now',
    type: 'product', // Use 'product' type (valid in DB constraint)
    metadata: {
      carousel: 'holiday_gift_guide',
      position: 6,
      series: 'Accessories',
      model: 'Various',
      price: 'From $29.95',
      image_url: 'https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/a/c/accessories_collection_lp_front.png',
    },
  },
];

// Also add a general "Holiday Gift Guide" entry that references all products with image URLs
const GIFT_GUIDE_ENTRY = {
  url: 'https://www.vitamix.com/ca/en_us/holiday-gift-guide',
  title: 'The Essential Holiday Gift Guide',
  content: `Vitamix Holiday Gift Guide features our best blenders and accessories for the holiday season.

FEATURED PRODUCTS FOR CAROUSEL:
1. Ascent Series X5 - Smart Blending Technology - $699.95 - Our most advanced blender with touchscreen controls
   Image URL: https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/a/s/ascent_x5_brushed_stainless_64oz_lp_front.png
   Product URL: https://www.vitamix.com/ca/en_us/shop/ascent-x5

2. Vitamix 5200 - The Original Classic - $499.95 - The time-tested classic that started the whole-food movement
   Image URL: https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/5/2/5200_black_64oz_lp_front.png
   Product URL: https://www.vitamix.com/ca/en_us/shop/vitamix-5200

3. Explorian E310 - Essentials at a Great Value - $349.95 - Professional-grade blending at an accessible price
   Image URL: https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/e/3/e310_black_48oz_lp_front.png
   Product URL: https://www.vitamix.com/ca/en_us/shop/e310

4. Ascent X5 SmartPrep - Hands-Free Food Processing - $899.95 - The ultimate kitchen prep system
   Image URL: https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/s/m/smartprep_kitchen_system_brushed_stainless_64oz_12cup_fp_lp_front.png
   Product URL: https://www.vitamix.com/ca/en_us/shop/ascent-x5-smartprep

5. Vitamix Immersion Blender - Blend Right in the Pot - $179.95 - Professional immersion blender
   Image URL: https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/i/m/immersion_blender_stainless_lp_front.png
   Product URL: https://www.vitamix.com/ca/en_us/shop/immersion-blender

6. Vitamix Accessories - Complete Your Blending Experience - From $29.95 - Containers, cups, and attachments
   Image URL: https://www.vitamix.com/media/catalog/product/cache/9c0f658fdd4e8b42d5ea08c8da7cca3e/a/c/accessories_collection_lp_front.png
   Product URL: https://www.vitamix.com/ca/en_us/shop/accessories

Perfect gifts for health enthusiasts, home cooks, and anyone who loves fresh, whole-food nutrition.`,
  type: 'guide', // Use 'guide' type (valid in DB constraint)
  metadata: {
    carousel: 'holiday_gift_guide',
    title: 'The Essential Holiday Gift Guide',
    product_count: 6,
    content_format: 'carousel', // Mark as carousel content for RAG retrieval
  },
};

/**
 * Generate embedding using OpenAI
 */
async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Insert source using Supabase REST API
 */
async function insertSource(sourceData) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/vitamix_sources`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify({
      url: sourceData.url,
      source_type: sourceData.type,
      title: sourceData.title,
      content: sourceData.content,
      metadata: sourceData.metadata || {},
      source_image_urls: sourceData.metadata?.image_url ? [sourceData.metadata.image_url] : [],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Insert source error: ${error}`);
  }

  const data = await response.json();
  return data[0];
}

/**
 * Insert chunk using Supabase REST API
 */
async function insertChunk(chunkData) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/vitamix_chunks`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(chunkData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Insert chunk error: ${error}`);
  }
}

/**
 * Delete chunks for a source
 */
async function deleteChunks(sourceId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/vitamix_chunks?source_id=eq.${sourceId}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    console.warn('Warning: Could not delete existing chunks');
  }
}

/**
 * Process one item
 */
async function processItem(item) {
  console.log(`Processing: ${item.title}`);

  try {
    // Insert source
    const source = await insertSource(item);
    console.log(`  Source ID: ${source.id}`);

    // Delete existing chunks
    await deleteChunks(source.id);

    // Generate embedding for the content
    // Include title, subtitle, and description for better semantic matching
    const embeddingText = `${item.title}. ${item.subtitle || ''}. ${item.content}. ${item.description || ''}`;
    const embedding = await generateEmbedding(embeddingText);

    // Insert as a single chunk
    await insertChunk({
      source_id: source.id,
      chunk_text: item.content,
      chunk_index: 0,
      embedding: embedding,
      content_type: item.type,
    });

    console.log(`  Done`);
  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }
}

/**
 * Main
 */
async function main() {
  console.log('=== Vitamix Carousel Content Ingester ===\n');

  // First, add the general gift guide entry
  console.log('Adding Holiday Gift Guide overview...');
  await processItem(GIFT_GUIDE_ENTRY);
  await new Promise((r) => setTimeout(r, 200));

  // Then add all carousel products
  console.log('\nAdding carousel products...');
  for (const item of CAROUSEL_PRODUCTS) {
    await processItem(item);
    // Small delay between items
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('\n=== Done ===');
  console.log(`Ingested ${CAROUSEL_PRODUCTS.length + 1} items for carousel RAG`);
}

main().catch(console.error);
