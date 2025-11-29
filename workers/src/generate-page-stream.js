/**
 * Streaming Page Generation with SSE Progress Events
 * Provides real-time progress updates during page generation
 */

import { generateContentAtoms } from './lib/claude.js';
import { getFallbackLayout } from './lib/gemini.js';
import { createClient as createCloudflareClient } from './lib/cloudflare-db.js';
import { determineImageStrategy, findMatchingImages, applyMatchedImages } from './lib/hybrid-images.js';

/**
 * Create SSE-formatted message
 */
function sseMessage(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Generate page with streaming progress updates
 * Returns a ReadableStream of SSE events
 */
export function generatePageStream(body, env, ctx) {
  const { query, session_id: sessionId } = body;

  if (!query) {
    return new Response(
      sseMessage('error', { message: 'Query is required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event, data) => {
        controller.enqueue(encoder.encode(sseMessage(event, data)));
      };

      try {
        // Initialize DB client
        const supabase = createCloudflareClient(env);

        // Check cache first - return existing page immediately if found
        const normalizedQuery = query.toLowerCase().trim();
        const existingPage = await supabase.getPageByQuery(normalizedQuery);

        if (existingPage) {
          // Check if images need to be refreshed
          if (!existingPage.images_ready && env.IMAGE_VECTORS) {
            // Try to match images for cached page that's missing them
            try {
              const { findMatchingImages, applyMatchedImages, determineImageStrategy } = await import('./lib/hybrid-images.js');
              const contentAtoms = existingPage.content_atoms || [];
              const metadata = existingPage.metadata || {};
              const classification = { type: existingPage.content_type, confidence: 0.8 };

              const imageStrategy = determineImageStrategy(classification, contentAtoms, metadata);
              const matchedImages = await findMatchingImages(contentAtoms, metadata, classification, env);

              const result = applyMatchedImages(existingPage, matchedImages, imageStrategy);
              const updatedPage = result.pageData;

              // Check if we found any images
              const hasImages = matchedImages.hero || matchedImages.recipe || matchedImages.product ||
                matchedImages.features.some(Boolean) || matchedImages.comparison.some(Boolean);

              if (hasImages) {
                updatedPage.images_ready = true;
                // Update the cached page with images
                await supabase.updatePage(existingPage.id, {
                  content_atoms: updatedPage.content_atoms,
                  metadata: updatedPage.metadata,
                  images_ready: true,
                });
              }

              send('progress', {
                step: 'cache_hit',
                message: 'Loading from cache...',
                percent: 90
              });

              send('complete', updatedPage);
              controller.close();
              return;
            } catch (e) {
              console.warn('Failed to refresh images for cached page:', e);
              // Fall through to return cached page as-is
            }
          }

          // Fast path: return cached page
          send('progress', {
            step: 'cache_hit',
            message: 'Loading from cache...',
            percent: 90
          });

          send('complete', existingPage);
          controller.close();
          return;
        }

        // Step 1: RAG Search
        send('progress', {
          step: 'rag_search',
          message: 'Searching knowledge base...',
          percent: 10
        });

        const ragOptions = env.AI
          ? { supabase, ai: env.AI, env }
          : { env };

        // Step 2: Generate content with Claude
        send('progress', {
          step: 'content_generating',
          message: 'Generating content...',
          percent: 25
        });

        const claudeResult = await generateContentAtoms(query, env.ANTHROPIC_API_KEY, ragOptions);
        const { contentAtoms, contentType, metadata, keywords, layoutBlocks, sourceIds, sourceImages, classification } = claudeResult;

        // Send classification info
        send('classification', {
          type: classification?.type || 'general',
          confidence: classification?.confidence || 0,
          sourcesFound: sourceIds.length,
        });

        // Send early content preview (title and description)
        send('content_preview', {
          title: metadata?.title || query,
          description: metadata?.description || '',
          contentType,
        });

        // Stream hero content immediately (can render while images load)
        const heading = contentAtoms.find(a => a.type === 'heading' && a.level === 1);
        const introParagraph = contentAtoms.find(a => a.type === 'paragraph');
        send('content_hero', {
          title: heading?.text || metadata?.title || query,
          subtitle: introParagraph?.text || metadata?.description || '',
          image_prompt: metadata?.primary_image_prompt || null,
        });

        send('progress', {
          step: 'layout_selecting',
          message: 'Selecting layout...',
          percent: 40
        });

        // Step 3: Layout selection
        let layoutResult;
        const isValidLayout = layoutBlocks && Array.isArray(layoutBlocks) && layoutBlocks.length > 0;

        if (isValidLayout) {
          layoutResult = { blocks: layoutBlocks };
        } else {
          layoutResult = getFallbackLayout(contentType, contentAtoms);
        }

        // Post-process for table requests
        const lowerQuery = query.toLowerCase();
        const wantsTable = lowerQuery.includes('table') || lowerQuery.includes('chart') || lowerQuery.includes('specs');
        const hasComparison = contentAtoms.some((a) => a.type === 'comparison');
        const hasTableBlock = layoutResult.blocks.some((b) => b.block_type === 'comparison-table' || b.block_type === 'specs-table');

        if (wantsTable && hasComparison && !hasTableBlock) {
          const cardsIndex = layoutResult.blocks.findIndex((b) => b.block_type === 'comparison-cards');
          const tableBlock = {
            block_type: 'comparison-table',
            atom_mappings: { items: 'comparison.items' },
          };
          if (cardsIndex >= 0) {
            layoutResult.blocks[cardsIndex] = tableBlock;
          } else {
            const heroIndex = layoutResult.blocks.findIndex((b) => b.block_type === 'hero-banner');
            layoutResult.blocks.splice(heroIndex + 1, 0, tableBlock);
          }
        }

        // Prepare page data
        let pageData = {
          query,
          content_type: contentType,
          keywords,
          metadata,
          content_atoms: contentAtoms,
          layout_blocks: layoutResult.blocks,
          pipeline: 'flexible',
          images_ready: false,
          rag_enabled: sourceIds.length > 0,
          rag_source_ids: sourceIds.length > 0 ? sourceIds : null,
        };

        send('progress', {
          step: 'images_searching',
          message: 'Finding images...',
          percent: 55
        });

        // Step 4: Hybrid image strategy
        let remainingPrompts = [];

        if (env.IMAGE_VECTORS && classification) {
          const imageStrategy = determineImageStrategy(classification, contentAtoms, metadata);
          const matchedImages = await findMatchingImages(contentAtoms, metadata, classification, env);

          const ragImageCount = [
            matchedImages.hero,
            ...matchedImages.features,
            ...matchedImages.comparison,
            ...matchedImages.guide,
            matchedImages.recipe,
            matchedImages.product,
          ].filter(Boolean).length;

          send('images_found', {
            ragImages: ragImageCount,
            strategy: imageStrategy.hero,
          });

          const result = applyMatchedImages(pageData, matchedImages, imageStrategy);
          pageData = result.pageData;
          remainingPrompts = result.remainingPrompts;

          // Stream hero with image if found
          if (matchedImages.hero) {
            send('content_hero_image', {
              image_url: matchedImages.hero.url,
            });
          }

          // Stream features with images as they're matched
          const featureSet = contentAtoms.find(a => a.type === 'feature_set');
          if (featureSet?.items) {
            const featuresWithImages = featureSet.items.map((item, i) => ({
              ...item,
              image_url: matchedImages.features[i]?.url || null,
            }));
            send('content_features', {
              items: featuresWithImages,
            });
          }

          // Stream related topics early for engagement
          const relatedAtom = contentAtoms.find(a => a.type === 'related');
          if (relatedAtom?.items?.length) {
            send('content_related', {
              items: relatedAtom.items,
            });
          }
        } else {
          // Fallback: collect all image prompts for generation
          remainingPrompts = collectImagePrompts(pageData);
        }

        // Step 5: Mark image status
        if (remainingPrompts.length > 0) {
          send('progress', {
            step: 'images_pending',
            message: `${remainingPrompts.length} images will be generated...`,
            percent: 70,
            imagesToGenerate: remainingPrompts.length,
          });
          // Images will be generated asynchronously after page is saved
          pageData.images_ready = false;
        } else {
          pageData.images_ready = true;
        }

        send('progress', {
          step: 'saving',
          message: 'Saving page...',
          percent: 90
        });

        // Step 6: Save to database
        const pageId = crypto.randomUUID();
        pageData.id = pageId;
        pageData.session_id = sessionId;

        await supabase.insertPage(pageData);

        send('progress', {
          step: 'complete',
          message: 'Page ready!',
          percent: 100
        });

        // Send final page data
        send('complete', pageData);

      } catch (error) {
        console.error('Stream generation error:', error);
        send('error', { message: error.message || 'Generation failed' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Collect image prompts from page data for generation
 */
function collectImagePrompts(pageData) {
  const prompts = [];

  // Hero image
  if (pageData.metadata?.primary_image_prompt) {
    prompts.push({
      type: 'hero',
      prompt: pageData.metadata.primary_image_prompt,
    });
  }

  // Feature images
  const featureSet = pageData.content_atoms?.find((a) => a.type === 'feature_set');
  if (featureSet?.items) {
    featureSet.items.forEach((item, index) => {
      if (item.image_prompt && !item.image_url) {
        prompts.push({
          type: 'feature',
          index,
          prompt: item.image_prompt,
        });
      }
    });
  }

  return prompts;
}
