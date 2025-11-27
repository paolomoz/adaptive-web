#!/usr/bin/env node
/**
 * Vitamix Image Scraper
 * Scrapes product/recipe images from vitamix.com and uploads to R2
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
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const R2_BUCKET = 'adaptive-web-images';
const R2_PUBLIC_URL = 'https://pub-c0f8ca67ffd34c6d9a09360b16e75261.r2.dev';

// Product pages with known image patterns
const PRODUCT_PAGES = [
  { url: 'https://www.vitamix.com/us/en_us/shop/a3500', model: 'a3500' },
  { url: 'https://www.vitamix.com/us/en_us/shop/a2500', model: 'a2500' },
  { url: 'https://www.vitamix.com/us/en_us/shop/a2300', model: 'a2300' },
  { url: 'https://www.vitamix.com/us/en_us/shop/e320', model: 'e320' },
  { url: 'https://www.vitamix.com/us/en_us/shop/e310', model: 'e310' },
  { url: 'https://www.vitamix.com/us/en_us/shop/professional-series-750', model: 'pro750' },
];

/**
 * Extract image URLs from HTML
 */
function extractImageUrls(html, baseUrl) {
  const images = new Set();

  // Match src attributes with vitamix image URLs
  const srcMatches = html.matchAll(/src=["'](https:\/\/www\.vitamix\.com\/media\/[^"']+)["']/gi);
  for (const match of srcMatches) {
    const url = match[1];
    // Filter for product images (skip tiny thumbnails and icons)
    if (url.includes('catalog/product') && !url.includes('50x50') && !url.includes('100x100')) {
      images.add(url);
    }
  }

  // Match data-src for lazy loaded images
  const dataSrcMatches = html.matchAll(/data-src=["'](https:\/\/www\.vitamix\.com\/media\/[^"']+)["']/gi);
  for (const match of dataSrcMatches) {
    const url = match[1];
    if (url.includes('catalog/product') && !url.includes('50x50') && !url.includes('100x100')) {
      images.add(url);
    }
  }

  return Array.from(images);
}

/**
 * Download image and upload to R2 via S3 API
 */
async function uploadToR2(imageUrl, r2Key) {
  // Download image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const imageBuffer = await response.arrayBuffer();

  // Upload to R2 using S3-compatible API
  const r2Url = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${r2Key}`;

  const uploadResponse = await fetch(r2Url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': contentType,
    },
    body: imageBuffer,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`R2 upload failed: ${error}`);
  }

  return `${R2_PUBLIC_URL}/${r2Key}`;
}

/**
 * Update source with R2 image URLs
 */
async function updateSourceImages(sourceUrl, r2ImageUrls) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/vitamix_sources?url=eq.${encodeURIComponent(sourceUrl)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ r2_image_urls: r2ImageUrls }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Update failed: ${error}`);
  }
}

/**
 * Process a single product page
 */
async function processProductPage(page) {
  console.log(`\nProcessing: ${page.model}`);

  try {
    // Fetch page
    const response = await fetch(page.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VitamixScraper/1.0)' },
    });

    if (!response.ok) {
      console.log(`  Skipped: HTTP ${response.status}`);
      return;
    }

    const html = await response.text();
    const imageUrls = extractImageUrls(html, page.url);

    console.log(`  Found ${imageUrls.length} images`);

    if (imageUrls.length === 0) return;

    // Take first 5 images max per product
    const selectedImages = imageUrls.slice(0, 5);
    const r2Urls = [];

    for (let i = 0; i < selectedImages.length; i++) {
      const imageUrl = selectedImages[i];
      const ext = imageUrl.split('.').pop().split('?')[0] || 'jpg';
      const r2Key = `vitamix/${page.model}/image-${i}.${ext}`;

      try {
        console.log(`  Uploading image ${i + 1}/${selectedImages.length}...`);
        const r2Url = await uploadToR2(imageUrl, r2Key);
        r2Urls.push(r2Url);
        console.log(`    -> ${r2Url}`);
      } catch (err) {
        console.log(`    Error: ${err.message}`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    }

    // Update database
    if (r2Urls.length > 0) {
      await updateSourceImages(page.url, r2Urls);
      console.log(`  Updated DB with ${r2Urls.length} R2 URLs`);
    }

  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }
}

/**
 * Alternative: Direct R2 upload via Worker API
 * Since we don't have direct R2 API access from Node, we'll create a simple upload endpoint
 */
async function uploadViaWorker(imageUrl, r2Key) {
  // This requires adding an upload endpoint to the worker
  // For now, let's just store the source URLs and download on-demand
  return imageUrl;
}

/**
 * Simplified version: Just store source image URLs (no R2 upload)
 * Images will be proxied or downloaded later
 */
async function processProductPageSimple(page) {
  console.log(`\nProcessing: ${page.model}`);

  try {
    const response = await fetch(page.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VitamixScraper/1.0)' },
    });

    if (!response.ok) {
      console.log(`  Skipped: HTTP ${response.status}`);
      return;
    }

    const html = await response.text();
    const imageUrls = extractImageUrls(html, page.url);

    console.log(`  Found ${imageUrls.length} images`);

    if (imageUrls.length === 0) return;

    // Take best images (larger sizes preferred)
    const selectedImages = imageUrls
      .filter(url => url.includes('2500x2500') || url.includes('620x620') || url.includes('1000x1000'))
      .slice(0, 3);

    if (selectedImages.length === 0) {
      // Fallback to any images
      selectedImages.push(...imageUrls.slice(0, 3));
    }

    console.log(`  Selected ${selectedImages.length} best images`);

    // Update source with image URLs
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/vitamix_sources?url=eq.${encodeURIComponent(page.url)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          source_image_urls: selectedImages,
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.log(`  DB update failed: ${error}`);
    } else {
      console.log(`  Saved ${selectedImages.length} image URLs to DB`);
    }

  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }
}

/**
 * Main
 */
async function main() {
  console.log('=== Vitamix Image Scraper ===');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  // Use simplified version (store URLs, no R2 upload yet)
  for (const page of PRODUCT_PAGES) {
    await processProductPageSimple(page);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
