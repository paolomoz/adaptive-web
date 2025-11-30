#!/usr/bin/env node
/**
 * Caption Product Images with Claude Vision
 *
 * Fetches all product images from D1, sends to Claude for captioning,
 * and updates the database with rich descriptions for better RAG.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/caption-product-images.js
 *
 * Options:
 *   --dry-run    Preview without updating database
 *   --limit=N    Process only N images
 *   --offset=N   Start from image N
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const D1_API_URL = 'https://adaptive-web-api.paolo-moz.workers.dev';

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable required');
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const offsetArg = args.find(a => a.startsWith('--offset='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const offset = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;

/**
 * Fetch product images from the API
 */
async function fetchProductImages() {
  // We'll query D1 directly via wrangler, but for now use a simple approach
  // The API doesn't have a list endpoint, so we'll use the data we queried earlier
  console.log('Fetching product images from D1...');

  // Execute D1 query via fetch to our API (we'll add an endpoint)
  // For now, let's create the SQL and run via wrangler
  return null; // Will use wrangler d1 execute
}

/**
 * Caption a single image with Claude Vision
 */
async function captionImage(imageUrl, currentAltText) {
  const prompt = `Analyze this Vitamix product image and provide:

1. A detailed caption (2-3 sentences) describing:
   - The exact product model/name visible
   - The view angle (front, side, 3/4 view, top-down, lifestyle/in-use)
   - Color/finish of the product
   - What's included (containers, accessories, cups)
   - Any text/labels visible on the product
   - Background type (white studio, kitchen lifestyle, etc.)

2. Structured metadata extraction.

Current alt text from website: "${currentAltText}"

Respond with ONLY valid JSON in this format:
{
  "caption": "Detailed 2-3 sentence description for semantic search...",
  "model": "Model name/number (e.g., S55, A3500, E310)",
  "series": "Series name (e.g., Ascent, Explorian, Space-Saving, Propel)",
  "view_type": "front|side|3/4|top|lifestyle|detail|bundle",
  "color": "Color name (e.g., black, graphite, champagne, red, white)",
  "includes": ["List of items shown", "e.g., 64oz container", "personal cup"],
  "is_hero_shot": true/false (is this the main product photo?)
}`;

  try {
    // Fetch image as base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mediaType = imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Call Claude Vision API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const textContent = data.content.find(block => block.type === 'text');

    if (!textContent) {
      throw new Error('No text content in Claude response');
    }

    // Parse JSON response
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

    return JSON.parse(jsonText.trim());
  } catch (error) {
    console.error(`Error captioning ${imageUrl}:`, error.message);
    return null;
  }
}

/**
 * Process images in batches
 */
async function processImages(images) {
  const results = [];
  const BATCH_SIZE = 5; // Process 5 at a time to avoid rate limits

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(images.length / BATCH_SIZE)}...`);

    const batchResults = await Promise.all(
      batch.map(async (img) => {
        console.log(`  Captioning: ${img.alt_text.slice(0, 40)}...`);
        const caption = await captionImage(img.r2_url, img.alt_text);
        return { ...img, caption_result: caption };
      })
    );

    results.push(...batchResults);

    // Small delay between batches
    if (i + BATCH_SIZE < images.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return results;
}

/**
 * Generate SQL update statements
 */
function generateUpdateSQL(results) {
  const statements = [];

  for (const img of results) {
    if (!img.caption_result) continue;

    const caption = img.caption_result;
    const aiCaption = caption.caption.replace(/'/g, "''"); // Escape single quotes
    const metadata = JSON.stringify({
      model: caption.model,
      series: caption.series,
      view_type: caption.view_type,
      color: caption.color,
      includes: caption.includes,
      is_hero_shot: caption.is_hero_shot,
    }).replace(/'/g, "''");

    statements.push(
      `UPDATE vitamix_images SET ai_caption = '${aiCaption}', caption_metadata = '${metadata}' WHERE id = '${img.id}';`
    );
  }

  return statements;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Vitamix Product Image Captioning ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit} images`);
  if (offset) console.log(`Offset: ${offset}`);
  console.log('');

  // For this script, we'll read images from a JSON file generated by wrangler
  // First, let's export the images
  console.log('Step 1: Export product images from D1');
  console.log('Run this command first:');
  console.log('');
  console.log(`npx wrangler d1 execute adaptive-web-db --remote --command "SELECT id, alt_text, r2_url FROM vitamix_images WHERE image_type = 'product'" --json > /tmp/product_images.json`);
  console.log('');

  // Check if file exists
  const fs = await import('fs');
  const path = '/tmp/product_images.json';

  if (!fs.existsSync(path)) {
    console.log('Product images file not found. Please run the export command above first.');
    return;
  }

  // Read and parse images
  const rawData = fs.readFileSync(path, 'utf-8');
  const jsonData = JSON.parse(rawData);

  // Handle wrangler output format
  let images = [];
  if (Array.isArray(jsonData) && jsonData[0]?.results) {
    images = jsonData[0].results;
  } else if (jsonData.results) {
    images = jsonData.results;
  } else {
    images = jsonData;
  }

  console.log(`Found ${images.length} product images`);

  // Apply offset and limit
  let toProcess = images.slice(offset);
  if (limit) {
    toProcess = toProcess.slice(0, limit);
  }

  console.log(`Processing ${toProcess.length} images (offset: ${offset}, limit: ${limit || 'none'})`);
  console.log('');

  // Process images
  console.log('Step 2: Captioning images with Claude Vision...');
  const results = await processImages(toProcess);

  // Count successes
  const successful = results.filter(r => r.caption_result).length;
  console.log(`\nCaptioned ${successful}/${toProcess.length} images successfully`);

  // Generate SQL
  console.log('\nStep 3: Generating SQL updates...');
  const sqlStatements = generateUpdateSQL(results);

  // Write SQL to file
  const sqlPath = '/tmp/update_captions.sql';
  fs.writeFileSync(sqlPath, sqlStatements.join('\n'));
  console.log(`SQL written to ${sqlPath} (${sqlStatements.length} statements)`);

  // Show sample results
  console.log('\n=== Sample Results ===');
  const samples = results.filter(r => r.caption_result).slice(0, 3);
  for (const sample of samples) {
    console.log(`\nImage: ${sample.alt_text}`);
    console.log(`Caption: ${sample.caption_result.caption}`);
    console.log(`Model: ${sample.caption_result.model}, Series: ${sample.caption_result.series}`);
    console.log(`View: ${sample.caption_result.view_type}, Color: ${sample.caption_result.color}`);
    console.log(`Hero shot: ${sample.caption_result.is_hero_shot}`);
  }

  if (dryRun) {
    console.log('\n=== DRY RUN - No database changes made ===');
    console.log(`To apply changes, run without --dry-run`);
  } else {
    console.log('\nStep 4: To apply changes, run:');
    console.log(`npx wrangler d1 execute adaptive-web-db --remote --file=${sqlPath}`);
  }

  // Write full results to JSON for debugging
  const resultsPath = '/tmp/caption_results.json';
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to ${resultsPath}`);
}

main().catch(console.error);
