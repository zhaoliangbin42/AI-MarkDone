#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "Usage: $0 <chrome|firefox|safari>"
  exit 1
fi

if [[ "$target" == "chrome" ]]; then
  dist_dir="dist-chrome"
elif [[ "$target" == "firefox" ]]; then
  dist_dir="dist-firefox"
elif [[ "$target" == "safari" ]]; then
  dist_dir="dist-safari"
else
  echo "Unknown target: $target"
  exit 1
fi

classic_files=("$dist_dir/background.js" "$dist_dir/content.js" "$dist_dir/png-encoder-worker.js")
module_files=("$dist_dir/reader.js" "$dist_dir/content-features.js" "$dist_dir/export-renderer.js")
shopt -s nullglob
module_files+=("$dist_dir"/content-feature-chunks/*.js)
module_files+=("$dist_dir"/export-renderer-chunks/*.js)
shopt -u nullglob

if [[ "${#module_files[@]}" -lt 5 ]]; then
  echo "Missing lazy content or export renderer module graph in $dist_dir"
  exit 1
fi

for file in "${classic_files[@]}" "${module_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing entry file: $file"
    exit 1
  fi

  if ! node --input-type=commonjs -e 'const fs = require("node:fs"); const bytes = fs.readFileSync(process.argv[1]); const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); for (const char of text) { const cp = char.codePointAt(0); if ((cp >= 0xFDD0 && cp <= 0xFDEF) || (cp & 0xFFFF) === 0xFFFE || (cp & 0xFFFF) === 0xFFFF) throw new Error(`Unicode noncharacter U+${cp.toString(16).toUpperCase()}`); }' "$file"; then
    echo "Entry file contains encoding output that Chromium rejects as an extension script: $file"
    exit 1
  fi
done

for file in "${classic_files[@]}"; do

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

  if ! node --input-type=commonjs -e 'const fs = require("node:fs"); const vm = require("node:vm"); new vm.Script(fs.readFileSync(process.argv[1], "utf8"), { filename: process.argv[1] });' "$file"; then
    echo "Entry file is not valid as a classic extension script: $file"
    exit 1
  fi
done

for file in "${module_files[@]}"; do
  if ! node --input-type=module --check < "$file"; then
    echo "Entry file is not valid as an extension ES module: $file"
    exit 1
  fi
done

if ! node --input-type=module - "$dist_dir/content-features.js" <<'NODE'
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const featureModule = await import(pathToFileURL(resolve(process.argv[2])).href);
const required_exports = [
  'createReaderPanel',
  'createBookmarksPanel',
  'getSaveMessagesDialog',
  'getBookmarkSaveDialog',
  'copyMessagePng',
  'runFormulaAssetAction',
  'renderFormulaSvgAsset',
];
for (const name of required_exports) {
  if (typeof featureModule[name] !== "function") {
    throw new Error(`Missing callable content feature export: ${name}`);
  }
}
NODE
then
  echo "Lazy content feature facade exports are invalid in $dist_dir/content-features.js"
  exit 1
fi

echo "Entry format verification passed for $target."
