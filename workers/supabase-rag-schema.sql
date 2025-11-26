-- RAG Schema for Vitamix Content
-- Run this in Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Table: vitamix_sources
-- Stores scraped source content from vitamix.com
-- ============================================
CREATE TABLE IF NOT EXISTS vitamix_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('product', 'recipe', 'faq', 'guide')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_sources_type ON vitamix_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_sources_scraped ON vitamix_sources(scraped_at DESC);

-- ============================================
-- Table: vitamix_chunks
-- Stores chunked content with vector embeddings
-- ============================================
CREATE TABLE IF NOT EXISTS vitamix_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES vitamix_sources(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL,
  embedding vector(1536) NOT NULL, -- text-embedding-3-small dimensions
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast vector similarity search
-- This is critical for performance
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON vitamix_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_chunks_source ON vitamix_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON vitamix_chunks(content_type);

-- ============================================
-- Function: search_vitamix_content
-- Performs cosine similarity search
-- ============================================
CREATE OR REPLACE FUNCTION search_vitamix_content(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  chunk_text TEXT,
  content_type TEXT,
  similarity FLOAT,
  title TEXT,
  url TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.source_id,
    c.chunk_text,
    c.content_type,
    1 - (c.embedding <=> query_embedding) AS similarity,
    s.title,
    s.url,
    s.metadata
  FROM vitamix_chunks c
  INNER JOIN vitamix_sources s ON c.source_id = s.id
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- RLS Policies (Row Level Security)
-- ============================================
ALTER TABLE vitamix_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitamix_chunks ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Sources are publicly readable" ON vitamix_sources
  FOR SELECT USING (true);

CREATE POLICY "Chunks are publicly readable" ON vitamix_chunks
  FOR SELECT USING (true);

-- Service role can manage all data
CREATE POLICY "Service role can manage sources" ON vitamix_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage chunks" ON vitamix_chunks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Update generated_pages table for RAG tracking
-- ============================================
ALTER TABLE generated_pages
  ADD COLUMN IF NOT EXISTS rag_source_ids UUID[],
  ADD COLUMN IF NOT EXISTS rag_enabled BOOLEAN DEFAULT false;
