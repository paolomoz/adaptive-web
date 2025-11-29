#!/usr/bin/env node
/**
 * Vitamix Website Crawler
 *
 * Crawls vitamix.com to build a comprehensive RAG database:
 * 1. Fetches URLs from sitemaps
 * 2. Extracts content and images from each page
 * 3. Uploads images to R2
 * 4. Stores page content in D1
 * 5. Generates embeddings via Workers AI and stores in Vectorize
 *
 * Usage:
 *   node scripts/crawl-vitamix.js [--dry-run] [--limit N] [--skip-images] [--start-from N]
 */

import { JSDOM } from 'jsdom';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  sitemaps: [
    'https://www.vitamix.com/us/en_us.sitemap.xml',
    'https://www.vitamix.com/media/en_us.magento_sitemap.xml',
    'https://www.vitamix.com/us/en_us/products/sitemap.xml'
  ],
  // Only crawl US English pages
  urlPatterns: {
    include: [/\/us\/en_us\//],
    exclude: [
      /\.(pdf|zip|xml)$/i,
      /\/checkout\//,
      /\/cart\//,
      /\/account\//,
      /\/search/,
      /\/wishlist\//,
      /\/compare\//,
      /\/review\//,
      /login/,
      /register/,
      /forgot-password/
    ]
  },
  // Rate limiting
  requestDelay: 100, // ms between requests (reduced for speed)
  batchSize: 20,     // pages per batch
  // Image settings
  imageMinSize: 5000, // Skip tiny images (< 5KB)
  imageMaxSize: 10 * 1024 * 1024, // Skip huge images (> 10MB)
  // Chunking
  chunkSize: 800,    // Characters per chunk
  chunkOverlap: 150, // Overlap between chunks
};

// Cloudflare configuration
const CF_ACCOUNT_ID = '2760892a9c26d2a6fd962120dfda1496';
const CF_DATABASE_ID = '407328db-b252-428f-b412-0f902bfd8fdb';
const R2_BUCKET = 'adaptive-web-images';
const R2_PUBLIC_URL = 'https://pub-c0f8ca67ffd34c6d9a09360b16e75261.r2.dev';
const WORKER_URL = 'https://adaptive-web-api.paolo-moz.workers.dev';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_IMAGES = args.includes('--skip-images');
const LIMIT = args.includes('--limit')
  ? parseInt(args[args.indexOf('--limit') + 1])
  : null;
const START_FROM = args.includes('--start-from')
  ? parseInt(args[args.indexOf('--start-from') + 1])
  : 0;

console.log('=== Vitamix Crawler Configuration ===');
console.log(`Dry run: ${DRY_RUN}`);
console.log(`Skip images: ${SKIP_IMAGES}`);
console.log(`Limit: ${LIMIT || 'none'}`);
console.log(`Start from: ${START_FROM}`);
console.log('');

/**
 * Fetch and parse sitemap XML
 */
async function fetchSitemap(url) {
  console.log(`Fetching sitemap: ${url}`);
  const response = await fetch(url);
  const xml = await response.text();

  // Parse URLs from sitemap
  const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  const urls = [];
  for (const match of urlMatches) {
    urls.push(match[1]);
  }

  console.log(`  Found ${urls.length} URLs`);
  return urls;
}

/**
 * Filter URLs based on patterns
 */
function filterUrls(urls) {
  return urls.filter(url => {
    // Must match include pattern
    const included = CONFIG.urlPatterns.include.some(p => p.test(url));
    if (!included) return false;

    // Must not match exclude pattern
    const excluded = CONFIG.urlPatterns.exclude.some(p => p.test(url));
    return !excluded;
  });
}

/**
 * Determine page type from URL
 */
function getPageType(url) {
  if (url.includes('/recipes/')) return 'recipe';
  if (url.includes('/products/')) return 'product';
  if (url.includes('/shop/')) return 'shop';
  if (url.includes('/blog/') || url.includes('/articles/')) return 'blog';
  if (url.includes('/support/') || url.includes('/faq/')) return 'support';
  if (url.includes('/commercial/')) return 'commercial';
  return 'page';
}

/**
 * Extract content and images from a page
 */
async function crawlPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VitamixCrawler/1.0; +https://adaptive-web.paolo-moz.workers.dev)'
      }
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Extract metadata
    const title = doc.querySelector('title')?.textContent?.trim() || '';
    const description = doc.querySelector('meta[name="description"]')?.content || '';
    const ogImage = doc.querySelector('meta[property="og:image"]')?.content || '';

    // Extract main content (remove nav, footer, scripts, etc.)
    const unwanted = doc.querySelectorAll('nav, footer, header, script, style, noscript, iframe, .cookie-banner, .popup, .modal, #onetrust-banner-sdk');
    unwanted.forEach(el => el.remove());

    // Get main content area
    const main = doc.querySelector('main, article, .main-content, #main-content, [role="main"]')
      || doc.body;

    // Extract text content
    const textContent = main?.textContent
      ?.replace(/\s+/g, ' ')
      ?.trim() || '';

    // Extract images
    const images = [];
    const imgElements = doc.querySelectorAll('img');

    for (const img of imgElements) {
      const src = img.src || img.dataset?.src || img.dataset?.lazySrc;
      if (!src) continue;

      // Skip tiny/icon images
      const width = parseInt(img.width) || parseInt(img.getAttribute('width')) || 0;
      const height = parseInt(img.height) || parseInt(img.getAttribute('height')) || 0;
      if (width > 0 && width < 80) continue;
      if (height > 0 && height < 80) continue;

      // Skip SVGs and data URIs
      if (src.startsWith('data:')) continue;
      if (src.endsWith('.svg')) continue;

      // Resolve relative URLs
      let fullUrl;
      try {
        fullUrl = new URL(src, url).href;
      } catch {
        continue;
      }

      // Only include vitamix.com images
      if (!fullUrl.includes('vitamix.com')) continue;

      // Get context (surrounding text)
      const parent = img.closest('figure, .product-image, .recipe-image, .card, .hero, section, .product-info');
      const context = parent?.textContent?.replace(/\s+/g, ' ')?.trim()?.slice(0, 300) || '';

      images.push({
        sourceUrl: fullUrl,
        alt: img.alt || '',
        context,
        width,
        height
      });
    }

    // Extract structured data if available
    let metadata = { description };
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const ld = JSON.parse(jsonLd.textContent);
        if (ld['@type']) metadata.schemaType = ld['@type'];
        if (ld.name) metadata.name = ld.name;
        if (ld.image) metadata.schemaImage = ld.image;
      } catch {}
    }

    // Extract recipe-specific data
    if (url.includes('/recipes/')) {
      const ingredients = Array.from(doc.querySelectorAll('.recipe-ingredients li, .ingredients li, [itemprop="recipeIngredient"]'))
        .map(li => li.textContent.trim())
        .filter(t => t.length > 0);
      const instructions = Array.from(doc.querySelectorAll('.recipe-instructions li, .instructions li, .directions li, [itemprop="recipeInstructions"]'))
        .map(li => li.textContent.trim())
        .filter(t => t.length > 0);

      if (ingredients.length) metadata.ingredients = ingredients;
      if (instructions.length) metadata.instructions = instructions;
    }

    // Extract product-specific data
    if (url.includes('/products/') || url.includes('/shop/')) {
      const price = doc.querySelector('.price, .product-price, [data-price], .price-box .price')?.textContent?.trim();
      const sku = doc.querySelector('[data-sku], .product-sku, [itemprop="sku"]')?.textContent?.trim()
        || doc.querySelector('[data-product-sku]')?.dataset?.productSku;

      if (price) metadata.price = price;
      if (sku) metadata.sku = sku;
    }

    return {
      url,
      pageType: getPageType(url),
      title,
      description,
      content: textContent,
      ogImage,
      images: [...new Map(images.map(img => [img.sourceUrl, img])).values()], // Dedupe
      metadata
    };

  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return null;
  }
}

/**
 * Download and upload image to R2 using wrangler
 */
async function uploadImageToR2(imageUrl, sourceId) {
  if (SKIP_IMAGES || DRY_RUN) return null;

  try {
    // Fetch image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VitamixCrawler/1.0)'
      }
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const contentLength = parseInt(response.headers.get('content-length') || '0');

    // Skip if too small or too large
    if (contentLength > 0 && contentLength < CONFIG.imageMinSize) return null;
    if (contentLength > CONFIG.imageMaxSize) return null;

    // Generate R2 key
    const urlPath = new URL(imageUrl).pathname;
    const ext = urlPath.split('.').pop()?.toLowerCase() || 'jpg';
    const imageId = uuidv4();
    const r2Key = `vitamix/${sourceId}/${imageId}.${ext}`;

    // Save to temp file
    const tempPath = `/tmp/${imageId}.${ext}`;
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);

    // Upload to R2 via wrangler
    try {
      execSync(`npx wrangler r2 object put ${R2_BUCKET}/${r2Key} --file="${tempPath}" --content-type="${contentType}" 2>/dev/null`, {
        cwd: '/Users/paolo/excat/adaptive-web/workers',
        stdio: 'pipe'
      });
    } catch (e) {
      fs.unlinkSync(tempPath);
      return null;
    }

    fs.unlinkSync(tempPath);

    return {
      r2Key,
      r2Url: `${R2_PUBLIC_URL}/${r2Key}`,
      contentType,
      fileSize: buffer.length
    };

  } catch (error) {
    return null;
  }
}

/**
 * Split content into chunks for embedding
 */
function chunkContent(content, title = '', description = '') {
  // Prepend title and description to improve context
  const prefix = [title, description].filter(Boolean).join('. ');
  const fullContent = prefix ? `${prefix}. ${content}` : content;

  const chunks = [];
  const words = fullContent.split(/\s+/);

  let currentChunk = [];
  let currentLength = 0;

  for (const word of words) {
    currentChunk.push(word);
    currentLength += word.length + 1;

    if (currentLength >= CONFIG.chunkSize) {
      chunks.push(currentChunk.join(' '));

      // Keep overlap
      const overlapWords = Math.ceil(CONFIG.chunkOverlap / 5);
      currentChunk = currentChunk.slice(-overlapWords);
      currentLength = currentChunk.join(' ').length;
    }
  }

  // Add remaining
  if (currentChunk.length > 10) { // Skip tiny final chunks
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

/**
 * Generate embeddings via deployed Worker
 */
async function generateEmbeddings(texts) {
  if (DRY_RUN) return texts.map(() => new Array(768).fill(0));

  try {
    const response = await fetch(`${WORKER_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts })
    });

    if (!response.ok) {
      console.log(`    Embedding error: ${response.status}`);
      return [];
    }

    const result = await response.json();
    return result.embeddings;
  } catch (error) {
    console.log(`    Embedding error: ${error.message}`);
    return [];
  }
}

/**
 * Store data in D1 using wrangler
 */
async function storeInD1(source, chunks, images) {
  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would store: source + ${chunks.length} chunks + ${images.length} images`);
    return;
  }

  // Create SQL file for batch insert
  const sqlStatements = [];

  // Escape SQL strings
  const esc = (s) => s ? s.replace(/'/g, "''") : '';

  // Insert source
  sqlStatements.push(`INSERT OR REPLACE INTO vitamix_sources
    (id, url, title, content_type, page_type, metadata, source_image_urls, r2_image_urls, scraped_at, created_at)
    VALUES (
      '${source.id}',
      '${esc(source.url)}',
      '${esc(source.title)}',
      '${source.pageType}',
      '${source.pageType}',
      '${esc(JSON.stringify(source.metadata))}',
      '${esc(JSON.stringify(source.images.map(i => i.sourceUrl)))}',
      '${esc(JSON.stringify(images.filter(i => i?.r2Url).map(i => i.r2Url)))}',
      '${new Date().toISOString()}',
      '${new Date().toISOString()}'
    );`);

  // Insert chunks
  for (let i = 0; i < chunks.length; i++) {
    sqlStatements.push(`INSERT OR REPLACE INTO vitamix_chunks
      (id, source_id, content, chunk_index, created_at)
      VALUES (
        '${source.id}-${i}',
        '${source.id}',
        '${esc(chunks[i])}',
        ${i},
        '${new Date().toISOString()}'
      );`);
  }

  // Insert images
  for (const img of images) {
    if (!img) continue;
    sqlStatements.push(`INSERT OR REPLACE INTO vitamix_images
      (id, source_id, source_url, r2_url, r2_key, alt_text, image_type, context, content_type, file_size, created_at)
      VALUES (
        '${uuidv4()}',
        '${source.id}',
        '${esc(img.sourceUrl)}',
        '${esc(img.r2Url || '')}',
        '${esc(img.r2Key || '')}',
        '${esc(img.alt || '')}',
        '${source.pageType}',
        '${esc(img.context || '')}',
        '${esc(img.contentType || '')}',
        ${img.fileSize || 0},
        '${new Date().toISOString()}'
      );`);
  }

  // Write to temp file and execute
  const sqlFile = `/tmp/vitamix_batch_${Date.now()}.sql`;
  fs.writeFileSync(sqlFile, sqlStatements.join('\n'));

  try {
    execSync(`npx wrangler d1 execute adaptive-web-db --remote --file="${sqlFile}"`, {
      cwd: '/Users/paolo/excat/adaptive-web/workers',
      stdio: 'pipe'
    });
  } catch (e) {
    // Try to get more info from stderr
    const stderr = e.stderr?.toString() || '';
    if (stderr.includes('SQLITE_CONSTRAINT') || stderr.includes('UNIQUE')) {
      // Ignore duplicate key errors
    } else if (e.message.includes('Command failed')) {
      console.log(`    D1: ${stderr.slice(0, 100) || 'error (suppressed)'}`);
    } else {
      console.log(`    D1 error: ${e.message}`);
    }
  }

  try { fs.unlinkSync(sqlFile); } catch {}
}

/**
 * Store embeddings in Vectorize via deployed Worker
 */
async function storeInVectorize(sourceId, chunks, embeddings) {
  if (DRY_RUN || embeddings.length === 0) {
    return;
  }

  const vectors = chunks.map((chunk, i) => ({
    id: `${sourceId}-${i}`,
    values: embeddings[i],
    metadata: {
      source_id: sourceId,
      chunk_index: i,
      text: chunk.slice(0, 500)
    }
  }));

  try {
    const response = await fetch(`${WORKER_URL}/api/upsert-vectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vectors })
    });

    if (!response.ok) {
      console.log(`    Vectorize error: ${response.status}`);
    }
  } catch (error) {
    console.log(`    Vectorize error: ${error.message}`);
  }
}

/**
 * Main crawl function
 */
async function main() {
  console.log('=== Starting Vitamix Crawl ===\n');

  // Step 1: Collect all URLs from sitemaps
  console.log('Step 1: Fetching sitemaps...');
  let allUrls = [];
  for (const sitemap of CONFIG.sitemaps) {
    const urls = await fetchSitemap(sitemap);
    allUrls = allUrls.concat(urls);
  }

  // Deduplicate
  allUrls = [...new Set(allUrls)];
  console.log(`Total unique URLs: ${allUrls.length}\n`);

  // Step 2: Filter URLs
  console.log('Step 2: Filtering URLs...');
  const filteredUrls = filterUrls(allUrls);
  console.log(`Filtered to ${filteredUrls.length} URLs\n`);

  // Apply start and limit
  let urlsToProcess = filteredUrls.slice(START_FROM);
  if (LIMIT) {
    urlsToProcess = urlsToProcess.slice(0, LIMIT);
  }
  console.log(`Processing ${urlsToProcess.length} URLs (starting from ${START_FROM})\n`);

  // Step 3: Crawl pages
  console.log('Step 3: Crawling pages...');
  let processed = 0;
  let errors = 0;
  let totalImages = 0;
  let totalChunks = 0;

  for (let i = 0; i < urlsToProcess.length; i += CONFIG.batchSize) {
    const batch = urlsToProcess.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(urlsToProcess.length / CONFIG.batchSize);
    console.log(`\n--- Batch ${batchNum}/${totalBatches} (${processed} processed, ${errors} errors) ---`);

    for (const url of batch) {
      process.stdout.write(`  ${url.slice(0, 70)}... `);

      const page = await crawlPage(url);

      if (!page || !page.content || page.content.length < 50) {
        console.log('SKIP (no content)');
        errors++;
        continue;
      }

      // Generate source ID
      const sourceId = uuidv4();

      // Chunk content
      const chunks = chunkContent(page.content, page.title, page.description);
      totalChunks += chunks.length;

      // Upload images to R2 (parallel)
      const uploadedImages = [];
      if (!SKIP_IMAGES && page.images.length > 0) {
        const imagePromises = page.images.slice(0, 8).map(async (img) => {
          const uploaded = await uploadImageToR2(img.sourceUrl, sourceId);
          return uploaded ? { ...img, ...uploaded } : null;
        });
        const results = await Promise.all(imagePromises);
        for (const r of results) {
          if (r) {
            uploadedImages.push(r);
            totalImages++;
          }
        }
      }

      // Generate embeddings
      let embeddings = [];
      if (!DRY_RUN && chunks.length > 0) {
        embeddings = await generateEmbeddings(chunks);
      }

      // Store in D1
      await storeInD1(
        { id: sourceId, ...page },
        chunks,
        uploadedImages
      );

      // Store in Vectorize
      if (embeddings.length > 0) {
        await storeInVectorize(sourceId, chunks, embeddings);
      }

      processed++;
      console.log(`OK (${page.pageType}, ${chunks.length}c, ${uploadedImages.length}i)`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, CONFIG.requestDelay));
    }
  }

  console.log('\n=== Crawl Complete ===');
  console.log(`Processed: ${processed} pages`);
  console.log(`Errors: ${errors}`);
  console.log(`Total chunks: ${totalChunks}`);
  console.log(`Total images uploaded: ${totalImages}`);
}

main().catch(console.error);
