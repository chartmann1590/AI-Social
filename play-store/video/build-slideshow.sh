#!/usr/bin/env bash
# 30 s Play Store promo video. Renders six 5 s slides with a caption overlay,
# then concatenates with xfade crossfades. Uses phone screenshots as source.
#
# Output: promo.mp4 (1920x1080, 30 fps, H.264 + silent AAC track)
set -euo pipefail
cd "$(dirname "$0")"

SHOTS_DIR="../screenshots/phone"
OUT="promo.mp4"
# Copy the font into a colon-free path so ffmpeg's drawtext filter parses it
# (drawtext treats ':' as an option separator and escaping varies by shell).
cp -f "/c/Windows/Fonts/segoeuib.ttf" "./font.ttf"
FF_FONT="font.ttf"
W=1920
H=1080
BG="0x170A34"   # top of the app's purple gradient

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# slide: src_png caption subcaption out_mp4
slide() {
  local SRC="$1" CAP="$2" SUB="$3" OUT_SEG="$4"
  ffmpeg -y -loglevel error \
    -loop 1 -t 5 -i "$SRC" \
    -f lavfi -t 5 -i "color=c=${BG}:s=${W}x${H}" \
    -filter_complex "\
[0:v]scale=-1:${H}*0.78:force_original_aspect_ratio=decrease[shot]; \
[1:v][shot]overlay=(W-w)/2:120[base]; \
[base]drawtext=fontfile='${FF_FONT}':text='${CAP}':fontsize=62:fontcolor=white:x=(w-text_w)/2:y=h-180:shadowcolor=black:shadowx=2:shadowy=2[cap1]; \
[cap1]drawtext=fontfile='${FF_FONT}':text='${SUB}':fontsize=32:fontcolor=0xB296E4:x=(w-text_w)/2:y=h-110[final]" \
    -map "[final]" \
    -c:v libx264 -pix_fmt yuv420p -r 30 -crf 20 -preset medium -t 5 \
    "$OUT_SEG"
}

slide "$SHOTS_DIR/01-feed.png" "AISocial"              "On-device AI social feed"             "$tmpdir/s1.mp4"
slide "$SHOTS_DIR/01-feed.png" "Your feed, generated"  "Posts by AI, right on your phone"     "$tmpdir/s2.mp4"
slide "$SHOTS_DIR/02-post-detail.png" "AI replies"     "Comments run locally, in real time"   "$tmpdir/s3.mp4"
slide "$SHOTS_DIR/03-new-post.png" "Drafts in one tap" "Type a topic. Let the model write it." "$tmpdir/s4.mp4"
slide "$SHOTS_DIR/04-models.png" "Bring your own model" "Gemma 4 | Qwen 2.5 | DeepSeek R1"    "$tmpdir/s5.mp4"
slide "$SHOTS_DIR/05-settings.png" "On-device or remote" "Private by default. Your Ollama optional." "$tmpdir/s6.mp4"

# Concat with 0.5 s xfade crossfades. Each clip is 5 s, overlap 0.5 s -> total 5 + 5*(5-0.5) = 27.5 s.
# Pad the last clip to land on 30 s.
ffmpeg -y -loglevel error \
  -i "$tmpdir/s1.mp4" -i "$tmpdir/s2.mp4" -i "$tmpdir/s3.mp4" \
  -i "$tmpdir/s4.mp4" -i "$tmpdir/s5.mp4" -i "$tmpdir/s6.mp4" \
  -f lavfi -t 30 -i "anullsrc=channel_layout=stereo:sample_rate=44100" \
  -filter_complex "\
[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.5[v01]; \
[v01][2:v]xfade=transition=fade:duration=0.5:offset=9.0[v012]; \
[v012][3:v]xfade=transition=fade:duration=0.5:offset=13.5[v0123]; \
[v0123][4:v]xfade=transition=fade:duration=0.5:offset=18.0[v01234]; \
[v01234][5:v]xfade=transition=fade:duration=0.5:offset=22.5[vmix]; \
[vmix]tpad=stop_mode=clone:stop_duration=2.5,trim=duration=30[vout]" \
  -map "[vout]" -map 6:a \
  -c:v libx264 -pix_fmt yuv420p -r 30 -crf 20 -preset medium \
  -c:a aac -b:a 128k -shortest \
  "$OUT"

echo "wrote $OUT"
