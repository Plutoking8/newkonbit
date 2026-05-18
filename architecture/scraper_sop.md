# Technical SOP: Multi-Source AI News Scraper

## 1. Goal & Objectives
This SOP outlines the deterministic pipeline to scrape, clean, and synchronize AI news and articles from 5 target sources into the Supabase database. The pipeline must run reliably, sanitize all inputs, strip tracking tags, and prevent duplicate entries.

## 2. Target Core Sources
1. **The Rundown AI:** Beehiiv RSS feed (`https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml`)
2. **Ben's Bites:** Beehiiv RSS feed (`https://bensbites.beehiiv.com/feed`)
3. **Hacker News:** Algolia Search API frontpage query (`https://hn.algolia.com/api/v1/search?tags=front_page`)
4. **Reddit r/artificial:** Reddit JSON endpoint (`https://www.reddit.com/r/artificial/new.json`)
5. **Product Hunt:** Product Hunt homepage JSON extraction via Next.js `__NEXT_DATA__` static props.

---

## 3. Step-by-Step Processing Pipeline

### Step 3.1: Network Fetching & Rate Limits
- **User-Agent:** All HTTP requests must use a modern browser User-Agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`.
- **Timeout:** Maximum timeout per network request is 10 seconds.
- **Fail-Safe:** If any source fails, log the error to `progress.md` and continue processing remaining sources (do not crash the entire pipeline).

### Step 3.2: Parsing & Source Mapping
- **The Rundown AI & Ben's Bites:**
  - Parse the XML `<item>` nodes.
  - Map: Title ➜ `<title>`, URL ➜ `<link>`, PublishedAt ➜ `<pubDate>` (converted to ISO-8601), Excerpt ➜ `<description>` (stripped of HTML tags and truncated to 300 chars).
- **Hacker News (Algolia API):**
  - Parse the `hits` array.
  - Match titles against AI keywords (e.g. `AI`, `LLM`, `GPT`, `OpenAI`, `Llama`, `Deep Learning`, `Machine Learning`, `Neural Network`).
  - Map: Title ➜ `title`, URL ➜ `url` (fallback to `https://news.ycombinator.com/item?id=` + `objectID` if external link is absent), PublishedAt ➜ `created_at`.
- **Reddit r/artificial:**
  - Parse the `data.children` array.
  - Map: Title ➜ `data.title`, URL ➜ `https://www.reddit.com` + `data.permalink` (or `data.url` if external), PublishedAt ➜ `data.created_utc` (converted to ISO-8601).
- **Product Hunt:**
  - Locate the `<script id="__NEXT_DATA__" type="application/json">` block.
  - Parse the JSON content, navigate to static props, and extract the latest featured posts.
  - Map: Title ➜ `name`, URL ➜ `https://www.producthunt.com/posts/` + `slug`, Summary ➜ `tagline`, PublishedAt ➜ `createdAt`.

### Step 3.3: Data Sanitization
- **URL Cleaning:** All extracted URLs must be parsed, and all tracking search parameters (specifically `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`) must be completely removed.
- **HTML Sanitization:** Excerpts and summaries must be stripped of any raw HTML tags (`<p>`, `<a>`, `<strong>`, etc.) to prevent layout breakage in the presentation layer.

### Step 3.4: Duplicate Prevention & Hashing
- The ID for each article is generated deterministically as a **SHA-256 hash** of `source + URL`.
- This ensures absolute uniqueness. When uploading, use an **UPSERT** operation to update existing records or insert new ones without throwing primary key conflicts.

### Step 3.5: Database Synchronization (Supabase)
- Connect using PostgREST endpoints at `https://usoxofesrriisecyhhfn.supabase.co/rest/v1/articles` using the public `anon` API key.
- Send a `POST` request with headers:
  - `apikey: <anon_key>`
  - `Authorization: Bearer <anon_key>`
  - `Content-Type: application/json`
  - `Prefer: resolution=merge-duplicates` (or standard PostgREST upsert headers).

---

## 4. Error Codes & Recovery Procedures
- **ERR_CONN_TIMEOUT (101):** Network timeout. Retry once. If still failing, log to `progress.md` and skip.
- **ERR_BLOCKED_429 (102):** Rate-limited. Ensure User-Agent is randomized or custom-defined. Introduce a jitter delay (1-2s).
- **ERR_DB_SYNC (103):** Supabase sync failure. Write the failed records to `data/failed_sync.json` to retry in the next pipeline cycle.
