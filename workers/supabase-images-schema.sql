-- Image Storage Schema Update
-- Run this in Supabase SQL Editor

-- Add image columns to vitamix_sources
ALTER TABLE vitamix_sources
  ADD COLUMN IF NOT EXISTS source_image_urls TEXT[],
  ADD COLUMN IF NOT EXISTS r2_image_urls TEXT[];

-- Create index for finding sources with images
CREATE INDEX IF NOT EXISTS idx_sources_has_images
  ON vitamix_sources ((r2_image_urls IS NOT NULL AND array_length(r2_image_urls, 1) > 0));

-- Update the search function to return images
DROP FUNCTION IF EXISTS search_vitamix_content(vector(1536), FLOAT, INT);

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
  metadata JSONB,
  source_image_urls TEXT[],
  r2_image_urls TEXT[]
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
    s.metadata,
    s.source_image_urls,
    s.r2_image_urls
  FROM vitamix_chunks c
  INNER JOIN vitamix_sources s ON c.source_id = s.id
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
