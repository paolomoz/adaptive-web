# RAG Improvements Plan

## Status: Phases 1-3 & 5 Complete
Crawl running: ~850+/2900 sources, ~3250+ images uploaded

## Improvement Order

### Phase 1: Query Classification (DONE)
- [x] Classify incoming queries by type: product, recipe, blog, support, general
- [x] Route queries to prioritize relevant source types
- [x] Foundation for smarter image/content matching
- Implemented in: `src/lib/query-classifier.js`
- Integrated into: `src/lib/rag.js`
- Classification returned with RAG results for downstream use

### Phase 2: Image Search via Vectorize (DONE)
- [x] Create embeddings for image alt_text + context
- [x] Store in separate Vectorize index: `adaptive-web-images`
- [x] Enable semantic image search: "smoothie" → smoothie photos
- Implemented in: `src/lib/image-search.js`
- API endpoints: `/api/search-images`, `/api/index-images`
- 3000+ images indexed

### Phase 3: Use RAG Images + Hybrid Strategy (DONE)
- [x] Products: Use real product images from RAG
- [x] Recipes: Use real recipe photos from RAG
- [x] Hero/lifestyle: Generate with Imagen when no RAG match
- [x] Match images to content based on semantic similarity
- Implemented in: `src/lib/hybrid-images.js`
- Integrated into: `src/generate-page.js`
- Result: Recipe query → 4 RAG images found → No Imagen needed!

### Phase 4: Better Content Chunking (next crawl)
- [ ] Semantic chunking by paragraphs/sections
- [ ] Include richer metadata: product name, category, price
- [ ] Better context preservation

### Phase 5: Caching Layer (DONE)
- [x] Cache RAG results for common queries
- [x] Reduce latency and API costs
- [x] Using Cloudflare KV with 1-hour TTL
- Implemented in: `src/lib/rag-cache.js`
- KV namespace: `RAG_CACHE`
- Test endpoint: `/api/test-rag?q=query`
- Result: Cache HIT = 4ms vs Cache MISS = 1263ms (315x faster!)

### Phase 6: Image Deduplication (next crawl)
- [ ] Hash images by source URL before upload
- [ ] Skip duplicates to save R2 storage
- [ ] Update crawler script

---

## Notes
- Phases 1-3, 5 complete and deployed
- Phases 4, 6 require crawler modifications (next crawl)
