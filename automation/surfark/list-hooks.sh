#!/usr/bin/env bash
# List every Surfark hook in files that come from upstream (Sideraven/Iceraven/Fenix).
# Run after merging upstream to see where conflicts are likely and what to re-check.
cd "$(dirname "$0")/../.."
git grep -n "SURFARK-HOOK" -- . ':!automation/surfark' ':!docs/surfark'
