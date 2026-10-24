# Imposter game

A "lite schysstare" website for playing imposter game. Supports multiple imposters, prank editions, different categories and more :).

Hosted on https://tjeneritz.se

## Android app

The same game ships as an Android app (Capacitor) with haptics, keep-awake during rounds and back-button support.

- Download: https://github.com/freeeranger/imposter-game/releases/latest/download/imposter.apk
- Release: bump `version` in `package.json`, commit, then push a matching tag (`git tag v1.2.0 && git push origin v1.2.0`). GitHub Actions builds a signed APK and publishes it as a release.
- Local build: `bun run build && bunx cap sync android`, then open `android/` in Android Studio or run `./gradlew assembleDebug` in it.
