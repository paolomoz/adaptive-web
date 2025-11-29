/**
 * Reindex Vitamix content vectors using Workers AI
 * Generates new embeddings with bge-base-en-v1.5 (768 dims)
 * and upserts to Vectorize
 */

import { generateEmbeddings } from './lib/embeddings.js';

/**
 * Reindex all Vitamix chunks with Workers AI embeddings
 * @param {object} env - Worker environment bindings
 * @returns {Promise<object>} Reindex result
 */
export async function reindexVectors(env) {
  const db = env.DB;
  const vectorize = env.VECTORIZE;
  const ai = env.AI;

  if (!db || !vectorize || !ai) {
    throw new Error('Missing required bindings: DB, VECTORIZE, or AI');
  }

  console.log('Starting vector reindexing with Workers AI...');

  // Fetch all chunks from D1
  const chunksResult = await db
    .prepare('SELECT id, source_id, content FROM vitamix_chunks')
    .all();

  const chunks = chunksResult.results || [];
  console.log(`Found ${chunks.length} chunks to reindex`);

  if (chunks.length === 0) {
    return { success: true, message: 'No chunks to reindex', count: 0 };
  }

  // Process in batches (Workers AI supports batch embedding)
  const BATCH_SIZE = 10;
  const vectors = [];
  let processed = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content.substring(0, 2000)); // Truncate long content

    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);

    try {
      // Generate embeddings using Workers AI
      const embeddings = await generateEmbeddings(texts, ai);

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        vectors.push({
          id: chunk.id,
          values: embeddings[j],
          metadata: {
            source_id: chunk.source_id,
            content: chunk.content.substring(0, 500),
            chunk_index: 0,
          },
        });
      }

      processed += batch.length;
    } catch (error) {
      console.error(`Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      // Continue with next batch
    }
  }

  console.log(`Generated ${vectors.length} vectors, upserting to Vectorize...`);

  // Upsert to Vectorize in batches (Vectorize has limits)
  const VECTORIZE_BATCH_SIZE = 100;
  let upserted = 0;

  for (let i = 0; i < vectors.length; i += VECTORIZE_BATCH_SIZE) {
    const batch = vectors.slice(i, i + VECTORIZE_BATCH_SIZE);
    try {
      await vectorize.upsert(batch);
      upserted += batch.length;
      console.log(`Upserted ${upserted}/${vectors.length} vectors`);
    } catch (error) {
      console.error(`Error upserting batch:`, error);
    }
  }

  console.log(`Reindexing complete: ${upserted} vectors upserted`);

  return {
    success: true,
    message: 'Reindexing complete',
    totalChunks: chunks.length,
    processedChunks: processed,
    vectorsUpserted: upserted,
  };
}
