#!/usr/bin/env bash

set -euo pipefail

port=4000
host_name="127.0.0.1"
skip_bundle_install=0

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
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--port PORT] [--host HOST] [--skip-bundle-install]" >&2
      exit 1
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

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
export BUNDLE_USER_HOME="$repo_root/.bundle-user"
export BUNDLE_USER_CACHE="$BUNDLE_USER_HOME/cache"
export BUNDLE_USER_CONFIG="$BUNDLE_USER_HOME/config"
export BUNDLE_APP_CONFIG="$repo_root/.bundle"

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

echo "Configuring Bundler to keep gems inside the project..."
bundle config set --local path vendor/bundle >/dev/null

if [[ "$skip_bundle_install" -ne 1 ]]; then
  echo "Installing project gems..."
  bundle install
fi

site_url="http://localhost:${port}/site/"
echo "Starting Jekyll server..."
echo "Site URL: ${site_url}"
echo "Press Ctrl+C to stop the server."
bundle exec jekyll serve --host "$host_name" --port "$port" --verbose --trace
