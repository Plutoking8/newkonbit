# B.L.A.S.T. Blueprint & Task Plan

## 1. Project Overview & North Star
The North Star is a gorgeous, premium, interactive dashboard aggregating the latest AI newsletter articles (from Ben's Bites, The AI Rundown, and Reddit) from the last 24 hours. The initial version will prototype a Python-based scraper for newsletters and Reddit, output a structured JSON payload, and serve a stunning, glassmorphic web dashboard with localStorage persistence for saving articles.

---

## 2. Core Checklist & Milestones

### Phase 1: B - Blueprint (Vision & Logic)
- [x] Discovery Questions Answered
- [x] Data Schema defined in `gemini.md`
- [ ] Task Plan Blueprint Approved by User (Pending approval of this document)

### Phase 2: L - Link (Connectivity)
- [ ] Test network connectivity to RSS/feed endpoints (Ben's Bites feed, Rundown feed, Reddit hot.json)
- [ ] Build minimal connection handshake script in `tools/test_connectivity.py`

### Phase 3: A - Architect (The 3-Layer Build)
- [ ] **Layer 1 (Architecture):** Write Technical SOP `architecture/scraper_sop.md` defining inputs, parsing rules, edge cases, and Supabase database sync logic.
- [ ] **Layer 2 (Navigation):** Build Python orchestrator `run_pipeline.py` to route execution, validate steps, and update metadata.
- [ ] **Layer 3 (Tools):** Build `tools/scrape_newsletters.py` (a deterministic Python script that fetches RSS, extracts items, parses HTML, strips UTM tags, and writes directly to Supabase `articles` table).

### Phase 4: S - Stylize (Refinement & UI)
- [ ] Design custom dashboard `index.html` integrating the Konbit `logo.png` and using an immersive glassmorphic dark theme (inspired by `designinspo.png`) alongside a brand-compliant light theme.
- [ ] Implement the **Osiris Balonga "Source Selector"** component (adapted for Vanilla JS & CSS) to dynamically filter active news sources with smooth, physics-inspired animations, a search box, checkmark selectors, and a custom "+" add dropdown.
- [ ] Create `index.css` defining brand-specific CSS variables (Primary `#0D6EFD`, Secondary `#F69434`, Accent `#1A9804`, and Plus Jakarta Sans typography).
- [ ] Write `app.js` with source filters (via the Source Selector), category filters, dynamic search, and robust Supabase JS Client integration to fetch articles and toggle saved states in `saved_articles` in real-time.
- [ ] Add the ability to display and toggle "Saved Articles Only" view.

### Phase 5: T - Trigger (Deployment)
- [ ] Configure automation script (`tools/trigger_scrape.bat` or `trigger_scrape.py`) to run every 24 hours.
- [ ] Perform final validation, ensure zero broken styling or placeholders.
