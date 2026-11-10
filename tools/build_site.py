"""Build the published website into _site/, with every game file stamped
with a version so browsers can never mix old and new files after an update.

GitHub Pages lets browsers keep files for 10 minutes. Without a stamp, a
tablet could load the new version of one file and a cached old version of
another, which can freeze the game. Here every JavaScript import gets
"?v=<version>" added, and index.html fetches version.txt (never cached)
before loading the game with that version, so it's all-new or all-old.

Run by .github/workflows/pages.yml on every push to main:
    python tools/build_site.py <version>
Locally nothing changes: without the stamps the game loads files as usual.
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"
PUBLISH = ["index.html", "manifest.webmanifest", "src", "assets"]

# import ... from './x.js'   and   import('./x.js')
IMPORT = re.compile(r"""((?:from|import)\s*\(?\s*['"])(\.{1,2}/[^'"?]+\.js)(['"])""")


def main():
    version = (sys.argv[1] if len(sys.argv) > 1 else "dev")[:12]
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for name in PUBLISH:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, OUT / name)
        else:
            shutil.copy2(src, OUT / name)

    stamped = 0
    for js in (OUT / "src").rglob("*.js"):
        text = js.read_text(encoding="utf-8")
        new, n = IMPORT.subn(lambda m: f"{m.group(1)}{m.group(2)}?v={version}{m.group(3)}", text)
        if n:
            js.write_text(new, encoding="utf-8")
            stamped += n

    (OUT / "version.txt").write_text(version + "\n", encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")  # serve files as they are
    print(f"built _site/ for version {version}: {stamped} imports stamped")


if __name__ == "__main__":
    main()
