# Project Constitution (gemini.md)

## 1. Data Schemas

### 1.1 Scraped Article Schema
Each article extracted by our scraping engine must strictly adhere to the following JSON structure:

```json
{
  "id": "string (SHA-256 hash of source + url to ensure uniqueness)",
  "title": "string (Title of the article or newsletter section)",
  "url": "string (Absolute URL to the source article/newsletter post)",
  "source": "string ('Ben's Bites' | 'The AI Rundown' | 'Reddit')",
  "published_at": "string (ISO-8601 UTC timestamp: YYYY-MM-DDTHH:mm:ssZ)",
  "scraped_at": "string (ISO-8601 UTC timestamp of scraping execution)",
  "summary": "string (Brief summary/excerpt of the article, max 300 chars)",
  "content": "string (Full HTML or text content, optional, for detailed reading views)",
  "category": "string ('News' | 'Tools' | 'Research' | 'Discussion' | 'Other')",
  "thumbnail_url": "string | null (URL to an image, if found in source content)"
}
```

### 1.2 State Management & Sync Schema
For the local storage persistence:

```json
{
  "articles": "Array<ScrapedArticle> (Cached scraped articles from the last 24h/feed)",
  "saved_article_ids": "Array<string> (List of unique IDs that the user has starred/saved)",
  "last_updated": "string (ISO-8601 timestamp of the last successful scrape/fetch)"
}
```

---

## 2. Behavioral Rules
- **System Pilot Identity:** Deterministic, self-healing automation using the B.L.A.S.T. protocol.
- **Priority:** Reliability over speed.
- **Rule:** Never guess at business logic.
- **Rule:** Halt Execution before code is written until Discovery Questions are answered, Data Schema is defined, and `task_plan.md` has an approved Blueprint.
- **Rule:** Golden Rule for Architecture - If logic changes, update the SOP before updating the code.
- **Rule:** Standardize formatting - Scraped data must always be cleaned of tracking links (e.g., utm parameters), and HTML tags should be sanitised.

---

## 3. Architectural Invariants
- **Layer 1 (Architecture):** Technical SOPs in Markdown located in `architecture/` defining goals, inputs, logic, and edge cases.
- **Layer 2 (Navigation):** Reasoning layer for routing data between SOPs and Tools. No complex tasks performed directly.
- **Layer 3 (Tools):** Deterministic Python/JS scripts in `tools/`. Environment variables in `.env`. Intermediate files in `.tmp/`.
- **Frontend / Presentation:** Built using HTML/JS/CSS, using premium custom CSS, Google Fonts (Plus Jakarta Sans), HSL color variables, smooth micro-animations, and glassmorphic designs matching the brand identity.

---

## 4. Brand Identity & Design System

### 4.1 Color Palette
- **Primary:** `#0D6EFD` (Vibrant Brand Blue)
- **Secondary:** `#F69434` (Brand Orange - Bitcoin Style)
- **Accent:** `#1A9804` (Brand Green - Konbit Leaf)
- **Background Light:** `#FFFFFF`
- **Background Dark:** `#0E0C15` / `#151221` (Premium Charcoal/Purple from `designinspo.png`)
- **Text Light Primary:** `#1A9804` (Headers) / `#1C1C24` (Readable body text)
- **Text Dark Primary:** `#FFFFFF` / `#E2E2E9`

### 4.2 Typography
- **Primary Font Family:** Plus Jakarta Sans
- **Heading Font Family:** Plus Jakarta Sans
- **h1:** `56px`
- **h2:** `44px`
- **body:** `18px`
