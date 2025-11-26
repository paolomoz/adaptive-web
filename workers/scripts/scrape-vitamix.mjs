#!/usr/bin/env node
/**
 * Vitamix Content Scraper (Lightweight Version)
 * Uses raw fetch instead of Supabase client to avoid memory issues
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

// FAQ content (curated, reliable data)
const FAQ_CONTENT = [
  {
    url: 'https://www.vitamix.com/faq/warranty',
    title: 'Vitamix Warranty Information',
    content: `Vitamix offers an industry-leading 10-year full warranty on most blenders. This covers the motor, the container, the blade assembly, and all other parts. The warranty begins from the date of purchase. Vitamix will repair or replace any defective part at no charge during the warranty period.`,
    type: 'faq',
    metadata: { topic: 'warranty' },
  },
  {
    url: 'https://www.vitamix.com/faq/cleaning',
    title: 'Self-Cleaning Instructions',
    content: `To self-clean your Vitamix: Fill the container halfway with warm water, add a drop of dish soap, secure the lid, start on the lowest speed then quickly increase to highest speed. Run for 30-60 seconds. Rinse thoroughly. For stubborn residue, soak in warm soapy water first.`,
    type: 'faq',
    metadata: { topic: 'cleaning' },
  },
  {
    url: 'https://www.vitamix.com/faq/containers',
    title: 'Vitamix Container Sizes',
    content: `Vitamix offers multiple container sizes: 64oz Low-Profile fits under most cabinets, 48oz is versatile for wet and dry ingredients, 20oz Personal Cup with blade base is perfect for single servings. Ascent Series containers feature Self-Detect technology.`,
    type: 'faq',
    metadata: { topic: 'containers' },
  },
  {
    url: 'https://www.vitamix.com/faq/soup',
    title: 'Hot Soup in Minutes',
    content: `Vitamix blenders can make hot soup from raw ingredients in about 6 minutes. The friction from the high-speed motor heats ingredients to steaming hot temperatures. Simply add vegetables, broth, and seasonings, then run on high for 5-6 minutes.`,
    type: 'faq',
    metadata: { topic: 'features' },
  },
  {
    url: 'https://www.vitamix.com/faq/comparison',
    title: 'Vitamix vs Regular Blenders',
    content: `Vitamix blenders differ from regular blenders: More powerful motors (2+ HP), aircraft-grade stainless steel blades that never need replacing, variable speed control for precise texture, longer warranty (10 years vs 1-2 years), commercial-quality construction, ability to make hot soup through friction heating.`,
    type: 'faq',
    metadata: { topic: 'comparison' },
  },
  {
    url: 'https://www.vitamix.com/faq/blades',
    title: 'Vitamix Blade Information',
    content: `Vitamix uses aircraft-grade stainless steel blades that are hardened and laser-cut. Unlike other blenders, Vitamix blades are designed to be dull - they pulverize ingredients through speed and power rather than sharpness. The blades never need sharpening or replacement.`,
    type: 'faq',
    metadata: { topic: 'blades' },
  },
  {
    url: 'https://www.vitamix.com/products/a3500',
    title: 'Vitamix A3500 Ascent Series',
    content: `The Vitamix A3500 is the most advanced Vitamix blender. Features include: touchscreen controls, 5 program settings (smoothies, hot soups, dips, frozen desserts, self-cleaning), variable speed control, wireless connectivity via Vitamix app, Self-Detect technology, built-in timer. 64oz container included. 10-year warranty. Price: $699.95.`,
    type: 'product',
    metadata: { series: 'Ascent', model: 'A3500', price: 699.95 },
  },
  {
    url: 'https://www.vitamix.com/products/a2500',
    title: 'Vitamix A2500 Ascent Series',
    content: `The Vitamix A2500 features 3 program settings (smoothies, hot soups, frozen desserts), variable speed control with 10 speeds, pulse feature, Self-Detect technology for automatic program settings. 64oz container included. 10-year warranty. Price: $549.95.`,
    type: 'product',
    metadata: { series: 'Ascent', model: 'A2500', price: 549.95 },
  },
  {
    url: 'https://www.vitamix.com/products/e310',
    title: 'Vitamix E310 Explorian Series',
    content: `The Vitamix E310 Explorian offers professional-grade blending at an accessible price. Features: 10 variable speeds, pulse feature, 48oz container, aircraft-grade stainless steel blades, 2.0 HP motor. Great for smoothies, soups, and everyday blending. 10-year warranty. Price: $349.95.`,
    type: 'product',
    metadata: { series: 'Explorian', model: 'E310', price: 349.95 },
  },
  {
    url: 'https://www.vitamix.com/products/professional-750',
    title: 'Vitamix Professional Series 750',
    content: `The Vitamix Professional Series 750 combines power with convenience. Features: 5 pre-programmed settings, variable speed, pulse, 64oz low-profile container, 2.2 HP motor. Programs include smoothies, frozen desserts, hot soups, purees, and self-cleaning. 10-year warranty. Price: $629.95.`,
    type: 'product',
    metadata: { series: 'Professional', model: '750', price: 629.95 },
  },
];

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
    const embedding = await generateEmbedding(item.content);

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
  console.log('=== Vitamix Content Scraper ===\n');

  for (const item of FAQ_CONTENT) {
    await processItem(item);
    // Small delay between items
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
