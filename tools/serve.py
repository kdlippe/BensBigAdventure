"""Serve the game on your network with browser caching turned off.

Plain `python -m http.server` doesn't tell browsers when files change, so a
browser (or tablet) can keep running old copies of some game files next to
new copies of others - which can break the game in confusing ways. This
server adds `Cache-Control: no-cache`, so browsers always check for a newer
file (unchanged files still load fast from cache).

Run from anywhere:  python tools/serve.py          (port 8080)
                    python tools/serve.py 8090     (another port)
"""
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Windows can map .js to text/plain, which browsers refuse to run as modules
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("", PORT), handler) as server:
        print(f"Ben's Monster Truck Rally: http://localhost:{PORT}  (Ctrl+C to stop)")
        server.serve_forever()
