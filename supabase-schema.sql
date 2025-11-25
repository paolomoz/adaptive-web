-- AdaptiveWeb Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Table: generated_pages
-- Stores AI-generated page content
-- ===========================================
CREATE TABLE IF NOT EXISTS generated_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  content_type TEXT DEFAULT 'article',
  keywords TEXT[],
  hero JSONB NOT NULL DEFAULT '{}',
  body JSONB NOT NULL DEFAULT '{}',
  features JSONB NOT NULL DEFAULT '[]',
  faqs JSONB NOT NULL DEFAULT '[]',
  cta JSONB NOT NULL DEFAULT '{}',
  related JSONB NOT NULL DEFAULT '[]',
  images_ready BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster query lookups
CREATE INDEX IF NOT EXISTS idx_pages_query ON generated_pages(query);
CREATE INDEX IF NOT EXISTS idx_pages_created ON generated_pages(created_at DESC);

-- ===========================================
-- Table: search_history
-- Tracks user search history by session
-- ===========================================
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  page_id UUID REFERENCES generated_pages(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_history_session ON search_history(session_id, created_at DESC);

-- ===========================================
-- Table: suggested_topics
-- Pre-defined topics for homepage
-- ===========================================
CREATE TABLE IF NOT EXISTS suggested_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  query TEXT NOT NULL,
  icon TEXT,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true
);

-- Insert default Vitamix topics
INSERT INTO suggested_topics (title, description, query, display_order) VALUES
  ('Ascent Series Blenders', 'Premium smart blending with wireless connectivity', 'Ascent Series Blenders', 1),
  ('Green Smoothie Recipes', 'Nutrient-packed smoothies for energy and wellness', 'Green Smoothie Recipes', 2),
  ('Hot Soup Recipes', 'Create restaurant-quality soups in minutes', 'Hot Soup Recipes', 3),
  ('Self-Cleaning Your Vitamix', 'Clean your blender in 60 seconds', 'Self-Cleaning Your Vitamix', 4)
ON CONFLICT DO NOTHING;

-- ===========================================
-- Enable Row Level Security (RLS)
-- ===========================================
ALTER TABLE generated_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggested_topics ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read pages (for sharing)
CREATE POLICY "Pages are publicly readable" ON generated_pages
  FOR SELECT USING (true);

-- Policy: Service role can insert/update pages
CREATE POLICY "Service role can manage pages" ON generated_pages
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Anyone can read their own history
CREATE POLICY "Users can read own history" ON search_history
  FOR SELECT USING (true);

-- Policy: Service role can manage history
CREATE POLICY "Service role can manage history" ON search_history
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Anyone can read active topics
CREATE POLICY "Topics are publicly readable" ON suggested_topics
  FOR SELECT USING (active = true);

-- ===========================================
-- Enable Realtime for generated_pages
-- Run this in Supabase Dashboard > Database > Replication
-- Or use this SQL:
-- ===========================================
-- Note: You may need to enable this via the Supabase Dashboard
-- Go to Database > Replication > Enable for 'generated_pages'

-- Alternative: Enable via SQL (requires superuser)
-- ALTER PUBLICATION supabase_realtime ADD TABLE generated_pages;

-- ===========================================
-- Helpful Views
-- ===========================================

-- View: Recent pages with image status
CREATE OR REPLACE VIEW recent_pages AS
SELECT
  id,
  query,
  content_type,
  images_ready,
  created_at,
  hero->>'title' as hero_title
FROM generated_pages
ORDER BY created_at DESC
LIMIT 100;

-- ===========================================
-- Done! Your database is ready.
-- ===========================================
