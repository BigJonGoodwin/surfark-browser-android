#!/usr/bin/env bash
# Prepare a fresh Sideraven checkout for building.
#
# Runs Iceraven's on-the-fly steps (patch the android-components submodule,
# glean venv, public-suffix list). These leave the tree dirty on purpose:
#   - android-components (submodule content)
#   - gradle/libs.versions.toml
#   - netwerk/ (untracked, listed in .git/info/exclude)
# Never commit those changes. Run once per checkout / after each rebase.
#
#   --release   also makes Fenix's strings say "Sideraven" (brand-strings.py; Iceraven's
#               CI does the same with "Iceraven"). Release builds only: it rewrites tracked files.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -f .sideraven-prepared ] && [ "${1:-}" != "--force" ] && [ "${1:-}" != "--release" ]; then
  echo "Already prepared (delete .sideraven-prepared or pass --force to redo)."
  exit 0
fi

# Iceraven's patch step is not idempotent: start from pristine upstream state.
git submodule update --init --depth 1
git -C android-components checkout -- . && git -C android-components clean -fdq
git checkout -- gradle/libs.versions.toml
rm -rf netwerk
./automation/iceraven/patch_android_components.sh
./automation/iceraven/setup_venv.sh

if [ ! -f local.properties ] && [ -n "${ANDROID_SDK_ROOT:-}" ]; then
  printf 'sdk.dir=%s\nautosignReleaseWithDebugKey=\n' "$ANDROID_SDK_ROOT" > local.properties
fi

if [ "${1:-}" = "--release" ]; then
  # Fenix's strings say Sideraven; Mozilla's service names and Sideraven's own strings stay.
  python3 automation/sideraven/brand-strings.py .
  # SURFARK-HOOK: then Sideraven's name becomes Surfark (see automation/surfark/brand-strings.py)
  python3 automation/surfark/brand-strings.py .
fi

touch .sideraven-prepared
echo "Prepared."
