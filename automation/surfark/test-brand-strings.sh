#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Checks Surfark's branding step on the committed string files (git HEAD, copied to a temp folder):
# first Sideraven's brand-strings.py, then ours, as a release build does. The result must say Surfark,
# keep Mozilla's service names, and mention Sideraven only where we credit it. Run from the repo root.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

git ls-files 'app/src/*/res/values*/*strings.xml' | while read -r f; do
  mkdir -p "$work/$(dirname "$f")"
  git show "HEAD:$f" > "$work/$f"
done
english="$work/app/src/main/res/values/strings.xml"
ours="$work/app/src/main/res/values/sideraven_strings.xml"

python3 "$here/../sideraven/brand-strings.py" "$work"
python3 "$here/brand-strings.py" "$work"

fail() { echo "FAIL: $1" >&2; exit 1; }
value() { grep -o "<string name=\"$2\"[^>]*>[^<]*" "$1" | sed 's/.*>//'; }

grep -q "Surfark Labs" "$english" || fail "Firefox Labs did not become Surfark Labs"
grep -q "Firefox Sync" "$english" || fail "Firefox Sync was renamed"
[ "$(value "$ours" sideraven_settings_title)" = "Surfark" ] || fail "the settings entry does not say Surfark"
value "$english" about_content | grep -q "built on Sideraven and Firefox" || fail "the About line does not credit Sideraven"
value "$english" onboarding_term_of_service_line_three | grep -q "Surfark builds on Sideraven and Iceraven" || fail "the terms card does not credit Sideraven"
# Outside comments, Sideraven is named only in the credit strings.
left=$(python3 - "$work" <<'PY'
import pathlib, re, sys
root = pathlib.Path(sys.argv[1])
allowed = {"about_content", "onboarding_term_of_service_line_three", "onboarding_redesign_tou_body_three", "nova_onboarding_tou_body_line_3"}
bad = []
for p in sorted(root.glob("app/src/*/res/values*/*strings.xml")):
    if p.name == "static_strings.xml":
        continue  # app names: set in the repository itself, not by the branding step
    text = re.sub(r"<!--.*?-->", "", p.read_text(encoding="utf-8"), flags=re.S)
    for m in re.finditer(r'<string name="(\w+)"[^>]*>(.*?)</string>', text, re.S):
        if "Sideraven" in m.group(2) and m.group(1) not in allowed:
            bad.append(f"{p.relative_to(root)}:{m.group(1)}")
    rest = re.sub(r'<string name="\w+"[^>]*>.*?</string>', "", text, flags=re.S)
    if "Sideraven" in rest:
        bad.append(f"{p.relative_to(root)}:(outside a string)")
print("\n".join(bad[:10]))
PY
)
[ -z "$left" ] || fail "still says Sideraven: $left"
echo "surfark brand-strings: OK"
