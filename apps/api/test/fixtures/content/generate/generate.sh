#!/usr/bin/env bash
# Regenerates the content-check fixtures in apps/api/test/fixtures/content (README.md there names every
# file's tool, version and command). macOS only: Keynote, Numbers, Pages, textutil, sips and Swift's PDFKit,
# plus Python with reportlab, pypdf and Pillow, and LibreOffice when it is installed. Synthetic content only.
# Run from anywhere: bash apps/api/test/fixtures/content/generate/generate.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
out="$(cd "$here/.." && pwd)"
api="$(cd "$here/../../../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

open="open-sample"
macos="macos-$(sw_vers -productVersion | cut -d. -f1-2)"
keynote="keynote-$(defaults read /Applications/Keynote.app/Contents/Info.plist CFBundleShortVersionString)"
numbers="numbers-$(defaults read /Applications/Numbers.app/Contents/Info.plist CFBundleShortVersionString)"
pages="pages-$(defaults read /Applications/Pages.app/Contents/Info.plist CFBundleShortVersionString)"

echo "reportlab, pypdf and Pillow"
python3 "$here/pdfs.py" "$out" "$work"

echo "PDFKit and Core Graphics"
xcrun swift "$here/pdfkit.swift" make "$work/reportlab-plain.pdf" "$out" "pdfkit-$macos"

echo "Keynote, Numbers and Pages"
osascript "$here/keynote.applescript" "$out" "$keynote" "$open"
osascript "$here/numbers.applescript" "$out" "$numbers" "$open"
osascript "$here/pages.applescript" "$out" "$pages"

echo "textutil and sips"
printf 'Sample Hotel\nBanquet Hall A\n' >"$work/sample.txt"
textutil -convert doc "$work/sample.txt" -output "$out/textutil-$macos.doc"
textutil -convert docx "$work/sample.txt" -output "$out/textutil-$macos.docx"
sips -s format heic "$work/seed.png" --out "$out/sips-$macos.heic" >/dev/null
sips -s format avif "$work/seed.png" --out "$out/sips-$macos.avif" >/dev/null

echo "AES-256 (the specs' encryptor), each opened in PDFKit before it is kept"
(cd "$api" && node --import tsx test/fixtures/content/generate/aes256.ts "$out")
xcrun swift "$here/pdfkit.swift" verify "$out/test-encryptor-aes-256-r5-owner-only.pdf"
xcrun swift "$here/pdfkit.swift" verify "$out/test-encryptor-aes-256-r6-owner-only-object-stream.pdf"
xcrun swift "$here/pdfkit.swift" verify "$out/test-encryptor-aes-256-r6-user-password.pdf" "$open"

# LibreOffice: the older .ppt and .xls, templates, slide shows, Word, and PDFs with and without passwords.
# Not installed when the fixtures were first made (24 Nov 2026); add each new file to expected.json.
if soffice --version >/dev/null 2>&1; then
  libre="libreoffice-$(soffice --version | awk '{print $2}' | cut -d. -f1-2)"
  echo "LibreOffice ($libre)"
  convert() { soffice --headless --convert-to "$1" --outdir "$work/lo" "$2" >/dev/null; }
  convert "ppt:MS PowerPoint 97" "$out/$keynote.pptx"
  convert "ppsx:Impress MS PowerPoint 2007 XML AutoPlay" "$out/$keynote.pptx"
  convert "potx:Impress MS PowerPoint 2007 XML Template" "$out/$keynote.pptx"
  convert "xls:MS Excel 97" "$out/$numbers.xlsx"
  convert "xltx:Calc MS Excel 2007 XML Template" "$out/$numbers.xlsx"
  convert "doc:MS Word 97" "$work/sample.txt"
  for file in "$work"/lo/*; do mv "$file" "$out/$libre.${file##*.}"; done
  owner_only='{"RestrictPermissions":{"type":"boolean","value":"true"},"PermissionPassword":{"type":"string","value":"owner-sample"}}'
  needs_open='{"EncryptFile":{"type":"boolean","value":"true"},"DocumentOpenPassword":{"type":"string","value":"'"$open"'"}}'
  convert "pdf:impress_pdf_Export:$owner_only" "$out/$keynote.pptx" && mv "$work/lo/$keynote.pdf" "$out/$libre-owner-only.pdf"
  convert "pdf:impress_pdf_Export:$needs_open" "$out/$keynote.pptx" && mv "$work/lo/$keynote.pdf" "$out/$libre-open-password.pdf"
else
  echo "LibreOffice not found: its fixtures are skipped (README.md, 'Pending')"
fi

echo "done: $(find "$out" -maxdepth 1 -type f ! -name '*.md' ! -name '*.json' | wc -l | tr -d ' ') fixtures"
