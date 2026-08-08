#!/bin/sh
# Materializes JWT_PRIVATE_KEY/JWT_PUBLIC_KEY env var content into the file
# paths app/core/security.py reads from. Locally these paths are bind-mounted
# from shared/keys/ instead (see docker-compose.yml), so this is a no-op
# there. On Render there's no volume mount, so the keys travel as env vars.
#
# Expected to be base64 of the PEM (single line - immune to the newline/
# whitespace mangling that raw multi-line PEM suffers when pasted through a
# web text field). Falls back to writing the value verbatim if it doesn't
# decode as base64, so a raw PEM paste still works.
set -e

write_key() {
    value="$1"
    path="$2"
    [ -n "$value" ] || return 0
    mkdir -p "$(dirname "$path")"
    if ! printf '%s' "$value" | base64 -d > "$path" 2>/dev/null; then
        printf '%s' "$value" > "$path"
    fi
}

write_key "$JWT_PRIVATE_KEY" "$JWT_PRIVATE_KEY_PATH"
write_key "$JWT_PUBLIC_KEY" "$JWT_PUBLIC_KEY_PATH"

# $1 is the service's default port (baked into the Dockerfile's CMD); Render
# sets $PORT itself, so prefer that when present.
PORT="${PORT:-$1}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
