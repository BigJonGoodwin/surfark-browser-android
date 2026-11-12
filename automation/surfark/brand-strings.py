#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""Makes the release strings say Surfark, after Sideraven's own branding step has run.

    automation/surfark/brand-strings.py [repo-root]

Context (for whoever reads this next, person or AI):
Surfark Browser is a fork of Sideraven. Sideraven's automation/sideraven/brand-strings.py turns
Fenix's "Firefox" into "Sideraven" at release build time and leaves the repository's strings alone,
so upstream updates merge cleanly. This script does the same one level up: it runs right after
Sideraven's script (see the SURFARK-HOOK in automation/sideraven/prepare.sh) and turns "Sideraven"
into "Surfark" in every strings.xml and in Sideraven's own sideraven_strings.xml.

Why a second script instead of editing Sideraven's: their file changes upstream, ours never
conflicts with it. Nothing in the repository's string files is rewritten by a commit.

What stays: XML comments, resource names (they are lower-case `sideraven_...`), Mozilla's service
names (Sideraven's script already kept those), and two strings that credit Sideraven by name.
Run only on a checkout that builds a release: it rewrites tracked files.
"""
import pathlib
import re
import sys

OLD, NEW = "Sideraven", "Surfark"

# Strings that must keep crediting Sideraven: given our own wording after the swap.
OVERRIDES = {
    "about_content": "%1$s is an independent browser built on Sideraven and Firefox for Android. "
                     "It isn’t made by Mozilla or by Sideraven’s developers.",
    "onboarding_term_of_service_line_three": "Surfark builds on Sideraven and Iceraven. Iceraven removes Firefox’s data collection as far as it can. %1$s",
    "onboarding_redesign_tou_body_three": "Surfark builds on Sideraven and Iceraven. Iceraven removes Firefox’s data collection as far as it can. %1$s",
    "nova_onboarding_tou_body_line_3": "Surfark builds on Sideraven and Iceraven. Iceraven removes Firefox’s data collection as far as it can. %1$s",
}
COMMENT = re.compile(r"(<!--.*?-->)", re.S)
STRING = re.compile(r'(<string name="(\w+)"[^>]*>)(.*?)(</string>)', re.S)


def brand(text: str) -> str:
    # Comments are left as they are; everything else (string bodies, plural items) is swapped.
    parts = COMMENT.split(text)
    for i in range(0, len(parts), 2):
        parts[i] = parts[i].replace(OLD, NEW)
        parts[i] = STRING.sub(
            lambda m: m.group(1) + OVERRIDES[m.group(2)] + m.group(4) if m.group(2) in OVERRIDES else m.group(0),
            parts[i],
        )
    return "".join(parts)


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    found = sorted(root.glob("app/src/*/res/values*/strings.xml"))
    found += sorted(root.glob("app/src/*/res/values*/sideraven_strings.xml"))
    if not found:
        print(f"no string files under {root}/app/src", file=sys.stderr)
        return 1
    changed = 0
    for path in found:
        text = path.read_text(encoding="utf-8")
        branded = brand(text)
        if branded != text:
            path.write_text(branded, encoding="utf-8")
            changed += 1
    print(f"surfark brand-strings: {changed} of {len(found)} string files now say {NEW}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
