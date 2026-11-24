# Content-check fixtures

Real files for the upload content checks (D-187 §2; `apps/api/src/modules/documents/content/`). Every file here is made by `generate/generate.sh` from synthetic content only ("Sample Hotel", "Banquet Hall A", a capacity of 120). Nothing comes from a hotel's real documents, and the local fact sheets are never copied here.

- **Regenerate:** `bash apps/api/test/fixtures/content/generate/generate.sh` (macOS; it overwrites the files below).
- **Expectations:** `expected.json` holds the result each file must give with every kind accepted; `fixtures.spec.ts` fails for a file missing from it, so a regenerated set cannot add an unchecked file.
- **Malicious cases** are not committed binaries: each refusal is built in the specs by the small ZIP, compound-file and PDF writers in `content/testing/`.
- **Passwords** used by the generator: the open password is `open-sample`, the owner password `owner-sample`.

Made on 24 November 2026 on macOS 26.5.1 (Apple Swift 6.3.3, Python 3.14.5).

## Real exports

| File                                                   | Tool and version          | How                                                                                   | Expected                                                              |
| ------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `keynote-14.4.pptx`                                    | Apple Keynote 14.4        | `keynote.applescript`: one slide and a bar chart, `export … as Microsoft PowerPoint`  | pptx (its chart data is an embedded workbook, checked one level deep) |
| `keynote-14.4-password.pptx`                           | Apple Keynote 14.4        | the same, with `{password: …}` (an encrypted OOXML package in a compound file)        | refused: password_protected                                           |
| `keynote-14.4.pdf`                                     | Apple Keynote 14.4        | the same deck, `export … as PDF`                                                      | pdf                                                                   |
| `keynote-14.4-password.pdf`                            | Apple Keynote 14.4        | the same, with `{password: …}` (AES-128, V4 R4)                                       | refused: password_protected                                           |
| `numbers-14.4.xlsx`                                    | Apple Numbers 14.4        | `numbers.applescript`: a menu table with `=SUM(B2:B3)`, `export … as Microsoft Excel` | xlsx                                                                  |
| `numbers-14.4-password.xlsx`                           | Apple Numbers 14.4        | the same, with `{password: …}`                                                        | refused: password_protected                                           |
| `pages-14.4.docx`                                      | Apple Pages 14.4          | `pages.applescript`: `export … as Microsoft Word`                                     | refused: word_document                                                |
| `textutil-macos-26.5.doc`                              | macOS 26.5 `textutil`     | `textutil -convert doc sample.txt` (Word 97 compound file)                            | refused: word_document                                                |
| `textutil-macos-26.5.docx`                             | macOS 26.5 `textutil`     | `textutil -convert docx sample.txt`                                                   | refused: word_document                                                |
| `pdfkit-macos-26.5-aes-128-owner-only.pdf`             | PDFKit, macOS 26.5        | `pdfkit.swift make`: `PDFDocument.write` with an owner password only (AES-128, V4 R4) | pdf                                                                   |
| `pdfkit-macos-26.5-aes-128-user-password.pdf`          | PDFKit, macOS 26.5        | the same with an open password too                                                    | refused: password_protected                                           |
| `pdfkit-macos-26.5-coregraphics-rc4-40-owner-only.pdf` | Core Graphics, macOS 26.5 | `pdfkit.swift make`: `CGContext` with a 40-bit key (RC4, V2 R3)                       | pdf                                                                   |
| `reportlab-5.0.0-plain.pdf`                            | reportlab 5.0.0           | `pdfs.py`: `canvas.Canvas(…, invariant=1)`                                            | pdf                                                                   |
| `reportlab-5.0.0-rc4-40-owner-only.pdf`                | reportlab 5.0.0           | `pdfs.py`: `StandardEncryption("", owner, strength=40)` (V1 R2)                       | pdf                                                                   |
| `reportlab-5.0.0-rc4-128-owner-only.pdf`               | reportlab 5.0.0           | `pdfs.py`: `StandardEncryption("", owner, strength=128)` (V2 R3)                      | pdf                                                                   |
| `pypdf-6.13.3-javascript.pdf`                          | pypdf 6.13.3              | `pdfs.py`: `PdfWriter.add_js`                                                         | refused: pdf_active_content                                           |
| `pypdf-6.13.3-launch.pdf`                              | pypdf 6.13.3              | `pdfs.py`: an `/OpenAction` with `/S /Launch`                                         | refused: pdf_active_content                                           |
| `pypdf-6.13.3-embedded-file.pdf`                       | pypdf 6.13.3              | `pdfs.py`: `PdfWriter.add_attachment`                                                 | refused: pdf_active_content                                           |
| `pypdf-6.13.3-rc4-40-owner-only.pdf`                   | pypdf 6.13.3              | `pdfs.py`: `encrypt(user_password="", …, algorithm="RC4-40")`                         | pdf                                                                   |
| `pypdf-6.13.3-rc4-128-owner-only.pdf`                  | pypdf 6.13.3              | `pdfs.py`: `encrypt(user_password="", …, algorithm="RC4-128")`                        | pdf                                                                   |
| `pypdf-6.13.3-rc4-128-user-password.pdf`               | pypdf 6.13.3              | `pdfs.py`: the same with an open password                                             | refused: password_protected                                           |
| `pillow-12.2.0.jpg`, `.png`, `.webp`, `.gif`           | Pillow 12.2.0             | `pdfs.py`: `Image.save`                                                               | jpeg, png, webp, gif                                                  |
| `sips-macos-26.5.heic`                                 | macOS 26.5 `sips`         | `sips -s format heic seed.png`                                                        | refused: heif_image                                                   |
| `sips-macos-26.5.avif`                                 | macOS 26.5 `sips`         | `sips -s format avif seed.png`                                                        | refused: heif_image                                                   |

pypdf writes RC4 through its built-in fallback; it cannot write AES without the `cryptography` package, which is not installed.

## Written by the specs' encryptor, checked by PDFKit

No tool on this machine writes AES-256 (LibreOffice is not installed, see below). These three files come from `content/testing/pdf-encrypt.ts` through `generate/aes256.ts`, and `generate.sh` keeps them only after PDFKit, an independent reader, opens each one (`pdfkit.swift verify`: the owner-only files open with the empty password, the third only with its password) and shows "Sample Hotel". The algorithm 2.B vectors in `pdf-crypt.spec.ts` were computed separately with Python's `hashlib` and the `openssl` command line.

| File                                                     | What                                                                                                     | Expected                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- |
| `test-encryptor-aes-256-r5-owner-only.pdf`               | AES-256, V5 R5, owner password only                                                                      | pdf                         |
| `test-encryptor-aes-256-r6-owner-only-object-stream.pdf` | AES-256, V5 R6, owner password only, objects in an encrypted object stream with a cross-reference stream | pdf                         |
| `test-encryptor-aes-256-r6-user-password.pdf`            | AES-256, V5 R6, with an open password                                                                    | refused: password_protected |

## Mimicked

Microsoft Office, Google Slides and Sheets, and WPS Office exports are not available here. `fixtures-mimicked.spec.ts` builds their package structure part for part: Excel's styles, shared strings, theme, calculation chain, shared and conditional-formatting formulas, printer settings and thumbnail; PowerPoint's navigation actions, web links, pictures and a chart with an embedded workbook; Google's streamed entries (every entry with a data descriptor); WPS's custom document properties. Strict OOXML packages are built in `ooxml.spec.ts`. `fixtures.spec.ts` also derives a slide show (ppsx), a template (potx) and a workbook template (xltx) from the real Keynote and Numbers exports by changing only the main part's content type. Real exports replace these at the HF gate (D-187 §2, "Fixtures").

## Pending: LibreOffice

LibreOffice 26.2's Homebrew wrapper is on this machine, but its application bundle is missing, so `soffice` does not run. Until it is reinstalled:

- the older `.ppt` and `.xls` are tested with compound files built in the specs (`content/testing/office-records.ts`, mimicking the `PowerPoint Document` and `Current User` streams and a BIFF8 `Workbook` stream);
- the LibreOffice PDF exports (owner password only, and an open password, through the JSON filter options) are not made.

`generate.sh` makes all of them as soon as `soffice --version` runs: `ppt`, `ppsx`, `potx`, `xls`, `xltx` and `doc` conversions of the Keynote and Numbers exports, and the two password PDFs. Add each new file to `expected.json` (the `.ppt` and `.xls` should be ppt and xls; the open-password PDF password_protected; the owner-only PDF pdf, whichever encryption LibreOffice writes).
