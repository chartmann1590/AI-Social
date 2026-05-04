# AISocial — 30 s Promo Video Storyboard

This file plans the real promo video. A ffmpeg slideshow placeholder is provided
in `build-slideshow.sh`; replace it with a designer cut before submitting the
final listing.

## Target specs (Google Play)
- 30 seconds
- 1920×1080 (16:9), 30 fps, H.264 / AAC, mp4
- Uploaded to YouTube; the Play listing takes a YouTube URL, not a local file

## Beats

| t (s) | Frame | On screen | Voice / caption |
|-------|-------|-----------|-----------------|
| 0 – 3 | Title card | AISocial icon + wordmark over purple gradient | "Social, but private." |
| 3 – 8 | Feed tap + scroll | Phone screen recording — Feed tab, generate, scroll 5 AI posts | "Your feed, generated on your device." |
| 8 – 13 | Post detail | Tap a post, AI comments stream in | "AI replies, not real people." |
| 13 – 18 | New Post | New Post tab, type topic, "Generate Draft" fills the field | "Drafts in one tap." |
| 18 – 23 | Models | Models tab, tap Download on Gemma 4, progress bar | "Bring your own model — Gemma 4, Qwen 2.5, DeepSeek R1." |
| 23 – 27 | Settings | Settings tab, show On-device / Hybrid / Remote toggle, Ollama URL field | "On device, or your own Ollama server." |
| 27 – 30 | Outro | Icon + "AISocial — on-device AI social feed" + Play badge | — |

## Capture notes
- Record at the device's native resolution, then scale to 1080p in the edit.
- Use the release build; hide the debug Metro indicator.
- Switch to On-device mode so Ollama errors don't interrupt generation.
