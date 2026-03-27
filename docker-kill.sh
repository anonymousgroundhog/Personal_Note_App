#!/bin/bash
# Force-kills hanging Docker containers for this project.
# Handles the common case where a container was started under a different
# user context (e.g. with sudo) and can't be stopped normally.

set -e

PROJECT="personal_note_app"

echo "=== Docker Kill Script ==="
echo ""

# ── Step 1: Try graceful docker compose down ────────────────────────────────
echo "[1/4] Attempting graceful docker compose down..."
docker compose down 2>/dev/null && echo "      Done." || echo "      Failed (may need elevated permissions)."

# ── Step 2: Find all containers for this project ────────────────────────────
echo ""
echo "[2/4] Looking for containers matching '$PROJECT'..."

# Collect IDs from both the current user's docker and root's docker
CONTAINER_IDS=$(docker ps -a --filter "name=$PROJECT" --format "{{.ID}}" 2>/dev/null)
SUDO_CONTAINER_IDS=$(sudo docker ps -a --filter "name=$PROJECT" --format "{{.ID}}" 2>/dev/null || true)

# Combine and deduplicate
ALL_IDS=$(echo -e "$CONTAINER_IDS\n$SUDO_CONTAINER_IDS" | sort -u | grep -v '^$' || true)

if [ -z "$ALL_IDS" ]; then
  echo "      No containers found for '$PROJECT'."
else
  echo "      Found: $(echo $ALL_IDS | tr '\n' ' ')"
fi

# ── Step 3: Kill via host PID (the nuclear option) ──────────────────────────
echo ""
echo "[3/4] Killing container processes by host PID..."

KILLED=0
for ID in $ALL_IDS; do
  # Try user-level stop first
  docker stop "$ID" 2>/dev/null && echo "      Stopped $ID" && KILLED=$((KILLED+1)) && continue || true

  # Try sudo stop
  sudo docker stop "$ID" 2>/dev/null && echo "      Stopped $ID (via sudo)" && KILLED=$((KILLED+1)) && continue || true

  # Fall back to killing the host PID directly
  PID=$(sudo docker inspect "$ID" --format '{{.State.Pid}}' 2>/dev/null || true)
  if [ -n "$PID" ] && [ "$PID" != "0" ]; then
    echo "      Killing host PID $PID for container $ID..."
    sudo kill -9 "$PID" 2>/dev/null && KILLED=$((KILLED+1)) || echo "      WARNING: Could not kill PID $PID"
  else
    echo "      Could not determine PID for $ID — skipping."
  fi
done

# ── Step 4: Remove containers ────────────────────────────────────────────────
echo ""
echo "[4/4] Removing containers..."

for ID in $ALL_IDS; do
  docker rm -f "$ID" 2>/dev/null && echo "      Removed $ID" && continue || true
  sudo docker rm -f "$ID" 2>/dev/null && echo "      Removed $ID (via sudo)" || echo "      WARNING: Could not remove $ID"
done

# ── Final: Restart Docker daemon if anything is still stuck ─────────────────
REMAINING=$(sudo docker ps -a --filter "name=$PROJECT" --format "{{.ID}}" 2>/dev/null | grep -v '^$' || true)
if [ -n "$REMAINING" ]; then
  echo ""
  echo "WARNING: Some containers are still present: $REMAINING"
  echo "Restarting Docker daemon (stop socket + service) to clear them..."
  sudo systemctl stop docker docker.socket
  sudo systemctl start docker
  sleep 2
  sudo docker rm -f $REMAINING 2>/dev/null || true
  echo "Done."
fi

echo ""
echo "=== All done. Run ./docker-setup.sh to start fresh. ==="
