#!/usr/bin/env node
/**
 * Full Vitamix Site Scraper (Memory-Optimized)
 * Processes pages in batches to prevent memory issues
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs';
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
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Configuration
const CONFIG = {
  rateLimit: 800, // ms between requests
  userAgent: 'Mozilla/5.0 (compatible; VitamixRAGBot/1.0)',
  maxContentLength: 200000, // Max HTML size to process
  logFile: join(__dirname, 'scrape-log.txt'),
};

// Stats
let stats = { scraped: 0, skipped: 0, errors: 0, images: 0 };

/**
 * URL list - high-value working pages
 */
const URLS_TO_SCRAPE = [
  // Products - Ascent Series (all working)
  'https://www.vitamix.com/us/en_us/shop/a3500',
  'https://www.vitamix.com/us/en_us/shop/a2500',
  'https://www.vitamix.com/us/en_us/shop/a2300',
  'https://www.vitamix.com/us/en_us/shop/a3300',

  // Products - Explorian Series
  'https://www.vitamix.com/us/en_us/shop/e310',
  'https://www.vitamix.com/us/en_us/shop/e320',

  // Products - Professional Series
  'https://www.vitamix.com/us/en_us/shop/professional-series-750',

  // Products - Venturist
  'https://www.vitamix.com/us/en_us/shop/venturist-v1200',

  // Products - Propel
  'https://www.vitamix.com/us/en_us/shop/propel-series-750',

  // Products - Certified Reconditioned
  'https://www.vitamix.com/us/en_us/shop/certified-reconditioned-standard',

  // Products - Immersion
  'https://www.vitamix.com/us/en_us/shop/5-speed-immersion-blender',

  // Containers (working ones)
  'https://www.vitamix.com/us/en_us/shop/48-ounce-container',
  'https://www.vitamix.com/us/en_us/shop/32-ounce-container',
  'https://www.vitamix.com/us/en_us/shop/aer-disc-container',
  'https://www.vitamix.com/us/en_us/shop/food-processor-attachment',

  // Accessories
  'https://www.vitamix.com/us/en_us/shop/under-blade-scraper',
  'https://www.vitamix.com/us/en_us/shop/personal-cup-adapter',
  'https://www.vitamix.com/us/en_us/shop/20-ounce-travel-cup',

  // Why Vitamix
  'https://www.vitamix.com/us/en_us/why-vitamix',
  'https://www.vitamix.com/us/en_us/why-vitamix/power',
  'https://www.vitamix.com/us/en_us/why-vitamix/precision',
  'https://www.vitamix.com/us/en_us/why-vitamix/durability',
  'https://www.vitamix.com/us/en_us/why-vitamix/convenience',

  // Support
  'https://www.vitamix.com/us/en_us/support',

  // Category pages
  'https://www.vitamix.com/us/en_us/shop/blenders',
  'https://www.vitamix.com/us/en_us/shop/accessories',
  'https://www.vitamix.com/us/en_us/shop/containers',

  // Additional products
  'https://www.vitamix.com/us/en_us/shop/stainless-steel-container',
  'https://www.vitamix.com/us/en_us/shop/8-ounce-container',
  'https://www.vitamix.com/us/en_us/shop/blending-cup-starter-kit',
  'https://www.vitamix.com/us/en_us/shop/blending-bowl-starter-kit',
  'https://www.vitamix.com/us/en_us/shop/self-detect-dry-grains-container',
  'https://www.vitamix.com/us/en_us/shop/self-detect-blending-cup',
  'https://www.vitamix.com/us/en_us/shop/self-detect-blending-bowl',
];

/**
 * Log message to file and console
 */
function log(message) {
  console.log(message);
  appendFileSync(CONFIG.logFile, `${new Date().toISOString()} ${message}\n`);
}

/**
 * Categorize URL - must match DB constraint values
 * Valid types: product, recipe, faq, guide, support
 */
function categorizeUrl(url) {
  if (url.includes('/shop/')) return 'product';
  if (url.includes('/recipes/')) return 'recipe';
  if (url.includes('/what-can-you-make/')) return 'guide';
  if (url.includes('/why-vitamix/')) return 'guide'; // Marketing -> guide
  if (url.includes('/support/')) return 'faq'; // Support -> faq
  return 'guide'; // Default to guide
}

/**
 * Extract content from HTML
 */
function extractContent(html, url) {
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(' | Vitamix', '').trim() : 'Untitled';

  // Extract meta description
  const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const metaDesc = metaMatch ? metaMatch[1] : '';

  // Clean HTML
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Extract text
  const textContent = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();

  // Extract metadata
  const metadata = {};
  const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
  if (priceMatch) metadata.price = parseFloat(priceMatch[1]);

  // Extract images
  const images = [];
  const imgMatches = html.matchAll(/(?:src|data-src)=["'](https:\/\/www\.vitamix\.com\/media\/[^"']+)["']/gi);
  for (const match of imgMatches) {
    const imgUrl = match[1];
    if (imgUrl.includes('catalog/product') &&
        !imgUrl.includes('50x50') &&
        !imgUrl.includes('100x100')) {
      images.push(imgUrl);
    }
  }

  const uniqueImages = [...new Set(images)];
  const bestImages = uniqueImages
    .filter(img => img.includes('2500x2500') || img.includes('1000x1000') || img.includes('620x620'))
    .slice(0, 5);
  const finalImages = bestImages.length > 0 ? bestImages : uniqueImages.slice(0, 5);

  return {
    title,
    description: metaDesc,
    content: textContent.slice(0, 8000),
    metadata,
    images: finalImages,
  };
}

/**
 * Generate embedding
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
      input: text.slice(0, 8000),
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Upsert source to Supabase
 */
async function upsertSource(sourceData) {
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
      source_image_urls: sourceData.images || [],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }

  const data = await response.json();
  return data[0];
}

/**
 * Delete chunks for source
 */
async function deleteChunks(sourceId) {
  await fetch(`${SUPABASE_URL}/rest/v1/vitamix_chunks?source_id=eq.${sourceId}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
}

/**
 * Insert chunk
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
    throw new Error(`Chunk error: ${error}`);
  }
}

/**
 * Process single page
 */
async function processPage(url, index, total) {
  try {
    log(`[${index + 1}/${total}] ${url}`);

    const response = await fetch(url, {
      headers: { 'User-Agent': CONFIG.userAgent },
    });

    if (!response.ok) {
      log(`  [SKIP] HTTP ${response.status}`);
      stats.skipped++;
      return;
    }

    let html = await response.text();
    if (html.length > CONFIG.maxContentLength) {
      html = html.slice(0, CONFIG.maxContentLength);
    }

    const contentType = categorizeUrl(url);
    const extracted = extractContent(html, url);
    html = null; // Free memory

    if (extracted.content.length < 100) {
      log(`  [SKIP] No content`);
      stats.skipped++;
      return;
    }

    // Upsert source
    const source = await upsertSource({
      url,
      type: contentType,
      title: extracted.title,
      content: extracted.content,
      metadata: extracted.metadata,
      images: extracted.images,
    });

    // Delete old chunks and create new ones
    await deleteChunks(source.id);

    // Generate single embedding for the content
    const embedding = await generateEmbedding(extracted.content);
    await insertChunk({
      source_id: source.id,
      chunk_text: extracted.content,
      chunk_index: 0,
      embedding,
      content_type: contentType,
    });

    stats.scraped++;
    stats.images += extracted.images.length;
    log(`  -> ${extracted.title} (${extracted.images.length} images)`);

  } catch (error) {
    log(`  [ERROR] ${error.message}`);
    stats.errors++;
  }
}

/**
 * Main
 */
async function main() {
  log('=== Vitamix Site Scraper ===');
  log(`Processing ${URLS_TO_SCRAPE.length} URLs\n`);

  // Clear log file
  writeFileSync(CONFIG.logFile, '');

  const startTime = Date.now();

  for (let i = 0; i < URLS_TO_SCRAPE.length; i++) {
    await processPage(URLS_TO_SCRAPE[i], i, URLS_TO_SCRAPE.length);

    // Force GC periodically
    if (global.gc && i % 10 === 0) {
      global.gc();
    }

    await new Promise(r => setTimeout(r, CONFIG.rateLimit));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  log(`\n=== Complete ===`);
  log(`Time: ${elapsed}s`);
  log(`Scraped: ${stats.scraped}`);
  log(`Skipped: ${stats.skipped}`);
  log(`Errors: ${stats.errors}`);
  log(`Images: ${stats.images}`);
}

main().catch(console.error);
