# Imposter game

A "lite schysstare" game for playing the imposter game. Supports multiple imposters, prank editions, different categories and more :).

The app is available both as a website (https://tjeneritz.se) and as android app ([download here](https://github.com/freeeranger/imposter-game/releases/latest/download/imposter.apk)).

## Technical stuff
The game is built in react, and the android app uses capacitor.

### Web dev
```zsh
bun i
bun run dev
```

### App dev
```zsh
bun run build
bunx cap sync android
./gradlew assembleDebug
```

### Releasing
- **Website:** deploys automatically from `main`. Every push to `main` goes live.
- **Android:** bump `version` in `package.json`, commit, then push a matching tag (e.g. `v1.2.1`). The tag runs the Android release workflow, which builds a signed APK and publishes it as a GitHub release; installed apps pick it up through the in-app updater.

## License
The game is available under the GPL-3.0 license.

TLDR: you can use, modify, and share the software freely. And if you distribute it or anything derived from it you have to release the full source code under GPL-3.0 too.