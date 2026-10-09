#!/bin/sh
# node_modules lives in a Docker volume that outlives image rebuilds, so it can fall
# behind package-lock.json. Reinstall whenever the lockfile changed since the last install.
set -e

stamp=node_modules/.package-lock.sha256
wanted=$(sha256sum package-lock.json | cut -d ' ' -f 1)

if [ "$(cat "$stamp" 2>/dev/null)" != "$wanted" ]; then
  echo "package-lock.json changed, installing dependencies..."
  npm install --no-audit --no-fund --ignore-scripts
  echo "$wanted" > "$stamp"
fi

exec "$@"
