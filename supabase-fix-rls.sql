-- Fix RLS policies for AdaptiveWeb
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Pages are publicly readable" ON generated_pages;
DROP POLICY IF EXISTS "Service role can manage pages" ON generated_pages;
DROP POLICY IF EXISTS "Users can read own history" ON search_history;
DROP POLICY IF EXISTS "Service role can manage history" ON search_history;
DROP POLICY IF EXISTS "Topics are publicly readable" ON suggested_topics;

-- Option 1: Disable RLS entirely (simpler for development)
-- Uncomment these lines if you want to skip RLS:
-- ALTER TABLE generated_pages DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE search_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE suggested_topics DISABLE ROW LEVEL SECURITY;

-- Option 2: Create permissive policies (recommended for production)
-- Allow anyone to read pages
CREATE POLICY "Allow public read on pages" ON generated_pages
  FOR SELECT USING (true);

-- Allow anyone to insert pages (for API)
CREATE POLICY "Allow public insert on pages" ON generated_pages
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update pages (for image updates)
CREATE POLICY "Allow public update on pages" ON generated_pages
  FOR UPDATE USING (true);

-- Allow anyone to read history
CREATE POLICY "Allow public read on history" ON search_history
  FOR SELECT USING (true);

-- Allow anyone to insert history
CREATE POLICY "Allow public insert on history" ON search_history
  FOR INSERT WITH CHECK (true);

-- Allow anyone to delete their history
CREATE POLICY "Allow public delete on history" ON search_history
  FOR DELETE USING (true);

-- Allow anyone to read active topics
CREATE POLICY "Allow public read on topics" ON suggested_topics
  FOR SELECT USING (active = true);

-- Verify RLS is enabled
ALTER TABLE generated_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggested_topics ENABLE ROW LEVEL SECURITY;
