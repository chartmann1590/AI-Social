# AISocial — Play Store submission package

This folder contains everything needed for a Google Play listing for `com.anonymous.AISocial`.

## Layout

```
play-store/
├── listing/
│   ├── title.txt                  # 30 chars max — "AISocial — On-device AI Feed"
│   ├── short-description.txt      # 80 chars max
│   ├── full-description.txt       # 4000 chars max
│   ├── release-notes.txt          # 500 chars max
│   └── data-safety.md             # Inputs for the Play Console Data Safety form
├── graphics/
│   ├── icon-512.png               # 512×512 app icon (Play listing)
│   ├── icon-source.png            # 1024×1024 source
│   └── feature-graphic.png        # 1024×500 Play feature graphic
├── screenshots/
│   ├── phone/                     # 1080×2400 (current device), ≥2, ≤8
│   ├── tablet-7in/                # 1200×1920 simulated — redo on a real 7" device
│   └── tablet-10in/               # 1600×2560 simulated — redo on a real 10" device
└── video/
    ├── storyboard.md              # frame-by-frame plan for a 30 s promo video
    └── build-slideshow.sh         # ffmpeg script that renders a Ken-Burns slideshow
                                    # from the phone screenshots as a promo placeholder
```

## Build & upload checklist

1. Bump `versionCode` in `android/app/build.gradle` and `expo.android.versionCode` in `app.json`.
2. Replace the debug signing config in `android/app/build.gradle` with a release keystore before first upload (current APK is signed with the debug key and Play will reject it).
3. Build an App Bundle: `cd android && ./gradlew bundleRelease` (output: `app/build/outputs/bundle/release/app-release.aab`).
4. Upload the `.aab` to Play Console → Production (or Internal testing first).
5. Fill the listing using the files in `listing/` and attach the graphics + screenshots below.
6. The Data Safety form: paste values from `listing/data-safety.md`.

## What still needs a human

- A real upload keystore (never commit this file).
- Tablet screenshots taken on actual 7" and 10" tablets.
- A designer-produced promo video. The included slideshow is a placeholder.
- Play Console account with the app created and the Play signing key enrolled.
