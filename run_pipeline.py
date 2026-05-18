import subprocess
import os
import sys
from datetime import datetime, timezone

def update_progress(success, error_msg=None):
    progress_path = os.path.join(os.path.dirname(__file__), "progress.md")
    timestamp = datetime.now(timezone.utc).isoformat()
    
    if os.path.exists(progress_path):
        with open(progress_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = "# Progress\n\n## Completed Tasks\n\n## Current Status\n\n## Errors & Solutions\n\n## Test & Results\n"

    # Log error or success
    if success:
        log_entry = f"\n- [x] Scraper pipeline executed successfully at {timestamp}."
        # Update current status
        content = content.replace("## Current Status\n- Waiting for Discovery Questions to be answered.", "## Current Status\n- Pipeline is active and healthy.")
        content = content.replace("## Current Status\n- **Phase 0 & 1 Complete:** Awaiting user's explicit approval of the new task plan and scraping strategy before proceeding to Phase 2: Link (handshake tests).", "## Current Status\n- Pipeline is active and healthy.")
    else:
        log_entry = f"\n- [ ] Scraper pipeline FAILED at {timestamp}. Error: {error_msg}"
        error_section = f"\n### Pipeline Failure ({timestamp})\n**Error:** {error_msg}\n**Solution:** Check connectivity, .env tokens, and rate limits.\n"
        content += error_section

    # Append to Test & Results
    content += f"\n### Scrape Log ({timestamp})\nPipeline finished with status: {'SUCCESS' if success else 'FAILED'}\n"
    
    with open(progress_path, "w", encoding="utf-8") as f:
        f.write(content)

def main():
    print("=========================================")
    print("B.L.A.S.T. Navigator Pipeline Trigger")
    print("=========================================")
    
    tools_dir = os.path.join(os.path.dirname(__file__), "tools")
    scraper_script = os.path.join(tools_dir, "scrape_newsletters.py")
    
    try:
        # Run scraper using sys.executable (runs with current python interpreter if available)
        result = subprocess.run(
            [sys.executable, scraper_script],
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        print("Pipeline Execution: SUCCESS")
        update_progress(True)
        sys.exit(0)
    except subprocess.CalledProcessError as e:
        print("Pipeline Execution: FAILED")
        print(f"Error Code: {e.returncode}")
        print(f"Stdout:\n{e.stdout}")
        print(f"Stderr:\n{e.stderr}")
        update_progress(False, e.stderr or e.stdout)
        sys.exit(e.returncode)
    except Exception as e:
        print("Pipeline Execution: CRITICAL ERROR")
        print(f"Details: {e}")
        update_progress(False, str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
