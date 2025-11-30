/**
 * Caption Images Endpoint
 * Uses Claude Vision to generate rich captions for product images
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Caption a single image with Claude Vision
 */
async function captionImage(imageUrl, currentAltText, apiKey) {
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

    // Convert to base64 in chunks to avoid stack overflow
    const bytes = new Uint8Array(imageBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64Image = btoa(binary);

    // Detect actual media type from response headers or magic bytes
    const contentType = imageResponse.headers.get('content-type');
    let mediaType = 'image/jpeg'; // default
    if (contentType && contentType.includes('image/')) {
      mediaType = contentType.split(';')[0].trim();
    } else {
      // Check magic bytes
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        mediaType = 'image/png';
      } else if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        mediaType = 'image/jpeg';
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        mediaType = 'image/gif';
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        mediaType = 'image/webp';
      }
    }

    // Call Claude Vision API
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
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
 * Caption product images endpoint
 * POST /api/caption-images
 * Body: { limit?: number, offset?: number, dry_run?: boolean }
 */
export async function captionImages(body, env) {
  const { limit = 10, offset = 0, dry_run = false } = body;
  const db = env.DB;
  const apiKey = env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { error: true, message: 'ANTHROPIC_API_KEY not configured' };
  }

  // Fetch product images that don't have captions yet
  const stmt = db.prepare(`
    SELECT id, alt_text, r2_url
    FROM vitamix_images
    WHERE image_type = 'product'
    AND (ai_caption IS NULL OR ai_caption = '')
    LIMIT ? OFFSET ?
  `);

  const result = await stmt.bind(limit, offset).all();
  const images = result.results || [];

  if (images.length === 0) {
    return {
      success: true,
      message: 'No images to caption',
      processed: 0,
      remaining: 0
    };
  }

  console.log(`Captioning ${images.length} images (offset: ${offset})...`);

  const results = [];
  let successCount = 0;

  for (const img of images) {
    console.log(`  Processing: ${img.alt_text.slice(0, 50)}...`);

    const caption = await captionImage(img.r2_url, img.alt_text, apiKey);

    if (caption) {
      successCount++;
      results.push({
        id: img.id,
        alt_text: img.alt_text,
        caption: caption.caption,
        metadata: {
          model: caption.model,
          series: caption.series,
          view_type: caption.view_type,
          color: caption.color,
          includes: caption.includes,
          is_hero_shot: caption.is_hero_shot,
        },
      });

      // Update database if not dry run
      if (!dry_run) {
        try {
          const updateStmt = db.prepare(`
            UPDATE vitamix_images
            SET ai_caption = ?, caption_metadata = ?
            WHERE id = ?
          `);
          await updateStmt.bind(
            caption.caption,
            JSON.stringify({
              model: caption.model,
              series: caption.series,
              view_type: caption.view_type,
              color: caption.color,
              includes: caption.includes,
              is_hero_shot: caption.is_hero_shot,
            }),
            img.id
          ).run();
        } catch (dbError) {
          console.error(`DB update error for ${img.id}:`, dbError);
        }
      }
    } else {
      results.push({
        id: img.id,
        alt_text: img.alt_text,
        error: 'Failed to caption',
      });
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  // Count remaining
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM vitamix_images
    WHERE image_type = 'product'
    AND (ai_caption IS NULL OR ai_caption = '')
  `);
  const countResult = await countStmt.first();
  const remaining = countResult?.count || 0;

  return {
    success: true,
    dry_run,
    processed: images.length,
    successful: successCount,
    remaining: remaining - (dry_run ? 0 : successCount),
    results,
  };
}
