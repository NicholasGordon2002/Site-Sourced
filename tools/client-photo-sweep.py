#!/usr/bin/env python3
"""Mutation sweep for the client-supplied photograph clauses.

Each row weakens one condition the new code guards, runs the new test file, and prints
pass/fail so a row that stays green names a condition with no test behind it. Every row is
reversed with `git checkout -- <file>` and the file's sha256 is compared before and after.
"""
import hashlib
import pathlib
import re
import subprocess

REPO = pathlib.Path("/home/team/shared/pipeline")
TEST = "test/client-photo.test.ts"

ROWS = [
    (
        "1 licence kind accepted (images.ts)",
        "src/demo/images.ts",
        '  if (low.startsWith("client-supplied")) return "client-supplied";',
        '  if (false) return "client-supplied";',
    ),
    (
        "2 demonstration refused by name (build.ts)",
        "src/demo/build.ts",
        '    if (phase !== "business") {',
        "    if (false) {",
    ),
    (
        "3 author must be recorded (build.ts)",
        "src/demo/build.ts",
        '    if (author === "" || /^(unknown|n\\/a|unattributed)$/i.test(author)) {',
        "    if (false) {",
    ),
    (
        "4 credit must be on the page that shows the picture (build.ts)",
        "src/demo/build.ts",
        "      if (!page.html.includes(esc(credit))) {",
        "      if (false) {",
    ),
    (
        "5 no credit on a page that shows no such picture (build.ts)",
        "src/demo/build.ts",
        "    if (shown.length === 0) {",
        "    if (false) {",
    ),
    (
        "6 the page prints the credit (render.ts)",
        "src/demo/render.ts",
        "  if (isClientSuppliedImage(image)) return clientPhotoCredit(businessName, image.author);",
        "",
    ),
    (
        "7 the README stops calling the client's picture stock (render.ts)",
        "src/demo/render.ts",
        '  const clientHero = images.some((i) => i.role === "hero" && isClientSuppliedImage(i));',
        "  const clientHero = false;",
    ),
    (
        "8 a licence the build cannot place is refused (images.ts)",
        "src/demo/images.ts",
        '  throw new Error(\n    `image ${image.file} declares licence "${image.license}" — only CC0, public domain, a labelled AI-generated fallback, or a client-supplied photograph may be used.`,',
        '  if (false) throw new Error(\n    `image ${image.file} declares licence "${image.license}" — only CC0, public domain, a labelled AI-generated fallback, or a client-supplied photograph may be used.`,',
    ),
]


def sha(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run() -> tuple[int, int, str]:
    r = subprocess.run(["bun", "test", TEST], cwd=REPO, capture_output=True, text=True)
    out = r.stdout + r.stderr
    m_pass = re.search(r"^\s*(\d+) pass$", out, re.M)
    m_fail = re.search(r"^\s*(\d+) fail$", out, re.M)
    first = re.search(r"^\(fail\) (.+?)(?: \[|$)", out, re.M)
    return (
        int(m_pass.group(1)) if m_pass else -1,
        int(m_fail.group(1)) if m_fail else -1,
        first.group(1) if first else "(none)",
    )


print("baseline:", run(), flush=True)
for name, rel, old, new in ROWS:
    p = REPO / rel
    before = sha(p)
    s = p.read_text()
    n = s.count(old)
    if n != 1:
        print(f"{name} :: INVALID — {n} occurrences of the anchor in {rel}", flush=True)
        continue
    p.write_text(s.replace(old, new))
    mutated = sha(p)
    if mutated == before:
        print(f"{name} :: INVALID — mutation left the file byte-identical", flush=True)
        subprocess.run(["git", "checkout", "--", rel], cwd=REPO)
        continue
    p_pass, p_fail, first = run()
    subprocess.run(["git", "checkout", "--", rel], cwd=REPO)
    restored = sha(p)
    verdict = "RESTORED" if restored == before else "NOT RESTORED"
    print(f"{name} :: {p_pass} pass / {p_fail} fail :: (fail) {first} :: {verdict}", flush=True)
