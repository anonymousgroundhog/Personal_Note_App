#!/bin/bash
# Generates docker-compose.override.yml with hardcoded host paths, then starts Docker.
set -e

# Get the real user's home directory regardless of sudo elevation.
# SUDO_USER is set when the script is run via sudo.
if [ -n "$SUDO_USER" ]; then
  REAL_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
else
  REAL_HOME="$HOME"
fi

echo "Real user home: $REAL_HOME"

# Detect notes directory
if [ -d "$REAL_HOME/Notes" ]; then
  NOTES="$REAL_HOME/Notes"
else
  NOTES="$REAL_HOME/Documents/Notes"
  mkdir -p "$NOTES"
fi

echo "Host paths:"
echo "  HOME:        $REAL_HOME"
echo "  Notes:       $NOTES"
echo "  Android platforms: baked into Docker image at /opt/android-sdk/platforms"
echo ""

# Write override file with literal paths — no variable expansion at runtime
cat > docker-compose.override.yml <<EOF
services:
  app:
    volumes:
      - $REAL_HOME:/root/host-home
      - $NOTES:/root/Notes
    environment:
      - HOST_HOME=$REAL_HOME
EOF

echo "Generated docker-compose.override.yml:"
cat docker-compose.override.yml
echo ""
echo "Starting Docker..."
echo ""
echo "Once the container is ready, open your browser to:"
echo "  http://localhost:5173"
echo ""
docker compose up --build
