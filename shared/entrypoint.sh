#!/bin/sh
# Materializes JWT_PRIVATE_KEY/JWT_PUBLIC_KEY env var content (PEM text) into
# the file paths app/core/security.py reads from. Locally these paths are
# bind-mounted from shared/keys/ instead (see docker-compose.yml), so this is
# a no-op there. On Render there's no volume mount, so the keys travel as
# multi-line env vars and get written to disk here before the app starts.
set -e

if [ -n "$JWT_PRIVATE_KEY" ]; then
    mkdir -p "$(dirname "$JWT_PRIVATE_KEY_PATH")"
    printf '%s' "$JWT_PRIVATE_KEY" > "$JWT_PRIVATE_KEY_PATH"
fi

if [ -n "$JWT_PUBLIC_KEY" ]; then
    mkdir -p "$(dirname "$JWT_PUBLIC_KEY_PATH")"
    printf '%s' "$JWT_PUBLIC_KEY" > "$JWT_PUBLIC_KEY_PATH"
fi

# $1 is the service's default port (baked into the Dockerfile's CMD); Render
# sets $PORT itself, so prefer that when present.
PORT="${PORT:-$1}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
