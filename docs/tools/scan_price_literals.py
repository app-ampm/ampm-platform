#!/usr/bin/env python3
"""Fail if a price or fee is hard-coded in source (AC-02.9 / AC-25.4, SPEC §10, brief rule 8).

Plan prices and inclusions are configuration — a `plans` reference-table value read through the typed
accessor — never a code literal, so a Super Admin can change the price with no deploy. This scans the
TypeScript/TSX source of `apps/` and `packages/` for a currency-marked amount (₹ / Rs / INR next to
digits) or a numeric literal assigned to a price/fee/cost/commission/margin-named field, and fails the
build on a match. Comments are blanked first (a price in a comment is documentation, not a hard-coded
value), and the synthetic Prisma seed and test fixtures are excluded — they may carry sample amounts.
Usage: python3 docs/tools/scan_price_literals.py [--self-test].
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 2_000_000

INCLUDE_PREFIXES = ("apps/", "packages/")
INCLUDE_SUFFIXES = (".ts", ".tsx")
# The seed carries the synthetic Discovery price as DATA (data.md); tests/fixtures carry sample amounts;
# generated code, the design tokens (sizes/spacing, not money) and migrations (DDL) are not business code.
EXCLUDE_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", "-spec.ts", "-spec.tsx", ".d.ts")
EXCLUDE_SUBSTRINGS = (
    "/generated/",
    "/prisma/seed",
    "/prisma/migrations/",
    "packages/tokens/",
    "/test/",
    "/__fixtures__/",
    "/fixtures/",
    "/__mocks__/",
)

# ₹50000 · Rs 50,000 · Rs. 50000 · INR 50000. `Rs`/`INR` must be a whole word (so "RS256" and the like
# are not matched); `₹` is unambiguous. A currency code with no trailing amount (`"INR"`) does not match.
CURRENCY_AMOUNT = re.compile(
    r"(?:₹\s*|\b(?:Rs|INR)\b\.?\s*)[0-9][0-9,]*(?:\.[0-9]+)?", re.IGNORECASE
)
# A numeric literal assigned to a price/fee/cost/commission/margin-named field or variable (a reference
# such as `priceAmount: plan.priceAmount` is fine; a literal such as `price: 50000` is not).
PRICED_LITERAL = re.compile(
    r"\b(?:price|fee|cost|commission|margin|tariff)\w*\s*[:=]\s*[0-9][0-9_,.]*\b",
    re.IGNORECASE,
)


def _strip_comments(text: str) -> str:
    """Blank `//` and `/* */` comments, preserving newlines so line numbers stay correct."""

    def blank(match: re.Match[str]) -> str:
        return re.sub(r"[^\n]", " ", match.group(0))

    text = re.sub(r"/\*[\s\S]*?\*/", blank, text)
    return re.sub(r"//[^\n]*", blank, text)


def _tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "-z"], capture_output=True, check=True
    ).stdout
    return [p for p in out.decode().split("\0") if p]


def is_scanned(path: str) -> bool:
    if not path.startswith(INCLUDE_PREFIXES) or not path.endswith(INCLUDE_SUFFIXES):
        return False
    if path.endswith(EXCLUDE_SUFFIXES):
        return False
    return not any(sub in path for sub in EXCLUDE_SUBSTRINGS)


def findings_in(text: str) -> list[tuple[int, str]]:
    """(line, matched snippet) for every hard-coded price/fee in the code of `text` (comments blanked)."""
    code = _strip_comments(text)
    hits: list[tuple[int, str]] = []
    for pattern in (CURRENCY_AMOUNT, PRICED_LITERAL):
        for match in pattern.finditer(code):
            line = code.count("\n", 0, match.start()) + 1
            hits.append((line, match.group(0).strip()))
    return hits


def scan() -> int:
    findings: list[str] = []
    scanned = 0
    for path in _tracked_files():
        if not is_scanned(path):
            continue
        abspath = ROOT / path
        try:
            if abspath.stat().st_size > MAX_BYTES:
                continue
            text = abspath.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        scanned += 1
        for line, snippet in findings_in(text):
            findings.append(f"  {path}:{line}  {snippet}")
    if findings:
        print("scan_price_literals: hard-coded price/fee literals detected:", file=sys.stderr)
        for line in findings:
            print(line, file=sys.stderr)
        print(
            "\nPrices and fees are configuration (a `plans` row / configurations value) read through the\n"
            "typed accessor, never a code literal (AC-02.9/AC-25.4). Move the amount to the seed or a\n"
            "`plans` row; sample amounts belong only in the seed or test fixtures.",
            file=sys.stderr,
        )
        return 1
    print(f"scan_price_literals: clean ({scanned} source files scanned)")
    return 0


def self_test() -> int:
    assert findings_in('const p = "₹50000";'), "rupee-sign amount must be flagged"
    assert findings_in('const label = "Rs 50,000";'), "Rs amount in code must be flagged"
    assert findings_in("const x = { price: 50000 };"), "price literal must be flagged"
    assert findings_in("const commission = 2.5;"), "commission literal must be flagged"
    assert not findings_in("// costs Rs 50000 per month, price: 999"), "a price in a comment is fine"
    assert not findings_in('const alg = "RS256";'), "RS256 is not a currency amount"
    assert not findings_in("priceAmount: plan.priceAmount,"), "a price reference is fine"
    assert not findings_in("amountMinor: toClientMoney(plan.priceAmount).minor,"), "paise conversion is fine"
    assert not findings_in("const limit = 20; const windowMs = 60_000;"), "limits/timeouts are not prices"
    assert not findings_in('currency: z.literal("INR"),'), "a currency code with no amount is fine"
    assert is_scanned("apps/api/src/modules/crm/subscriptions/subscriptions.service.ts")
    assert not is_scanned("apps/api/prisma/seed.ts")
    assert not is_scanned("apps/api/test/subscriptions.e2e-spec.ts")
    assert not is_scanned("packages/core/src/schemas/payments.test.ts")
    assert not is_scanned("packages/tokens/src/spacing.ts")
    print("scan_price_literals self-test: ok")
    return 0


if __name__ == "__main__":
    sys.exit(self_test() if "--self-test" in sys.argv[1:] else scan())
