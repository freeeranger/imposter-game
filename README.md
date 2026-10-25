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

## License
The game is available under the GPL-v3.0 license.