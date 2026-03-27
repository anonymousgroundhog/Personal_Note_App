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

# Detect Android SDK
if [ -d "$REAL_HOME/Android/Sdk" ]; then
  SDK="$REAL_HOME/Android/Sdk"
elif [ -d "$REAL_HOME/Library/Android/sdk" ]; then
  SDK="$REAL_HOME/Library/Android/sdk"
elif [ -n "$ANDROID_HOME" ]; then
  SDK="$ANDROID_HOME"
else
  SDK="$REAL_HOME/Android/Sdk"
  echo "Warning: Android SDK not found at $SDK. APK analysis may not work."
fi

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
echo "  Android SDK: $SDK"
echo ""

# Write override file with literal paths — no variable expansion at runtime
cat > docker-compose.override.yml <<EOF
services:
  app:
    volumes:
      - $REAL_HOME:/root/host-home
      - $NOTES:/root/Notes
      - $SDK/platforms:/root/Android/Sdk/platforms
EOF

echo "Generated docker-compose.override.yml:"
cat docker-compose.override.yml
echo ""
echo "Starting Docker..."
docker compose up --build
