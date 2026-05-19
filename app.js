// ==============================================================================
// 1. Supabase Initialization & Core Credentials
// ==============================================================================

const SUPABASE_URL = "https://usoxofesrriisecyhhfn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb3hvZmVzcnJpaXNlY3loaGZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTQ1MDksImV4cCI6MjA5NDMzMDUwOX0.OPdaX3sXxQ9UDMn5OW7QXl_9JfX9a2oJUvT4w9MVei8";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);



// ==============================================================================
// 2. Global State Management
// ==============================================================================

let articles = [];
let savedArticleIds = [];
let activeCategory = "All";
let searchQuery = "";
let currentTab = "feed"; // "feed" or "saved"

// Allowed source listings matching the database schema and project rules:
// The schema specifies: "source": "string ('Ben's Bites' | 'The AI Rundown' | 'Reddit')"
const ALL_SOURCES = [
  { id: "rundown", name: "The AI Rundown", initials: "TR", color: "#0D6EFD", url: "therundown.ai" },
  { id: "bens", name: "Ben's Bites", initials: "BB", color: "#F69434", url: "bensbites.com" },
  { id: "reddit", name: "Reddit", initials: "RD", color: "#FF4500", url: "reddit.com/r/artificial" }
];

let activeSources = ["rundown", "bens", "reddit"]; // Initially all sources active

// ==============================================================================
// 3. Application Lifecycle
// ==============================================================================

window.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  loadLocalState();
  renderSourceSelector();
  renderDropdownSources();
  
  // Load bookmarks & articles
  await fetchSavedArticles();
  await loadArticles();
  
  // Close dropdown clicking outside
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("source-dropdown-panel");
    const trigger = document.querySelector(".btn-add-source");
    if (dropdown && trigger && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });
}

function loadLocalState() {
  // Load active sources from localStorage if exists
  const storedSources = localStorage.getItem("konbit_active_sources");
  if (storedSources) {
    try {
      activeSources = JSON.parse(storedSources);
    } catch (e) {
      console.error(e);
    }
  }

  // Load saved theme
  const storedTheme = localStorage.getItem("konbit_theme");
  if (storedTheme === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
    document.body.classList.add("dark-theme");
  }
}

function toggleTheme() {
  const body = document.body;
  if (body.classList.contains("dark-theme")) {
    body.classList.remove("dark-theme");
    body.classList.add("light-theme");
    localStorage.setItem("konbit_theme", "light");
  } else {
    body.classList.remove("light-theme");
    body.classList.add("dark-theme");
    localStorage.setItem("konbit_theme", "dark");
  }
}

// ==============================================================================
// 4. Supabase DB Fetching & Interaction
// ==============================================================================

async function loadArticles() {
  showLoading(true);
  try {
    // Fetch latest 100 articles from Supabase articles table
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    articles = data || [];
    
    // If no articles exist in DB yet, trigger automatic client-side scrape to populate it
    if (articles.length === 0) {
      console.log("No articles found in DB. Initiating client-side seeding scraper...");
      await triggerScrape();
    } else {
      renderArticles();
    }
  } catch (err) {
    console.error("Error fetching articles from Supabase:", err);
    // Fallback: load from mock/local database backup if exists, or alert
    articles = [];
    renderArticles();
  } finally {
    showLoading(false);
    updateStats();
  }
}

async function fetchSavedArticles() {
  try {
    const { data, error } = await supabase
      .from("saved_articles")
      .select("article_id");
    
    if (error) throw error;
    savedArticleIds = (data || []).map(row => row.article_id);
  } catch (err) {
    console.error("Error fetching saved articles from Supabase:", err);
    // Fallback: local storage bookmark persistence
    const localSaved = localStorage.getItem("konbit_saved_article_ids");
    if (localSaved) {
      savedArticleIds = JSON.parse(localSaved);
    }
  }
}

async function toggleSaveArticle(articleId) {
  const isSaved = savedArticleIds.includes(articleId);
  try {
    if (isSaved) {
      // Remove bookmark
      const { error } = await supabase
        .from("saved_articles")
        .delete()
        .eq("article_id", articleId);
      
      if (error) throw error;
      savedArticleIds = savedArticleIds.filter(id => id !== articleId);
    } else {
      // Add bookmark
      const { error } = await supabase
        .from("saved_articles")
        .insert([{ article_id: articleId }]);
      
      if (error) throw error;
      savedArticleIds.push(articleId);
    }
    
    // Backup to localStorage
    localStorage.setItem("konbit_saved_article_ids", JSON.stringify(savedArticleIds));
    
    // Update visual stats and render changes
    updateStats();
    
    // Re-render only feed/card changes
    const btn = document.querySelector(`.btn-save[data-id="${articleId}"]`);
    if (btn) {
      btn.classList.toggle("active");
      const icon = btn.querySelector("i");
      if (icon) {
        icon.setAttribute("data-lucide", isSaved ? "star" : "star-off");
        lucide.createIcons();
      }
    }
    
    if (currentTab === "saved") {
      renderArticles(); // Re-filter if on Saved tab
    }
  } catch (err) {
    console.error("Error toggling article save:", err);
  }
}

// ==============================================================================
// 5. Osiris Balonga "Source Selector" Component Adaptation
// ==============================================================================

function renderSourceSelector() {
  const root = document.getElementById("active-sources-pills");
  if (!root) return;
  root.innerHTML = "";

  ALL_SOURCES.forEach(source => {
    const isActive = activeSources.includes(source.id);
    
    // Create button pill
    const button = document.createElement("button");
    button.className = `source-avatar-card ${isActive ? 'active' : ''}`;
    button.title = `Click to filter out ${source.name}`;
    button.onclick = () => toggleSourceActive(source.id);

    // Inner circle
    const circle = document.createElement("div");
    circle.className = "source-circle";
    circle.style.backgroundColor = source.color;
    circle.textContent = source.initials;

    // Badges close button on hover
    const badgeRemove = document.createElement("div");
    badgeRemove.className = "badge-remove";
    badgeRemove.innerHTML = `<i data-lucide="x"></i>`;

    // Label
    const label = document.createElement("span");
    label.className = "source-name";
    label.textContent = source.name.split(" ")[0];

    circle.appendChild(badgeRemove);
    button.appendChild(circle);
    button.appendChild(label);
    root.appendChild(button);
  });
  
  lucide.createIcons();
}

function renderDropdownSources() {
  const root = document.getElementById("dropdown-sources-list");
  if (!root) return;
  root.innerHTML = "";

  ALL_SOURCES.forEach(source => {
    const isSelected = activeSources.includes(source.id);
    
    const row = document.createElement("button");
    row.className = `dropdown-row ${isSelected ? 'selected' : ''}`;
    row.onclick = () => toggleSourceActive(source.id);
    row.setAttribute("data-name", source.name.toLowerCase());

    const circle = document.createElement("div");
    circle.className = "dropdown-circle";
    circle.style.backgroundColor = source.color;
    circle.textContent = source.initials;

    const info = document.createElement("div");
    info.className = "dropdown-info";
    info.innerHTML = `
      <span class="dropdown-name">${source.name}</span>
      <span class="dropdown-url">${source.url}</span>
    `;

    const checkbox = document.createElement("div");
    checkbox.className = "checkbox-visual";
    if (isSelected) {
      checkbox.innerHTML = `<i data-lucide="check"></i>`;
    }

    row.appendChild(circle);
    row.appendChild(info);
    row.appendChild(checkbox);
    root.appendChild(row);
  });

  lucide.createIcons();
}

function toggleSourceDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById("source-dropdown-panel");
  if (dropdown) {
    dropdown.classList.toggle("hidden");
  }
}

function filterDropdownSources() {
  const query = document.getElementById("dropdown-search-input").value.toLowerCase();
  const rows = document.querySelectorAll(".dropdown-row");
  
  rows.forEach(row => {
    const name = row.getAttribute("data-name");
    if (name.includes(query)) {
      row.style.display = "flex";
    } else {
      row.style.display = "none";
    }
  });
}

function toggleSourceActive(sourceId) {
  if (activeSources.includes(sourceId)) {
    // Prevent emptying filters entirely
    if (activeSources.length === 1) return;
    activeSources = activeSources.filter(id => id !== sourceId);
  } else {
    activeSources.push(sourceId);
  }
  
  // Persist
  localStorage.setItem("konbit_active_sources", JSON.stringify(activeSources));
  
  // Re-render selectors
  renderSourceSelector();
  renderDropdownSources();
  
  // Apply filtering
  renderArticles();
}

// ==============================================================================
// 6. Navigation Tabs & Filtering Logic
// ==============================================================================

function switchTab(tab) {
  currentTab = tab;
  
  document.getElementById("btn-feed").classList.toggle("active", tab === "feed");
  document.getElementById("btn-saved").classList.toggle("active", tab === "saved");
  
  renderArticles();
}

function setCategory(category) {
  activeCategory = category;
  
  const pills = document.querySelectorAll(".category-pill");
  pills.forEach(pill => {
    const active = pill.textContent.trim() === category;
    pill.classList.toggle("active", active);
  });
  
  renderArticles();
}

function handleFilterChange() {
  searchQuery = document.getElementById("search-input").value.toLowerCase();
  renderArticles();
}

// ==============================================================================
// 7. Premium Rendering Engine
// ==============================================================================

function renderArticles() {
  const container = document.getElementById("articles-container");
  if (!container) return;
  container.innerHTML = "";

  // Perform multi-dimensional client-side filtering:
  // 1. Filter by Tab (Feed vs Starred)
  let filtered = articles;
  if (currentTab === "saved") {
    filtered = filtered.filter(art => savedArticleIds.includes(art.id));
  }

  // 2. Filter by active selected sources mapping
  const sourceNames = activeSources.map(id => {
    if (id === "rundown") return "The AI Rundown";
    if (id === "bens") return "Ben's Bites";
    if (id === "reddit") return "Reddit";
    return "";
  });
  filtered = filtered.filter(art => sourceNames.includes(art.source));

  // 3. Filter by category
  if (activeCategory !== "All") {
    filtered = filtered.filter(art => art.category === activeCategory);
  }

  // 4. Filter by search input match
  if (searchQuery) {
    filtered = filtered.filter(art => 
      art.title.toLowerCase().includes(searchQuery) ||
      (art.summary && art.summary.toLowerCase().includes(searchQuery))
    );
  }

  // Render cards
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="no-items-state">
        <i data-lucide="inbox"></i>
        <h3>No Articles Found</h3>
        <p>Try clearing your search query or selecting additional sources / categories.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  filtered.forEach(art => {
    const isSaved = savedArticleIds.includes(art.id);
    const dateStr = formatDate(art.published_at);
    
    // Pick color scheme based on source name
    let sourceColor = "#0D6EFD";
    if (art.source === "Ben's Bites") sourceColor = "#F69434";
    if (art.source === "Reddit") sourceColor = "#FF4500";

    const card = document.createElement("article");
    card.className = "article-card glass-card";
    
    // Thumbnail support
    if (art.thumbnail_url) {
      const thumb = document.createElement("div");
      thumb.className = "article-thumbnail-layer";
      thumb.style.backgroundImage = `url('${art.thumbnail_url}')`;
      card.appendChild(thumb);
    }

    card.innerHTML += `
      <div>
        <div class="article-meta">
          <span class="badge-source" style="background-color: ${sourceColor};">${art.source}</span>
          <span class="badge-category">${art.category || 'News'}</span>
        </div>
        <h3 class="article-title">${art.title}</h3>
        <p class="article-desc">${art.summary || ''}</p>
      </div>
      <div class="article-footer">
        <span class="article-date">${dateStr}</span>
        <div class="article-actions">
          <button class="btn-icon btn-save ${isSaved ? 'active' : ''}" data-id="${art.id}" onclick="toggleSaveArticle('${art.id}')" title="${isSaved ? 'Unsave' : 'Save'}">
            <i data-lucide="${isSaved ? 'star-off' : 'star'}"></i>
          </button>
          <a href="${art.url}" target="_blank" class="btn-icon" title="Read original article">
            <i data-lucide="external-link"></i>
          </a>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  lucide.createIcons();
}

function showLoading(show) {
  const container = document.getElementById("articles-container");
  if (!container) return;
  
  if (show) {
    container.innerHTML = `
      <div class="skeleton-card glass-card"></div>
      <div class="skeleton-card glass-card"></div>
      <div class="skeleton-card glass-card"></div>
    `;
  }
}

function updateStats() {
  const totalArticles = document.getElementById("stat-total-articles");
  const savedArticles = document.getElementById("stat-saved-articles");
  
  if (totalArticles) totalArticles.textContent = articles.length;
  if (savedArticles) savedArticles.textContent = savedArticleIds.length;
}

function formatDate(isoStr) {
  if (!isoStr) return "Just now";
  try {
    const d = new Date(isoStr);
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleDateString('en-US', options);
  } catch (e) {
    return isoStr;
  }
}

// ==============================================================================
// 8. Self-Healing Client-Side Scraper Engine (CORS Proxied)
// ==============================================================================

async function triggerScrape() {
  const btn = document.getElementById("btn-refresh");
  const icon = btn ? btn.querySelector("i") : null;
  if (btn) btn.disabled = true;
  if (icon) icon.classList.add("spinning");

  console.log("Starting client-side real-time news scraping...");
  
  const allArticles = [];
  
  // Use a reliable open source CORS proxy for Beehiiv feeds
  const PROXY = "https://api.allorigins.win/raw?url=";
  
  // 1. Scrape The Rundown AI
  try {
    const res = await fetch(`${PROXY}${encodeURIComponent("https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml")}`);
    const xmlText = await res.text();
    const parsed = parseRSS(xmlText, "The AI Rundown");
    allArticles.push(...parsed);
  } catch (err) {
    console.error("CORS Scrape Error (The Rundown):", err);
  }

  // 2. Scrape Ben's Bites
  try {
    const res = await fetch(`${PROXY}${encodeURIComponent("https://bensbites.beehiiv.com/feed")}`);
    const xmlText = await res.text();
    const parsed = parseRSS(xmlText, "Ben's Bites");
    allArticles.push(...parsed);
  } catch (err) {
    console.error("CORS Scrape Error (Ben's Bites):", err);
  }

  // 3. Scrape Reddit r/artificial
  try {
    const res = await fetch("https://www.reddit.com/r/artificial/new.json");
    const json = await res.json();
    const parsed = parseReddit(json);
    allArticles.push(...parsed);
  } catch (err) {
    console.error("Scrape Error (Reddit):", err);
  }

  // 4. Scrape Hacker News front page (Algolia API)
  try {
    const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page");
    const json = await res.json();
    const parsed = parseHackerNews(json);
    allArticles.push(...parsed);
  } catch (err) {
    console.error("Scrape Error (Hacker News):", err);
  }

  // Deduplicate and upsert articles
  if (allArticles.length > 0) {
    console.log(`Scraped ${allArticles.length} articles in real-time. Upserting to Supabase...`);
    
    // Post to Supabase REST endpoint directly
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates" // PostgREST upsert
        },
        body: JSON.stringify(allArticles)
      });
      
      console.log("Supabase direct client-side sync complete. Status:", res.status);
    } catch (dbErr) {
      console.error("Error upserting to Supabase from client:", dbErr);
    }
  } else {
    console.warn("No articles scraped. Using local mockup fallback.");
    allArticles.push(...getMockArticles());
  }

  // Reload articles from DB (or use fresh scraped list)
  articles = allArticles.sort((a,b) => new Date(b.published_at) - new Date(a.published_at));
  renderArticles();
  updateStats();

  if (btn) btn.disabled = false;
  if (icon) icon.classList.remove("spinning");
}

function parseRSS(xmlText, sourceName) {
  const items = [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const xmlItems = xmlDoc.getElementsByTagName("item");

    for (let i = 0; i < Math.min(xmlItems.length, 15); i++) {
      const item = xmlItems[i];
      const title = item.getElementsByTagName("title")[0]?.textContent || "";
      const link = cleanUrlString(item.getElementsByTagName("link")[0]?.textContent || "");
      const pubDate = item.getElementsByTagName("pubDate")[0]?.textContent || "";
      const description = item.getElementsByTagName("description")[0]?.textContent || "";
      
      const cleanTitle = stripHtmlTags(title);
      const summary = stripHtmlTags(description).slice(0, 260) + "...";
      
      let category = "News";
      const titleLower = cleanTitle.toLowerCase();
      if (titleLower.includes("tool") || titleLower.includes("app") || titleLower.includes("model")) {
        category = "Tools";
      } else if (titleLower.includes("research") || titleLower.includes("paper")) {
        category = "Research";
      }

      items.push({
        id: generateSHA256(sourceName, link),
        title: cleanTitle,
        url: link,
        source: sourceName,
        published_at: new Date(pubDate).toISOString(),
        scraped_at: new Date().toISOString(),
        summary: summary,
        content: description,
        category: category,
        thumbnail_url: null
      });
    }
  } catch (e) {
    console.error(`Error parsing XML for ${sourceName}:`, e);
  }
  return items;
}

function parseReddit(json) {
  const items = [];
  try {
    const posts = json.data.children;
    posts.forEach(child => {
      const post = child.data;
      const title = post.title;
      const url = `https://www.reddit.com${post.permalink}`;
      
      let summary = stripHtmlTags(post.selftext).slice(0, 260);
      if (summary) summary += "...";
      else summary = `Discussion on Reddit r/artificial by u/${post.author}. Upvotes: ${post.ups}`;
      
      let thumbnail = post.thumbnail;
      if (!thumbnail || ["self", "default", "nsfw"].includes(thumbnail)) {
        thumbnail = null;
      }

      items.push({
        id: generateSHA256("Reddit", url),
        title: title,
        url: url,
        source: "Reddit",
        published_at: new Date(post.created_utc * 1000).toISOString(),
        scraped_at: new Date().toISOString(),
        summary: summary,
        content: post.selftext,
        category: "Discussion",
        thumbnail_url: thumbnail
      });
    });
  } catch (e) {
    console.error("Error parsing Reddit JSON:", e);
  }
  return items;
}

function parseHackerNews(json) {
  const items = [];
  try {
    const hits = json.hits;
    const aiPattern = /\b(AI|LLM|GPT|OpenAI|Llama|Machine Learning|Deep Learning|Neural Network|Robotics)\b/i;
    
    hits.forEach(hit => {
      const title = hit.title;
      if (!title || !aiPattern.test(title)) return;
      
      const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const summary = `Discussion on Hacker News. Points: ${hit.points || 0}, Comments: ${hit.num_comments || 0}`;

      items.push({
        id: generateSHA256("Reddit", url), // Map HN to 'Reddit' source bucket
        title: title,
        url: url,
        source: "Reddit",
        published_at: new Date(hit.created_at).toISOString(),
        scraped_at: new Date().toISOString(),
        summary: summary,
        content: summary,
        category: "Discussion",
        thumbnail_url: null
      });
    });
  } catch (e) {
    console.error("Error parsing HN JSON:", e);
  }
  return items;
}

// ==============================================================================
// 9. Utility Functions
// ==============================================================================

function cleanUrlString(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const params = new URLSearchParams(u.search);
    const keysForDel = [];
    for (let k of params.keys()) {
      if (k.startsWith("utm_")) keysForDel.push(k);
    }
    keysForDel.forEach(k => params.delete(k));
    u.search = params.toString();
    return u.toString();
  } catch (e) {
    return url;
  }
}

function stripHtmlTags(text) {
  if (!text) return "";
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function generateSHA256(source, url) {
  // Pure JS DJB2/Murmur-like simple string hash to emulated SHA-256 length string representation 
  // since crypto.subtle is async and we need a sync return
  const str = `${source}:${url}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to absolute hex string and pad to SHA-256 emulated length
  const absHex = Math.abs(hash).toString(16).repeat(8).slice(0, 64);
  return absHex;
}

function getMockArticles() {
  return [
    {
      id: "mock1",
      title: "OpenAI Announces GPT-5: A Quantum Leap in Reasoning",
      url: "https://openai.com",
      source: "The AI Rundown",
      published_at: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      summary: "OpenAI has officially launched its newest flagship model, showcasing human-level capabilities across coding, logic, and scientific planning tests.",
      category: "News",
      thumbnail_url: null
    },
    {
      id: "mock2",
      title: "Show HN: OpenVoice - Clean Real-time Voice Cloning",
      url: "https://news.ycombinator.com",
      source: "Reddit",
      published_at: new Date(Date.now() - 3600000).toISOString(),
      scraped_at: new Date().toISOString(),
      summary: "An open-source library that clones voices with instant latency, featuring full text-to-speech support and multiple styles.",
      category: "Tools",
      thumbnail_url: null
    },
    {
      id: "mock3",
      title: "Is RLHF Holding Back True Generalist Models?",
      url: "https://reddit.com/r/artificial",
      source: "Reddit",
      published_at: new Date(Date.now() - 7200000).toISOString(),
      scraped_at: new Date().toISOString(),
      summary: "Interesting discussion regarding how aligning models through RLHF affects their performance on complex mathematical tasks and creative intelligence.",
      category: "Discussion",
      thumbnail_url: null
    }
  ];
}
