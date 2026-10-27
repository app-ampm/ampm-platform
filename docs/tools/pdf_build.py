#!/usr/bin/env python3
"""Print a built page (docs/site/*.html) to PDF with headless Google Chrome, rendering the Mermaid diagrams first.

    python3 docs/tools/pdf_build.py docs/site/questions.html "docs/site/AMPM Open Questions.pdf"

Writes <name>-print.html next to the input (the page wrapped as a full document, with the Mermaid library and A4 print
rules added), prints it with Chrome, and reports the page count when pdfinfo (poppler) is installed. Mermaid runs with
deterministic ids: under Chrome's virtual time its default timestamp ids collide and one diagram lands inside another. Needs Google
Chrome in /Applications; the Mermaid library and the fonts load from the network.
"""
from __future__ import annotations

import pathlib
import shutil
import subprocess
import sys
import tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs"
PRINT_RULES = """
<style>
@page { size: A4; margin: 14mm 14mm 16mm; }
html[data-theme="light"] body { background: #fff; }
.doc { padding-block: 0 16px; }
.doc:first-of-type { break-before: auto; }
.doc-body { font-size: 0.95em; }
.doc-body hr { display: none; }
.doc-body h2 { margin-top: 1.3em; padding-top: 0.5em; }
.doc-body h3 { margin-top: 1.2em; }
.doc-body li { margin-block: 0.15em; }
.doc-body p, .doc-body li { max-width: none; }
.callout { margin: 10px 0; }
.callout, .diagram, li, tr { break-inside: avoid; }
thead { display: table-header-group; }
h2, h3 { break-after: avoid; }
.diagram svg { width: auto; max-width: 100%; height: auto; max-height: 230mm; }
.foot { display: none; }
a { color: inherit; text-decoration: none; }
</style>
<script type="module">
  import mermaid from "__MERMAID__";
  mermaid.initialize({ startOnLoad: false, theme: "neutral", deterministicIds: true, deterministicIDSeed: "print" });
  await mermaid.run();
  document.documentElement.dataset.mermaid = "done";
</script>
""".replace("__MERMAID__", MERMAID)


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    if not pathlib.Path(CHROME).exists():
        sys.exit(f"Google Chrome not found at {CHROME}")
    html = src.read_text(encoding="utf8")
    printable = src.with_name(src.stem + "-print.html")
    printable.write_text(
        '<!doctype html>\n<html lang="en" data-theme="light">\n<meta charset="utf-8">\n' + html + PRINT_RULES + "</html>\n",
        encoding="utf8",
    )
    profile = tempfile.mkdtemp(prefix="ampm-chrome-")
    try:
        subprocess.run(
            [
                CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                f"--user-data-dir={profile}", "--virtual-time-budget=20000", "--run-all-compositor-stages-before-draw",
                "--no-pdf-header-footer", f"--print-to-pdf={out.resolve()}", printable.resolve().as_uri(),
            ],
            check=True, capture_output=True, text=True, timeout=240,
        )
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    pages = ""
    if shutil.which("pdfinfo"):
        info = subprocess.run(["pdfinfo", str(out)], capture_output=True, text=True).stdout
        pages = next((f", {line.split()[-1]} pages" for line in info.splitlines() if line.startswith("Pages:")), "")
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB{pages})")


if __name__ == "__main__":
    main()
