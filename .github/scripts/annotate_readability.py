"""Annotate CodeHygiene findings inside the added lines of a PR diff."""

import ast
import json
import os
import re
import subprocess
import sys
from pathlib import Path


def changed_ranges(base):
    patch = subprocess.check_output([
        "git", "-c", "core.quotePath=true", "diff", "--find-renames", "--no-color",
        "--no-prefix", "--unified=0", f"{base}...HEAD", "--", "src/", "scripts/",
    ])
    for section in re.split(rb"^diff --git ", patch, flags=re.M):
        header = re.search(rb"^\+\+\+ ([^\t\n]+)", section, re.M)
        if not header:
            continue
        path = header[1]
        if path.startswith(b'"'):  # Git uses C string escapes for unusual paths.
            path = ast.literal_eval("b" + path.decode("ascii"))
        hunks = re.findall(rb"^@@ -[\d,]+ \+(\d+)(?:,(\d+))? @@", section, re.M)
        ranges = [range(int(start), int(start) + int(count or 1)) for start, count in hunks]
        yield os.fsdecode(path), ranges


report = json.loads(sys.stdin.read() or "{}")
escape = str.maketrans({"%": "%25", "\r": "%0D", "\n": "%0A", ":": "%3A", ",": "%2C"})
for path, ranges in changed_ranges(sys.argv[1]):
    if Path(path).is_symlink():
        continue
    for finding in report.get(path, {}).get("squiggles", []):
        line = finding["line"]
        if any(line in added for added in ranges):
            print(f"::warning file={path.translate(escape)},line={line},title=CodeHygiene::"
                  f"{finding['kind']} — {finding['message']}")
