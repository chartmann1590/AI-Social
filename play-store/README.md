# Play Store submission package — AI Social

Everything Google Play asks for is in this folder, organized so each Play Console field has exactly one file (or one folder) to point at.

When you open the Play Console listing for `com.anonymous.AISocial`, follow the checklist below. Every "→ filename" maps to a real file in this directory.

---

## Folder layout

```
play-store/
├── README.md                       # this file (the upload checklist)
├── listing/                        # all text copy
│   ├── title.txt                   # 30 chars max — Play "App name"
│   ├── short-description.txt       # 80 chars max — Play "Short description"
│   ├── full-description.txt        # 4000 chars max — Play "Full description"
│   ├── release-notes.txt           # 500 chars max — Play "What's new"
│   └── data-safety.md              # answers for the Data safety form
├── graphics/                       # visual assets
│   ├── icon-512.png                # 512×512 PNG — Play "App icon"
│   ├── icon-source.png             # 1024×1024 source for re-renders (do not upload)
│   ├── feature-graphic.png         # 1024×500 PNG — Play "Feature graphic"
│   └── _make_graphics.py           # regenerator script (do not upload)
├── screenshots/
│   ├── phone/                      # 7 PNGs, 1008×2244 — Play "Phone screenshots" (2–8 required)
│   │   ├── 01-welcome.png
│   │   ├── 02-feed.png
│   │   ├── 03-profile.png
│   │   ├── 04-post-detail.png
│   │   ├── 05-new-post.png
│   │   ├── 06-models.png
│   │   └── 07-settings.png
│   ├── tablet-7in/                 # 4 PNGs — Play "7-inch tablet screenshots" (recapture on real device before submit)
│   └── tablet-10in/                # 4 PNGs — Play "10-inch tablet screenshots" (recapture on real device before submit)
└── video/
    ├── promo.mp4                   # 30 s, 1080p, H.264 + AAC voiceover
    ├── voiceover.txt               # narration script (used by build-voiceover.sh)
    ├── voiceover.mp3               # rendered narration (used by build-slideshow.sh)
    ├── build-voiceover.sh          # renders voiceover.mp3 from voiceover.txt via edge-tts
    ├── build-slideshow.sh          # renders promo.mp4 (slideshow + voiceover) via ffmpeg
    ├── storyboard.md               # frame-by-frame plan
    └── font.ttf                    # caption font (Segoe UI Bold), used by build-slideshow.sh
```

---

## Play Console upload checklist

### Main store listing

| Play Console field          | Source file                                  |
|-----------------------------|----------------------------------------------|
| App name                    | `listing/title.txt`                          |
| Short description           | `listing/short-description.txt`              |
| Full description            | `listing/full-description.txt`               |
| App icon (512×512)          | `graphics/icon-512.png`                      |
| Feature graphic (1024×500)  | `graphics/feature-graphic.png`               |
| Promo video (YouTube URL)   | upload `video/promo.mp4` to YouTube, paste the URL here |
| Phone screenshots           | drag every PNG in `screenshots/phone/` (uploads in filename order) |
| 7-inch tablet screenshots   | drag every PNG in `screenshots/tablet-7in/`  |
| 10-inch tablet screenshots  | drag every PNG in `screenshots/tablet-10in/` |

### Release section

| Play Console field          | Source file                                  |
|-----------------------------|----------------------------------------------|
| App bundle (.aab)           | latest GitHub Release: <https://github.com/chartmann1590/AI-Social/releases/latest> (the CI workflow attaches `app-release.aab`) |
| Release notes               | `listing/release-notes.txt`                  |

### Data safety form

Open `listing/data-safety.md` and copy each answer into the corresponding Play Console question. The narrative there mirrors the [public privacy policy](https://chartmann1590.github.io/AI-Social/privacy-policy.html).

---

## Rebuilding the assets

### Promo video (slideshow + AI voiceover)

```bash
cd play-store/video
bash build-voiceover.sh   # writes voiceover.mp3 from voiceover.txt
bash build-slideshow.sh   # writes promo.mp4 (slideshow + muxed voiceover)
```

Voice defaults to `en-US-GuyNeural` at -8% rate. Override:
```bash
VOICE=en-US-AvaNeural RATE=-5% bash build-voiceover.sh
bash build-slideshow.sh
```

Requires: `pip install edge-tts` (already installed) and `ffmpeg` on PATH.

### Icon and feature graphic

```bash
cd play-store/graphics
python _make_graphics.py
```

Regenerates `icon-512.png` and `feature-graphic.png` from `icon-source.png`.

### Screenshots

Capture on a real device (1080×2400 recommended for phone), then drop the PNGs into `screenshots/phone/`. Tablet screenshots should be captured on real 7" and 10" tablets before final submission — the placeholders in `tablet-7in/` and `tablet-10in/` are emulator captures and not Play-quality.

---

## What still needs a human

- **YouTube upload of `promo.mp4`** — Play Console takes a YouTube URL, not a local file. Upload as Unlisted is fine.
- **Real tablet screenshots** — current ones are emulator-rendered.
- **Play Console account** with `com.anonymous.AISocial` registered and an internal-testing track set up.
- **Content rating questionnaire** — answer in the Play Console; not a static file.
