# Signing key and releases

<!--
Context for whoever reads this next (person or AI):
- Written 2026-11-12, before any signing key existed. No release has been published yet.
- The release workflow is .github/workflows/sideraven-release.yml (Sideraven's file with a few
  SURFARK-HOOK lines). It refuses to publish anything unsigned.
- An AI session must never type the key's passwords into a web page or print them in a chat.
  Putting the four secrets into GitHub is J's step.
-->

## Why the key matters

Android only installs an update if it is signed with the same key as the installed app. If the key
or its password is lost, every device has to uninstall Surfark Browser (losing its data unless it
was backed up or synced) and install it fresh. So:

- There is exactly one release key for `app.surfark.browser`.
- It needs a backup outside GitHub. GitHub stores secrets write-only: they cannot be read back.
- The key can still be thrown away and replaced freely until the first signed build is installed
  on a real device.

## One-time setup

### 1. Create the key (on the laptop, in PowerShell)

Android Studio ships the tool. Its usual location is
`C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`.

```powershell
cd $HOME\Documents   # or wherever the key file should live; NOT inside a git repository
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v `
  -keystore surfark-release.jks -storetype PKCS12 `
  -alias surfark -keyalg RSA -keysize 4096 -validity 10000 `
  -dname "CN=Surfark Browser"
```

It asks for one password. Choose a long one and save it in the password manager straight away.
(With this file type the key's password is the same as the file's password.)

### 2. Back it up

Keep `surfark-release.jks` and its password in two places that are not this laptop's Downloads
folder, for example the password manager (as an attachment) and an encrypted drive.

### 3. Give GitHub the four secrets

Open https://github.com/BigJonGoodwin/surfark-browser-android/settings/secrets/actions and add
four repository secrets. The names keep Sideraven's prefix on purpose (see the workflow's header).

| Secret name | Value |
|---|---|
| `SIDERAVEN_KEYSTORE_BASE64` | the key file as text (command below copies it to the clipboard) |
| `SIDERAVEN_KEY_ALIAS` | `surfark` |
| `SIDERAVEN_KEYSTORE_PASSWORD` | the password from step 1 |
| `SIDERAVEN_KEY_PASSWORD` | the same password |

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\surfark-release.jks")) | Set-Clipboard
```

## Publishing a release

1. The change is merged into `main` and its CI build is green.
2. Optional: write `docs/surfark/changelog/<version>.md` (it becomes the release notes).
3. Push a version tag from `main`: `git tag v0.1.0 && git push origin v0.1.0`.
   Do not create the release in GitHub's web page first; the workflow creates it.
4. The "Sideraven release" workflow builds, signs and publishes
   `surfark-browser-<version>-arm64-v8a.apk` (and a 32-bit one) on the Releases page.

Version numbers are Surfark's own, starting at 0.1.0. Never push Sideraven's tags to this
repository: every `v*` tag starts a release.

## Installing on the Fold

In Obtainium, add the app with the source URL
`https://github.com/BigJonGoodwin/surfark-browser-android`. It picks up each new release.
The Galaxy Z Fold 6 uses the `arm64-v8a` file.
