"""PDF and image fixtures for the content checks, made with reportlab, pypdf and Pillow (see ../README.md).

Usage: python3 pdfs.py <fixtures folder> <work folder>. Synthetic content only ("Sample Hotel",
"Banquet Hall A"). pypdf writes RC4 without the `cryptography` package (its built-in fallback); it cannot
write AES without it, so the AES fixtures come from PDFKit and the specs' own encryptor.
"""

from __future__ import annotations

import sys
from pathlib import Path

import PIL
import pypdf
import reportlab
from PIL import Image, ImageDraw
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject
from reportlab.lib.pdfencrypt import StandardEncryption
from reportlab.pdfgen import canvas

OWNER = "owner-sample"
OPEN = "open-sample"
PYPDF = f"pypdf-{pypdf.__version__}"
REPORTLAB = f"reportlab-{reportlab.Version}"
PILLOW = f"pillow-{PIL.__version__}"


def sample_page(path: Path, encrypt: StandardEncryption | None = None) -> None:
    page = canvas.Canvas(str(path), pagesize=(595, 842), encrypt=encrypt, invariant=1)
    page.setFont("Helvetica", 24)
    page.drawString(72, 760, "Sample Hotel")
    page.setFont("Helvetica", 14)
    page.drawString(72, 730, "Banquet Hall A: 120 guests")
    page.showPage()
    page.save()


def reportlab_fixtures(out: Path, work: Path) -> Path:
    plain = work / "reportlab-plain.pdf"
    sample_page(plain)
    (out / f"{REPORTLAB}-plain.pdf").write_bytes(plain.read_bytes())
    sample_page(out / f"{REPORTLAB}-rc4-40-owner-only.pdf", StandardEncryption("", OWNER, strength=40))
    sample_page(out / f"{REPORTLAB}-rc4-128-owner-only.pdf", StandardEncryption("", OWNER, strength=128))
    return plain


def pypdf_writer(source: Path) -> PdfWriter:
    return PdfWriter(clone_from=str(source))


def pypdf_fixtures(out: Path, source: Path) -> None:
    script = pypdf_writer(source)
    script.add_js("app.alert('Sample Hotel');")
    script.write(out / f"{PYPDF}-javascript.pdf")

    launch = pypdf_writer(source)
    launch._root_object[NameObject("/OpenAction")] = DictionaryObject(
        {NameObject("/S"): NameObject("/Launch"), NameObject("/F"): TextStringObject("menu.txt")}
    )
    launch.write(out / f"{PYPDF}-launch.pdf")

    attachment = pypdf_writer(source)
    attachment.add_attachment("menu.txt", b"Sample Hotel\nBanquet Hall A\n")
    attachment.write(out / f"{PYPDF}-embedded-file.pdf")

    for algorithm, user, name in [
        ("RC4-40", "", "rc4-40-owner-only"),
        ("RC4-128", "", "rc4-128-owner-only"),
        ("RC4-128", OPEN, "rc4-128-user-password"),
    ]:
        locked = pypdf_writer(source)
        locked.encrypt(user_password=user, owner_password=OWNER, algorithm=algorithm)
        locked.write(out / f"{PYPDF}-{name}.pdf")


def image_fixtures(out: Path, work: Path) -> None:
    image = Image.new("RGB", (160, 90), (240, 236, 228))
    ImageDraw.Draw(image).text((8, 30), "Sample Hotel", fill=(30, 30, 30))
    image.save(work / "seed.png")
    image.save(out / f"{PILLOW}.jpg", quality=80)
    image.save(out / f"{PILLOW}.png")
    image.save(out / f"{PILLOW}.webp", quality=80)
    image.convert("P").save(out / f"{PILLOW}.gif")


def main() -> None:
    out, work = Path(sys.argv[1]), Path(sys.argv[2])
    plain = reportlab_fixtures(out, work)
    pypdf_fixtures(out, plain)
    image_fixtures(out, work)


if __name__ == "__main__":
    main()
