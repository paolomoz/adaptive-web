#!/usr/bin/env node
/**
 * Migration script: Supabase -> Cloudflare D1/Vectorize
 * Run with: node scripts/migrate-to-cloudflare.js
 *
 * Migrates:
 * - vitamix_sources -> D1 vitamix_sources table
 * - vitamix_chunks -> D1 vitamix_chunks table + Vectorize embeddings
 *
 * Requires:
 * - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
 * - Wrangler authenticated (for D1/Vectorize commands)
 */

import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jdclzklyiosyfyzoxeho.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const D1_DATABASE = 'adaptive-web-db';
const VECTORIZE_INDEX = 'adaptive-web-vectors';

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY environment variable');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchFromSupabase(table, select = '*', limit = 1000) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.status}`);
  }
  return response.json();
}

async function fetchChunksWithEmbeddings(limit = 1000, offset = 0) {
  const url = `${SUPABASE_URL}/rest/v1/vitamix_chunks?select=id,source_id,content,chunk_index,embedding&limit=${limit}&offset=${offset}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch chunks: ${response.status}`);
  }
  return response.json();
}

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str !== 'string') str = JSON.stringify(str);
  return `'${str.replace(/'/g, "''")}'`;
}

async function migrateSources() {
  console.log('Fetching vitamix_sources from Supabase...');
  const sources = await fetchFromSupabase('vitamix_sources');
  console.log(`Found ${sources.length} sources`);

  if (sources.length === 0) return;

  // Generate SQL INSERT statements
  const values = sources.map((s) => {
    return `(${escapeSQL(s.id)}, ${escapeSQL(s.url)}, ${escapeSQL(s.title)}, ${escapeSQL(s.content_type)}, ${escapeSQL(JSON.stringify(s.source_image_urls || []))}, ${escapeSQL(JSON.stringify(s.r2_image_urls || []))}, ${escapeSQL(s.scraped_at)}, ${escapeSQL(s.created_at || new Date().toISOString())})`;
  }).join(',\n');

  const sql = `INSERT OR REPLACE INTO vitamix_sources (id, url, title, content_type, source_image_urls, r2_image_urls, scraped_at, created_at) VALUES\n${values};`;

  // Write to temp file and execute
  const fs = await import('fs');
  fs.writeFileSync('/tmp/migrate_sources.sql', sql);

  console.log('Inserting sources into D1...');
  execSync(`npx wrangler d1 execute ${D1_DATABASE} --remote --file=/tmp/migrate_sources.sql`, {
    stdio: 'inherit',
  });

  console.log(`Migrated ${sources.length} sources to D1`);
}

async function migrateChunks() {
  console.log('Fetching vitamix_chunks from Supabase...');

  let offset = 0;
  const batchSize = 100;
  let totalChunks = 0;
  let totalVectors = 0;

  while (true) {
    const chunks = await fetchChunksWithEmbeddings(batchSize, offset);
    if (chunks.length === 0) break;

    console.log(`Processing batch at offset ${offset}, ${chunks.length} chunks...`);

    // Insert chunks into D1
    const values = chunks.map((c) => {
      return `(${escapeSQL(c.id)}, ${escapeSQL(c.source_id)}, ${escapeSQL(c.content)}, ${c.chunk_index || 0}, ${escapeSQL(new Date().toISOString())})`;
    }).join(',\n');

    const sql = `INSERT OR REPLACE INTO vitamix_chunks (id, source_id, content, chunk_index, created_at) VALUES\n${values};`;

    const fs = await import('fs');
    fs.writeFileSync('/tmp/migrate_chunks.sql', sql);

    execSync(`npx wrangler d1 execute ${D1_DATABASE} --remote --file=/tmp/migrate_chunks.sql`, {
      stdio: 'pipe',
    });

    totalChunks += chunks.length;

    // Prepare vectors for Vectorize
    const vectors = chunks
      .filter((c) => c.embedding && Array.isArray(c.embedding))
      .map((c) => ({
        id: c.id,
        values: c.embedding,
        metadata: {
          source_id: c.source_id,
          content: c.content?.substring(0, 500),
          chunk_index: c.chunk_index || 0,
        },
      }));

    if (vectors.length > 0) {
      // Write vectors to NDJSON file for Vectorize upsert
      const ndjson = vectors.map((v) => JSON.stringify(v)).join('\n');
      fs.writeFileSync('/tmp/vectors.ndjson', ndjson);

      console.log(`  Inserting ${vectors.length} vectors into Vectorize...`);
      try {
        execSync(`npx wrangler vectorize insert ${VECTORIZE_INDEX} --file=/tmp/vectors.ndjson`, {
          stdio: 'pipe',
        });
        totalVectors += vectors.length;
      } catch (e) {
        console.error(`  Warning: Vector insert failed: ${e.message}`);
      }
    }

    offset += batchSize;

    // Rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`Migrated ${totalChunks} chunks to D1`);
  console.log(`Migrated ${totalVectors} vectors to Vectorize`);
}

async function main() {
  console.log('=== Supabase -> Cloudflare Migration ===\n');

  try {
    await migrateSources();
    console.log('');
    await migrateChunks();
    console.log('\n=== Migration Complete ===');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
