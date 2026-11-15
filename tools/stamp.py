#!/usr/bin/env python3
"""Stamp a fresh build id into index.html, css/style.css and js/app.js.

The three files must always be the same version. js/app.js compares them at
startup and, if a CDN or browser cache served a mix, clears the shell caches
and reloads once. Run this before every commit that touches the app files.
"""
import re, sys, time, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
bid = sys.argv[1] if len(sys.argv) > 1 else format(int(time.time()), "x")
edits = [
    ("index.html", r'(<meta name="build" content=")[^"]*(")'),
    ("css/style.css", r'(--build: ")[^"]*(")'),
    ("js/app.js", r'(const BUILD = ")[^"]*(")'),
]
for name, pat in edits:
    p = root / name
    s = p.read_text(encoding="utf-8")
    s2, n = re.subn(pat, lambda m: m.group(1) + bid + m.group(2), s, count=1)
    if n != 1:
        sys.exit(f"{name}: build marker not found")
    p.write_text(s2, encoding="utf-8")
print("build", bid)
