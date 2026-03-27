#!/bin/sh
# Starts git-server and vite, forwards signals to both so the container stops cleanly.
set -e

node git-server.mjs &
GIT_PID=$!

npx vite &
VITE_PID=$!

# Forward SIGTERM and SIGINT to both child processes
trap 'kill $GIT_PID $VITE_PID 2>/dev/null; wait $GIT_PID $VITE_PID 2>/dev/null; exit 0' TERM INT

wait $GIT_PID $VITE_PID
