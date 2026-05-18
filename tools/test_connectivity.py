import urllib.request
import json
import ssl
import sys

# Configure SSL context to avoid certificate verification issues on some systems
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# Targets to test
TARGETS = {
    "The Rundown AI Feed": "https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml",
    "Ben's Bites Feed": "https://bensbites.beehiiv.com/feed",
    "Hacker News Algolia API": "https://hn.algolia.com/api/v1/search?tags=front_page",
    "Reddit r/artificial Feed": "https://www.reddit.com/r/artificial/new.json",
    "Product Hunt Homepage": "https://www.producthunt.com/",
    "Supabase API": "https://usoxofesrriisecyhhfn.supabase.co"
}

def test_url(name, url):
    print(f"Testing connectivity to {name}... ", end="", flush=True)
    req = urllib.request.Request(
        url,
        headers={
            # Add user-agent to avoid being blocked by Cloudflare/Reddit/Product Hunt
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    )
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=10) as response:
            status = response.status
            if status in [200, 201, 301, 302]:
                print(f"SUCCESS (Status {status})")
                return True
            else:
                print(f"FAILED (Status {status})")
                return False
    except Exception as e:
        print(f"FAILED (Error: {e})")
        return False

def main():
    print("=========================================")
    print("B.L.A.S.T. Connectivity Link Handshake")
    print("=========================================")
    results = []
    for name, url in TARGETS.items():
        success = test_url(name, url)
        results.append(success)
    print("=========================================")
    if all(results):
        print("LINK VERIFICATION: ALL SYSTEMS ONLINE")
        sys.exit(0)
    else:
        print("LINK VERIFICATION: SOME SYSTEMS OFFLINE")
        sys.exit(1)

if __name__ == "__main__":
    main()
