-- Initial D1 schema for AdaptiveWeb
-- Mirrors the Supabase schema for drop-in replacement

-- Generated pages table
CREATE TABLE IF NOT EXISTS generated_pages (
  id TEXT PRIMARY KEY,
  query TEXT,
  content_type TEXT,
  metadata TEXT,  -- JSON
  keywords TEXT,  -- JSON array
  hero TEXT,      -- JSON object
  faqs TEXT,      -- JSON array
  features TEXT,  -- JSON array
  related_topics TEXT,  -- JSON array
  content_atoms TEXT,   -- JSON array
  layout_blocks TEXT,   -- JSON array
  rag_source_ids TEXT,  -- JSON array
  rag_source_images TEXT,  -- JSON array
  images_ready INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- Index for query lookups (cache)
CREATE INDEX IF NOT EXISTS idx_pages_query ON generated_pages(query);
CREATE INDEX IF NOT EXISTS idx_pages_created_at ON generated_pages(created_at);

-- Search history table
CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  query TEXT NOT NULL,
  page_id TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_session ON search_history(session_id);

-- Suggested topics table
CREATE TABLE IF NOT EXISTS suggested_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT
);

-- Vitamix sources table (for RAG)
CREATE TABLE IF NOT EXISTS vitamix_sources (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE,
  title TEXT,
  content_type TEXT,
  source_image_urls TEXT,  -- JSON array
  r2_image_urls TEXT,      -- JSON array
  scraped_at TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sources_url ON vitamix_sources(url);

-- Vitamix content chunks (for RAG - embeddings stored in Vectorize)
CREATE TABLE IF NOT EXISTS vitamix_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  created_at TEXT,
  FOREIGN KEY (source_id) REFERENCES vitamix_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_chunks_source ON vitamix_chunks(source_id);
