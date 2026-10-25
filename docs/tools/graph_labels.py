#!/usr/bin/env python3
"""Carry the knowledge graph's community names over a rebuild.

    python3 docs/tools/graph_labels.py [--out labels.json]

`/graphify . --update` re-runs clustering, so community ids change and the skill's Step 5 asks for a labels dict for
the new communities. This maps each new community (graphify-out/.graphify_analysis.json) to the old name
(graphify-out/.graphify_labels.json, applied to the members of the previous graph) whose members overlap it most,
provided they make up at least half of the new community and the name is not a better fit for another community.
It writes the dict and prints the communities it could not name, with their most-connected members, so a session
names only those before running Step 5 with the written file.

The previous graph is read from graphify-out/.graphify_old.json (saved by the update flow) or, failing that, from
`git show HEAD:graphify-out/graph.json`.
"""
from __future__ import annotations

import argparse
import collections
import json
import subprocess
from pathlib import Path

OUT = Path("graphify-out")


def load_old_graph():
    p = OUT / ".graphify_old.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf8"))
    r = subprocess.run(["git", "show", "HEAD:graphify-out/graph.json"], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout else {"nodes": []}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="graphify-out/.graphify_labels.next.json")
    ap.add_argument("--min-share", type=float, default=0.5, help="share of a new community's nodes an old name must cover")
    a = ap.parse_args()
    analysis = json.loads((OUT / ".graphify_analysis.json").read_text(encoding="utf8"))
    old_labels = json.loads((OUT / ".graphify_labels.json").read_text(encoding="utf8")) if (OUT / ".graphify_labels.json").exists() else {}
    old_graph = load_old_graph()
    name_of = {}
    for n in old_graph.get("nodes", []):
        name = n.get("community_name") or old_labels.get(str(n.get("community")))
        if name and not str(name).startswith("Community "):
            name_of[n["id"]] = name
    new_graph = json.loads((OUT / "graph.json").read_text(encoding="utf8"))
    label_of = {n["id"]: n.get("label", n["id"]) for n in new_graph["nodes"]}
    degree = collections.Counter()
    for e in new_graph.get("links", []):
        degree[e["source"]] += 1
        degree[e["target"]] += 1

    candidates = {}  # new community -> (name, overlap count)
    for cid, members in analysis["communities"].items():
        counts = collections.Counter(name_of[m] for m in members if m in name_of)
        if counts:
            name, hits = counts.most_common(1)[0]
            if hits >= a.min_share * len(members):
                candidates[cid] = (name, hits)
    best_for_name = {}
    for cid, (name, hits) in candidates.items():
        if name not in best_for_name or hits > candidates[best_for_name[name]][1]:
            best_for_name[name] = cid
    labels = {cid: name for name, cid in best_for_name.items()}
    unmatched = [cid for cid in analysis["communities"] if cid not in labels]
    for cid in unmatched:
        labels[cid] = f"Community {cid}"
    Path(a.out).write_text(json.dumps(labels, indent=1, ensure_ascii=False), encoding="utf8")
    print(f"{len(labels) - len(unmatched)} of {len(labels)} communities named from the previous graph -> {a.out}")
    for cid in unmatched:
        members = analysis["communities"][cid]
        top = sorted(members, key=lambda m: -degree.get(m, 0))[:8]
        print(f"  unnamed [{cid}] n={len(members)}: " + " | ".join(str(label_of.get(m, m))[:50] for m in top))


if __name__ == "__main__":
    main()
