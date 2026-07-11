#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "Usage: $0 <chrome|firefox|safari>"
  exit 1
fi

if [[ "$target" == "chrome" ]]; then
  files=("dist-chrome/background.js" "dist-chrome/content.js" "dist-chrome/reader.js" "dist-chrome/formula-renderer.js")
elif [[ "$target" == "firefox" ]]; then
  files=("dist-firefox/background.js" "dist-firefox/content.js" "dist-firefox/reader.js" "dist-firefox/formula-renderer.js")
elif [[ "$target" == "safari" ]]; then
  files=("dist-safari/background.js" "dist-safari/content.js" "dist-safari/reader.js" "dist-safari/formula-renderer.js")
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

  if rg -n "__vitePreload\\(|\\bawait\\s+import\\s*\\(|\\bimport\\s*\\(\\s*['\\\"]\\./assets/" "$file" >/dev/null 2>&1; then
    echo "Entry file contains dynamic import (not allowed): $file"
    rg -n "__vitePreload\\(|\\bawait\\s+import\\s*\\(|\\bimport\\s*\\(\\s*['\\\"]\\./assets/" "$file" || true
    exit 1
  fi

  if ! node --input-type=commonjs -e 'const fs = require("node:fs"); const bytes = fs.readFileSync(process.argv[1]); const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); for (const char of text) { const cp = char.codePointAt(0); if ((cp >= 0xFDD0 && cp <= 0xFDEF) || (cp & 0xFFFF) === 0xFFFE || (cp & 0xFFFF) === 0xFFFF) throw new Error(`Unicode noncharacter U+${cp.toString(16).toUpperCase()}`); }' "$file"; then
    echo "Entry file contains encoding output that Chromium rejects as an extension script: $file"
    exit 1
  fi

  if ! node --input-type=commonjs -e 'const fs = require("node:fs"); const vm = require("node:vm"); new vm.Script(fs.readFileSync(process.argv[1], "utf8"), { filename: process.argv[1] });' "$file"; then
    echo "Entry file is not valid as a classic extension script: $file"
    exit 1
  fi
done

echo "Entry format verification passed for $target."
