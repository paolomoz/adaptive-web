-- Add images table for RAG image matching
-- Images are downloaded to R2 and tagged for semantic retrieval

-- Vitamix images table
CREATE TABLE IF NOT EXISTS vitamix_images (
  id TEXT PRIMARY KEY,
  source_id TEXT,                    -- FK to vitamix_sources
  source_url TEXT NOT NULL,          -- Original vitamix.com URL
  r2_url TEXT,                       -- Our R2 copy
  r2_key TEXT,                       -- R2 object key
  alt_text TEXT,
  image_type TEXT,                   -- 'product', 'recipe', 'lifestyle', 'hero', 'thumbnail'
  context TEXT,                      -- Surrounding text/caption from page
  tags TEXT,                         -- JSON array for semantic matching
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  content_type TEXT,                 -- image/jpeg, image/png, etc.
  created_at TEXT,
  FOREIGN KEY (source_id) REFERENCES vitamix_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_images_source ON vitamix_images(source_id);
CREATE INDEX IF NOT EXISTS idx_images_type ON vitamix_images(image_type);
CREATE INDEX IF NOT EXISTS idx_images_r2_key ON vitamix_images(r2_key);

-- Add page_type to vitamix_sources for better categorization
ALTER TABLE vitamix_sources ADD COLUMN page_type TEXT;

-- Add metadata JSON column to vitamix_sources
ALTER TABLE vitamix_sources ADD COLUMN metadata TEXT;
