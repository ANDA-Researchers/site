#!/usr/bin/env bash

set -euo pipefail

port=4000
host_name="127.0.0.1"
skip_bundle_install=0
migrate_bundle_cache=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      port="${2:?missing value for --port}"
      shift 2
      ;;
    --host)
      host_name="${2:?missing value for --host}"
      shift 2
      ;;
    --skip-bundle-install)
      skip_bundle_install=1
      shift
      ;;
    --migrate-bundle-cache)
      migrate_bundle_cache=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--port PORT] [--host HOST] [--skip-bundle-install] [--migrate-bundle-cache]" >&2
      exit 1
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

cache_base="${XDG_CACHE_HOME:-$HOME/.cache}"
repo_hash="$(printf '%s' "$repo_root" | sha1sum | awk '{print substr($1, 1, 12)}')"
wsl_cache_root="${JEKYLL_WSL_CACHE_DIR:-$cache_base/jekyll-wsl/$repo_hash}"
default_bundle_path="$wsl_cache_root/vendor/bundle"
site_output_dir="${JEKYLL_OUTPUT_DIR:-$wsl_cache_root/_site}"
bundle_seed_source="$repo_root/vendor/bundle"
bundle_seed_stamp="$wsl_cache_root/.bundle-seed-complete"

sanitize_path() {
  local filtered=()
  local entry
  IFS=':' read -r -a path_entries <<<"$PATH"
  for entry in "${path_entries[@]}"; do
    [[ -z "$entry" ]] && continue
    case "$entry" in
      /mnt/c/Ruby*|/mnt/c/Users/*/AppData/Local/Microsoft/WindowsApps)
        continue
        ;;
    esac
    filtered+=("$entry")
  done
  (
    IFS=':'
    printf '%s' "${filtered[*]}"
  )
}

export PATH="$(sanitize_path)"
export BUNDLE_USER_HOME="${BUNDLE_USER_HOME:-$wsl_cache_root/.bundle-user}"
export BUNDLE_USER_CACHE="$BUNDLE_USER_HOME/cache"
export BUNDLE_USER_CONFIG="$BUNDLE_USER_HOME/config"
export BUNDLE_APP_CONFIG="${BUNDLE_APP_CONFIG:-$wsl_cache_root/.bundle}"

mkdir -p "$wsl_cache_root" "$BUNDLE_USER_CACHE" "$BUNDLE_APP_CONFIG" "$site_output_dir"

wsl_bundle_ready=0
if [[ -d "$default_bundle_path" && -f "$bundle_seed_stamp" ]]; then
  wsl_bundle_ready=1
fi

if [[ "$migrate_bundle_cache" -eq 1 && -d "$bundle_seed_source" ]]; then
  tmp_bundle_path="${default_bundle_path}.seed.$$"
  echo "Seeding WSL gem cache from $bundle_seed_source..."
  mkdir -p "$(dirname "$default_bundle_path")"
  rm -rf "$tmp_bundle_path"
  cp -a "$bundle_seed_source" "$tmp_bundle_path"
  rm -rf "$default_bundle_path"
  mv "$tmp_bundle_path" "$default_bundle_path"
  touch "$bundle_seed_stamp"
  wsl_bundle_ready=1
fi

if [[ -n "${BUNDLE_PATH:-}" ]]; then
  :
elif [[ "$wsl_bundle_ready" -eq 1 ]]; then
  export BUNDLE_PATH="$default_bundle_path"
elif [[ -d "$bundle_seed_source" ]]; then
  export BUNDLE_PATH="$bundle_seed_source"
else
  export BUNDLE_PATH="$default_bundle_path"
fi

if ! command -v ruby >/dev/null 2>&1; then
  echo "Ruby was not found in WSL." >&2
  echo "Install it with: sudo apt-get install -y ruby-full bundler build-essential zlib1g-dev" >&2
  exit 1
fi

if ! command -v bundle >/dev/null 2>&1; then
  echo "Bundler was not found in WSL." >&2
  echo "Install it with: sudo apt-get install -y bundler" >&2
  exit 1
fi

echo "Using Ruby at $(command -v ruby)"
ruby --version

echo "Using gem bundle at $BUNDLE_PATH"
echo "Using WSL build output at $site_output_dir"

if [[ "$skip_bundle_install" -ne 1 ]]; then
  if bundle check >/dev/null 2>&1; then
    echo "Project gems are already installed."
  else
    echo "Installing project gems..."
    bundle install
  fi
fi

site_url="http://localhost:${port}/site/"
if [[ "$repo_root" == /mnt/* ]]; then
  echo "Source files are staying on $repo_root."
  if [[ "$BUNDLE_PATH" == "$default_bundle_path" ]]; then
    echo "Gems and generated output are being kept in WSL storage to reduce /mnt/* filesystem overhead."
  else
    echo "Generated output is in WSL storage."
    echo "Run ./run_jekyll.sh --migrate-bundle-cache once if you want to copy gems into WSL storage too."
  fi
fi

echo "Starting Jekyll server..."
echo "Target URL: ${site_url}"
echo "The site is reachable only after Jekyll finishes its initial build."
echo "Press Ctrl+C to stop the server."
bundle exec jekyll serve --host "$host_name" --port "$port" --incremental --trace --destination "$site_output_dir"
