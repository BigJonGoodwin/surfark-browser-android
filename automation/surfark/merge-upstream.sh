#!/usr/bin/env bash
# Start a merge of the newest Sideraven into this fork, on its own branch.
#
#   automation/surfark/merge-upstream.sh
#
# Context (for whoever reads this next, person or AI):
# Surfark Browser follows Sideraven (github.com/Dweep4269/sideraven, branch main), which follows
# Iceraven and Firefox for Android. Firefox ships a new version about every two weeks, so run this at
# least that often: a build that falls behind on security fixes should not be used for logins.
#
# What it does: fetches upstream WITHOUT its tags (a pushed upstream tag would start a release here),
# makes a branch surfark/merge-upstream-<date> from origin/main, merges upstream into it and stops.
# It never pushes. Afterwards: fix conflicts if there are any (list-hooks.sh shows our lines), update
# automation/surfark/sideraven-base.txt to the Sideraven version just merged, run both
# test-brand-strings.sh scripts, push the branch and open a pull request so CI builds it.
set -euo pipefail
cd "$(dirname "$0")/../.."

UPSTREAM_URL="https://github.com/Dweep4269/sideraven"
if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree has changes. Commit or stash them first." >&2
  exit 1
fi
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"
git fetch --no-tags upstream main
git fetch --no-tags origin main

behind=$(git rev-list --count origin/main..upstream/main)
if [ "$behind" -eq 0 ]; then
  echo "Nothing to merge: origin/main already contains upstream/main."
  exit 0
fi
echo "Upstream has $behind new commit(s)."

branch="surfark/merge-upstream-$(date +%Y-%m-%d)"
git checkout -b "$branch" origin/main
if git merge --no-edit upstream/main; then
  echo "Merged cleanly on $branch."
else
  echo "Conflicts on $branch. Our hook lines:"
  ./automation/surfark/list-hooks.sh || true
  echo "Resolve them, then: git add -A && git commit"
  exit 2
fi
echo "Next: update automation/surfark/sideraven-base.txt, run the two test-brand-strings.sh scripts,"
echo "push the branch and open a pull request."
