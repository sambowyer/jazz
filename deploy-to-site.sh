#!/usr/bin/env bash
# Copy the app into the personal-site repo (Jekyll). Run from ~/Documents/jazz.
#   ./deploy-to-site.sh [path-to-site-repo]
set -euo pipefail
SITE="${1:-$HOME/Documents/sambowyer.github.io}"
DEST="$SITE/jazz"
[ -d "$SITE" ] || { echo "Site repo not found at $SITE" >&2; exit 1; }
mkdir -p "$DEST"
rsync -av --delete \
  --exclude PLAN.md --exclude README.md --exclude CLAUDE.md \
  --exclude .claude --exclude .git --exclude .gitignore --exclude tests \
  --exclude deploy-to-site.sh --exclude lib/README.md \
  ./ "$DEST/"
# Cache-bust style.css / main.js with a timestamp.
V="$(date +%Y%m%d%H%M)"
sed -i -E "s/(style\.css|main\.js)\?v=[0-9]+/\1?v=$V/g" "$DEST/index.html"
echo "Copied to $DEST (v=$V) — now review, commit and push in the site repo."
