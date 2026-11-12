# Surfark Browser (Android): fork notes

<!--
Context for whoever reads this next (person or AI):
- This repository is J's fork of Sideraven (github.com/Dweep4269/sideraven), which is a fork of
  Iceraven, which is a fork of Firefox for Android. It is one half of a pair; the other half is
  github.com/BigJonGoodwin/surfark-browser-desktop (a fork of Zen).
- The overall plan lives outside this repo for now, at ClaudeProject/surfark-browser/docs/PLAN.md
  on J's laptop. This file records what has actually been changed in this fork and why.
- Add a dated entry below for every non-trivial change.
-->

## Rules for changes in this fork

- Our own code and scripts live in their own folders: `automation/surfark/`, `docs/surfark/`,
  later a Kotlin package of our own. Upstream files only get short hook lines.
- Every line we add to or change in an upstream file carries the marker `SURFARK-HOOK`.
  `automation/surfark/list-hooks.sh` lists them all; run it after merging upstream.
- Sideraven marks its own changes to Iceraven/Fenix files with `SIDERAVEN-HOOK`. Leave those
  markers and comments in place; where we change a hooked line, we add our marker next to theirs.
- Upstream is merged regularly (Firefox ships a new version about every two weeks). A build that
  falls behind on security fixes should not be used for logins.

## Change log

### 2026-11-12: Surfark Companion 0.1.0, the shared extension (branch `surfark/companion-extension`)

New folder `surfark-extension/`: the WebExtension both browsers will share. Version 0.1.0 saves a
page to markdown notes, saves a one-file snapshot, and has its own reader view. See
`surfark-extension/README.md` for what it does, how it is built and its limits. CI for it is
`.github/workflows/surfark-extension.yml`.

It is not bundled into the app yet and touches no upstream file. Its logic is unit-tested (32
tests); it has not been run in a real browser yet.

### 2026-11-12: release pipeline and upstream-merge routine (branch `surfark/release-pipeline`)

- `.github/workflows/sideraven-release.yml` now publishes Surfark Browser: files are named
  `surfark-browser-<version>-<abi>.apk`, the release title and notes say Surfark Browser and name
  the Sideraven version it is built on (`automation/surfark/sideraven-base.txt`), release notes
  come from `docs/surfark/changelog/<version>.md`, and the release is created in this repository
  even though it is a fork. Secret names are unchanged.
- `docs/surfark/signing.md`: how the signing key is created, backed up and given to GitHub, and
  how a release is published and installed. No key exists yet, so nothing has been released.
- `automation/surfark/merge-upstream.sh`: starts a merge of the newest Sideraven on its own
  branch, without upstream's tags.
- Versions are Surfark's own, starting at 0.1.0.

Not verified: the release workflow has not run in this fork, because it needs the signing
secrets. Expect to fix small things on the first real release.

### 2026-11-11: renamed to Surfark Browser (branch `surfark/rename`)

Based on Sideraven 1.2.0 (commit 360d05c), unchanged apart from the following.

| What | Where | Was | Now |
|---|---|---|---|
| App ID (release) | `app/build.gradle` | `app.sideraven.browser` | `app.surfark.browser` |
| App ID (debug) | `app/build.gradle` | `app.sideraven.browser.debug` | `app.surfark.browser.debug` |
| Shared user ID | `app/build.gradle` | `app.sideraven.browser.sharedID` | `app.surfark.browser.sharedID` |
| Link scheme | `app/build.gradle` | `sideraven`, `sideraven-debug` | `surfark`, `surfark-debug` |
| Launcher shortcuts' target | `app/src/fork*/res/xml/shortcuts.xml` | Sideraven's IDs | Surfark's IDs |
| Benchmark target | `benchmark/.../SideravenJourneys.kt` | `app.sideraven.browser` | `app.surfark.browser` |
| App name (release) | `app/src/forkRelease/res/values/static_strings.xml` | Sideraven | Surfark Browser |
| App name (debug) | `app/src/main/res/values/static_strings.xml` | Sideraven Dev | Surfark Dev |

Why the IDs changed: with its own app ID, Surfark Browser installs next to Sideraven instead of
replacing it, and the two never share data. The ID must not change again once a signed build is
installed on a device, because Android treats a new ID as a different app.

Text inside the app: `automation/surfark/brand-strings.py` runs after Sideraven's branding step
in release builds (hook in `automation/sideraven/prepare.sh`) and turns "Sideraven" into "Surfark".
The About text and the terms card keep crediting Sideraven by name.
`automation/surfark/test-brand-strings.sh` checks this and runs in CI (hook in
`.github/workflows/sideraven-ci.yml`). Debug builds are not branded, the same as in Sideraven, so
a debug build still says "Firefox" and "Sideraven" in places. That is expected.

Not changed yet, on purpose:
- The app icon and the icon picker still show Sideraven's artwork.
- (Done on 2026-11-12, see above: the release workflow now names files and titles Surfark Browser.
  It still expects signing secrets named `SIDERAVEN_*`, and no signing key exists yet.)
- Kotlin package names (`pt.dweep.sideraven`) stay as they are; renaming them would make every
  upstream merge conflict.
- The README below our notice is still Sideraven's.
