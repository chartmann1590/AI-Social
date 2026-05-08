#!/usr/bin/env bash
# Render voiceover.mp3 from voiceover.txt using edge-tts (Microsoft Edge's free
# neural TTS — no API key required). Output is mono 24kHz MP3 sized to the
# 30-second slideshow.
#
# Requires: pip install edge-tts (already a one-time setup).
set -euo pipefail
cd "$(dirname "$0")"

VOICE="${VOICE:-en-US-GuyNeural}"
RATE="${RATE:--8%}"   # slightly slower so it fits cleanly in 28s
SCRIPT="voiceover.txt"
OUT_RAW="voiceover.raw.mp3"
OUT="voiceover.mp3"

if [ ! -f "$SCRIPT" ]; then
  echo "::error::$SCRIPT not found"
  exit 1
fi

# edge-tts reads stdin via --text; --rate slows or speeds the delivery.
edge-tts --voice "$VOICE" --rate="$RATE" --file "$SCRIPT" --write-media "$OUT_RAW"

# Normalize loudness and pad to ~28.5s so audio ends slightly before the 30s
# video (avoids a hard cut on the last word).
ffmpeg -y -loglevel error \
  -i "$OUT_RAW" \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=28.5" \
  -t 28.5 \
  -c:a libmp3lame -b:a 128k \
  "$OUT"

rm -f "$OUT_RAW"
echo "wrote $OUT (voice=$VOICE, rate=$RATE)"
