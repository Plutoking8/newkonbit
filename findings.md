# Findings

## Research
We have analyzed the 5 core target websites to identify the most robust, deterministic, and rate-limit-resistant methods for data extraction:

1. **The Rundown AI:**
   - **Target URL:** `https://www.therundown.ai/`
   - **Extraction Path:** Direct RSS feed at `https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml`.
   - **Data Structure:** Standard XML containing `<item>` blocks with `<title>`, `<link>`, `<pubDate>`, and `<description>`. Highly reliable.

2. **Ben's Bites:**
   - **Target URL:** `https://www.bensbites.com/`
   - **Extraction Path:** Beehiiv RSS feed at `https://bensbites.beehiiv.com/feed` (which redirects from `https://www.bensbites.com/feed`).
   - **Data Structure:** Standard Beehiiv XML format. Extremely clean and fast to parse.

3. **Hacker News:**
   - **Target URL:** `https://news.ycombinator.com/`
   - **Extraction Path:** Algolia Search API (`https://hn.algolia.com/api/v1/search?tags=front_page`) or official RSS feed (`https://news.ycombinator.com/rss`).
   - **Data Structure:** Algolia JSON response contains `hits` with `title`, `url`, `created_at`, and `points`.
   - **Filtering strategy:** Since HN contains general tech news, we filter headlines matching regex keywords like `\b(AI|LLM|GPT|OpenAI|Anthropic|Llama|Machine Learning|Deep Learning|Neural Network|Cognitive|Robotics)\b`.

4. **Reddit r/artificial:**
   - **Target URL:** `https://www.reddit.com/r/artificial/`
   - **Extraction Path:** JSON Feed at `https://www.reddit.com/r/artificial/new.json`.
   - **Data Structure:** JSON payload returning a listing of posts with `title`, `url`, `created_utc`, `selftext` (body text), and `thumbnail`.
   - **Rate Limit Countermeasure:** Must use a customized `User-Agent` string to bypass Reddit's aggressive bot blocker.

5. **Product Hunt:**
   - **Target URL:** `https://www.producthunt.com/`
   - **Extraction Path:** Next.js static props scraper. By fetching `https://www.producthunt.com/` and parsing the `<script id="__NEXT_DATA__" type="application/json">` block, we extract the pre-rendered JSON payload containing all featured products, taglines, upvotes, and images.
   - **Why this works:** Avoids brittle HTML DOM parsing and heavy GraphQL client auth requirements. Completely deterministic and lightweight.

---

## Discoveries & Architectural Invariants
- **Row Level Security (RLS) Policy:** The Supabase public tables `articles` and `saved_articles` are fully configured with custom policies for the `anon` role, allowing select/insert/delete states to operate in a completely serverless frontend.
- **UTM Sanitizer:** A custom sanitizer function in our Python scraper strips all Google Analytics/tracking search parameters (e.g. `?utm_source=...`) from scraped article URLs to maintain data clean-room status.
- **Hash Uniqueness:** The primary key of the `articles` table is generated as a `SHA-256` hash of `source + url` to prevent double-inserting duplicates.

---

## Constraints
- **Reddit Rate Limits:** Reddit will block generic `urllib` or `requests` queries with `429 Too Many Requests`. The scraper must use a browser-like User-Agent.
- **Hacker News Spam:** The front page has lots of non-AI content. A keyword filter is required to keep the dashboard tightly focused on AI news.
- **Product Hunt Dynamic Rendering:** Product Hunt is fully dynamic; simple HTML parsing of tags will fail. The `__NEXT_DATA__` technique must be implemented to retrieve structured props.
