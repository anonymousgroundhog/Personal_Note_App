#!/bin/bash
# Starts git-server and vite in their own process groups so SIGTERM reaches all descendants.
set -e

# Start each process in its own process group (setsid) so we can kill the whole tree
setsid node git-server.mjs &
GIT_PID=$!

setsid npx vite &
VITE_PID=$!

_cleanup() {
  # Kill entire process groups, not just the direct child
  kill -- -"$GIT_PID"  2>/dev/null || kill "$GIT_PID"  2>/dev/null || true
  kill -- -"$VITE_PID" 2>/dev/null || kill "$VITE_PID" 2>/dev/null || true
  wait "$GIT_PID"  2>/dev/null || true
  wait "$VITE_PID" 2>/dev/null || true
  exit 0
}

trap _cleanup TERM INT

# wait -n exits when any child exits; loop keeps us alive until both are gone
while kill -0 "$GIT_PID" 2>/dev/null || kill -0 "$VITE_PID" 2>/dev/null; do
  wait -n 2>/dev/null || true
done
