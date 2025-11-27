#!/usr/bin/env node
/**
 * Copy images from new scrape sources to old sources with embeddings
 */

const SUPABASE_URL = 'https://jdclzklyiosyfyzoxeho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkY2x6a2x5aW9zeWZ5em94ZWhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA3MDA2MSwiZXhwIjoyMDc5NjQ2MDYxfQ.VQXvr39GLSTXej3DI_39c9NhDt1DNmnC4suO2N9ZgFE';

async function main() {
  // Get sources with images (from full scrape)
  const imgRes = await fetch(SUPABASE_URL + '/rest/v1/vitamix_sources?select=id,title,url,source_image_urls&source_image_urls=not.is.null', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
  });
  const sourcesWithImages = await imgRes.json();

  // Get sources without images
  const noImgRes = await fetch(SUPABASE_URL + '/rest/v1/vitamix_sources?select=id,title,url,source_image_urls&source_image_urls=is.null', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
  });
  const sourcesWithoutImages = await noImgRes.json();

  console.log('Sources with images:', sourcesWithImages.length);
  console.log('Sources without images:', sourcesWithoutImages.length);

  // Build URL-based image map
  const imagesByUrl = {};
  for (const s of sourcesWithImages) {
    if (s.source_image_urls && s.source_image_urls.length > 0) {
      imagesByUrl[s.url] = s.source_image_urls;
    }
  }

  // Create name-based matching for non-URL matches
  const imagesByProduct = {};
  for (const s of sourcesWithImages) {
    if (s.source_image_urls && s.source_image_urls.length > 0 && s.title) {
      // Extract product identifiers
      const match = s.title.match(/(a3500|a2500|a2300|a3300|e310|e320|750|v1200)/i);
      if (match) {
        const key = match[1].toLowerCase();
        if (!imagesByProduct[key]) {
          imagesByProduct[key] = s.source_image_urls;
        }
      }
    }
  }

  console.log('\nImage sources available:');
  console.log('  By URL:', Object.keys(imagesByUrl).length);
  console.log('  By product:', Object.keys(imagesByProduct).join(', '));

  // Update sources without images
  let updated = 0;
  for (const s of sourcesWithoutImages) {
    let images = imagesByUrl[s.url];

    // Try product name matching
    if (!images && s.title) {
      const match = s.title.match(/(a3500|a2500|a2300|a3300|e310|e320|750|v1200)/i);
      if (match) {
        images = imagesByProduct[match[1].toLowerCase()];
      }
    }

    if (images) {
      const res = await fetch(SUPABASE_URL + '/rest/v1/vitamix_sources?id=eq.' + s.id, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ source_image_urls: images })
      });
      if (res.ok) {
        updated++;
        console.log('  Updated:', s.title?.slice(0,50));
      }
    }
  }

  console.log('\nTotal updated:', updated);
}

main().catch(console.error);
