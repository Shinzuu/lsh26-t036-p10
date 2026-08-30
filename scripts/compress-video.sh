#!/usr/bin/env bash
# Demo-video helper. Trims to the official 60s maximum and compresses.
#   bash scripts/compress-video.sh input.mp4 output.mp4 [start-seconds]
# Records nothing — record with your phone or any screen recorder first.
set -euo pipefail
IN="${1:?usage: compress-video.sh in.mp4 out.mp4 [start]}"
OUT="${2:?output path required}"
START="${3:-0}"
ffmpeg -y -v error -ss "$START" -i "$IN" -t 60 \
  -c:v libx264 -crf 23 -preset fast -vf "scale='min(1920,iw)':-2" \
  -c:a aac -b:a 128k -movflags +faststart "$OUT"
ls -lh "$OUT"
echo "Duration check (official max 60s — brief/how-to-submit-28aug.md):"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUT"
