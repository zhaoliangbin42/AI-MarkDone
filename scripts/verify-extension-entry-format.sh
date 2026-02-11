#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "Usage: $0 <chrome|firefox>"
  exit 1
fi

if [[ "$target" == "chrome" ]]; then
  files=("dist-chrome/background.js" "dist-chrome/content.js")
elif [[ "$target" == "firefox" ]]; then
  files=("dist-firefox/background.js" "dist-firefox/content.js")
else
  echo "Unknown target: $target"
  exit 1
fi

for file in "${files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing entry file: $file"
    exit 1
  fi

  if rg -n "^import " "$file" >/dev/null 2>&1; then
    echo "Entry file contains top-level import (not allowed): $file"
    rg -n "^import " "$file" || true
    exit 1
  fi
done

echo "Entry format verification passed for $target."
