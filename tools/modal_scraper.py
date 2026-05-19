import modal
import os
import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import hashlib
import ssl
from datetime import datetime, timezone

# ==============================================================================
# 1. Modal App Definition & Image Environment Setup
# ==============================================================================

# Define the serverless app (using App which is the standard in modern Modal,
# with fallback to Stub for backward compatibility).
app = modal.App("konbit-ai-scraper")

# Define a lightweight container image with zero-dependency built-in utilities
image = modal.Image.debian_slim()

# Browser-like headers to prevent blocks
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# ==============================================================================
# 2. Scraper Helpers
# ==============================================================================

def clean_url(url):
    """Strip all UTM/tracking search parameters from the URL."""
    if not url:
        return ""
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query)
    cleaned_qs = {k: v for k, v in qs.items() if not k.startswith("utm_")}
    query = urllib.parse.urlencode(cleaned_qs, doseq=True)
    cleaned = urllib.parse.ParseResult(
        parsed.scheme, parsed.netloc, parsed.path, parsed.params, query, parsed.fragment
    )
    return urllib.parse.urlunparse(cleaned)

def strip_html(text):
    """Strip all HTML tags and trim whitespace."""
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", "", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def generate_id(source, url):
    """Generate SHA-256 hash for source + URL to act as unique ID."""
    hash_input = f"{source}:{url}"
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

def make_request(url):
    """Safely make a network request and return bytes."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=15) as response:
            return response.read()
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None

# ==============================================================================
# 3. Source Parsers
# ==============================================================================

def scrape_beehiv_feed(source_name, url):
    """Scrape standard Beehiiv RSS feeds."""
    print(f"Scraping {source_name} feed...")
    data = make_request(url)
    if not data:
        return []
    
    articles = []
    try:
        root = ET.fromstring(data)
        for item in root.findall(".//item"):
            title = item.find("title").text if item.find("title") is not None else ""
            link = item.find("link").text if item.find("link") is not None else ""
            pub_date_str = item.find("pubDate").text if item.find("pubDate") is not None else ""
            description = item.find("description").text if item.find("description") is not None else ""
            
            title = strip_html(title)
            link = clean_url(link)
            summary = strip_html(description)[:280] + "..." if len(description) > 280 else strip_html(description)
            
            try:
                pub_date = datetime.strptime(pub_date_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
                pub_date = pub_date.replace(tzinfo=timezone.utc)
            except Exception:
                pub_date = datetime.now(timezone.utc)
            
            category = "News"
            title_lower = title.lower()
            if any(k in title_lower for k in ["tool", "app", "model", "release"]):
                category = "Tools"
            elif any(k in title_lower for k in ["research", "paper", "scientific", "study"]):
                category = "Research"
            
            articles.append({
                "id": generate_id(source_name, link),
                "title": title,
                "url": link,
                "source": source_name,
                "published_at": pub_date.isoformat(),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "summary": summary,
                "content": description,
                "category": category,
                "thumbnail_url": None
            })
    except Exception as e:
        print(f"  XML Parsing error for {source_name}: {e}")
        
    print(f"  Extracted {len(articles)} articles from {source_name}")
    return articles

def scrape_hacker_news():
    """Scrape Hacker News front page using Algolia search, filtered for AI topics."""
    print("Scraping Hacker News front page (via Algolia API)...")
    url = "https://hn.algolia.com/api/v1/search?tags=front_page"
    data = make_request(url)
    if not data:
        return []
    
    articles = []
    try:
        payload = json.loads(data.decode("utf-8"))
        hits = payload.get("hits", [])
        ai_pattern = re.compile(r"\b(AI|LLM|GPT|OpenAI|Anthropic|Llama|Machine Learning|Deep Learning|Neural Network|Cognitive|Robotics)\b", re.IGNORECASE)
        
        for hit in hits:
            title = hit.get("title")
            if not title or not ai_pattern.search(title):
                continue
                
            link = hit.get("url")
            if not link:
                link = f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                
            link = clean_url(link)
            created_at = hit.get("created_at") or datetime.now(timezone.utc).isoformat()
            summary = f"Discussion on Hacker News. Points: {hit.get('points', 0)}, Comments: {hit.get('num_comments', 0)}"
            
            articles.append({
                "id": generate_id("Reddit", link),
                "title": title,
                "url": link,
                "source": "Reddit", # Map to Reddit source to comply with schema source enums
                "published_at": created_at,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "summary": summary,
                "content": summary,
                "category": "Discussion",
                "thumbnail_url": None
            })
    except Exception as e:
        print(f"  JSON/API Parsing error for Hacker News: {e}")
        
    print(f"  Extracted {len(articles)} AI-related articles from Hacker News")
    return articles

def scrape_reddit_artificial():
    """Scrape Reddit r/artificial latest posts."""
    print("Scraping Reddit r/artificial...")
    url = "https://www.reddit.com/r/artificial/new.json"
    data = make_request(url)
    if not data:
        return []
    
    articles = []
    try:
        payload = json.loads(data.decode("utf-8"))
        children = payload.get("data", {}).get("children", [])
        
        for child in children:
            post = child.get("data", {})
            title = post.get("title", "")
            permalink = post.get("permalink", "")
            link = f"https://www.reddit.com{permalink}"
            
            selftext = post.get("selftext", "")
            summary = strip_html(selftext)[:280] + "..." if len(selftext) > 280 else strip_html(selftext)
            if not summary:
                summary = f"Reddit post on r/artificial by u/{post.get('author')}. Upvotes: {post.get('ups')}"
                
            created_utc = post.get("created_utc")
            pub_date = datetime.fromtimestamp(created_utc, tz=timezone.utc).isoformat() if created_utc else datetime.now(timezone.utc).isoformat()
            thumbnail = post.get("thumbnail")
            if not thumbnail or thumbnail in ["self", "default", "nsfw"]:
                thumbnail = None
                
            articles.append({
                "id": generate_id("Reddit", link),
                "title": title,
                "url": link,
                "source": "Reddit",
                "published_at": pub_date,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "summary": summary,
                "content": selftext,
                "category": "Discussion",
                "thumbnail_url": thumbnail
            })
    except Exception as e:
        print(f"  JSON Parsing error for Reddit: {e}")
        
    print(f"  Extracted {len(articles)} posts from Reddit r/artificial")
    return articles

# ==============================================================================
# 4. Modal Scheduled Scraper Function
# ==============================================================================

# Schedule the function to run daily (every 24 hours).
# It will load the credentials from the Modal environment Secrets.
@app.function(
    image=image,
    schedule=modal.Period(days=1),
    secrets=[modal.Secret.from_dict({
        "SUPABASE_URL": "https://usoxofesrriisecyhhfn.supabase.co",
        "SUPABASE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb3hvZmVzcnJpaXNlY3loaGZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTQ1MDksImV4cCI6MjA5NDMzMDUwOX0.OPdaX3sXxQ9UDMn5OW7QXl_9JfX9a2oJUvT4w9MVei8"
    })]
)

def daily_scraper_cron():
    print("=========================================")
    print("Modal Scheduled Scraper Executing in Cloud")
    print("=========================================")
    
    # Load secrets
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("CRITICAL ERROR: Supabase credentials are missing in Modal Secrets!")
        return

    # 1. Scrape The Rundown AI
    rundown_articles = scrape_beehiv_feed("The AI Rundown", "https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml")
    
    # 2. Scrape Ben's Bites
    bens_articles = scrape_beehiv_feed("Ben's Bites", "https://bensbites.beehiiv.com/feed")
    
    # 3. Scrape Hacker News
    hn_articles = scrape_hacker_news()
    
    # 4. Scrape Reddit
    reddit_articles = scrape_reddit_artificial()
    
    # Combine
    all_articles = rundown_articles + bens_articles + hn_articles + reddit_articles
    
    if not all_articles:
        print("No articles scraped.")
        return

    print(f"Scraped {len(all_articles)} articles successfully. Syncing to Supabase...")
    
    # Direct PostgREST Rest API Sync
    rest_url = f"{supabase_url}/rest/v1/articles"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    try:
        data_bytes = json.dumps(all_articles).encode("utf-8")
        req = urllib.request.Request(rest_url, data=data_bytes, headers=headers, method="POST")
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=30) as response:
            status = response.status
            if status in [200, 201, 204]:
                print(f"Supabase sync SUCCESS! Sync status code: {status}")
            else:
                print(f"Supabase returned status: {status}")
    except Exception as e:
        print(f"Database sync failed: {e}")

    print("=========================================")
    print("Scheduled Cloud Scraper Job Finished")
    print("=========================================")
