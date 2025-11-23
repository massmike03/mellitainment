#!/usr/bin/env bash
# -------------------------------------------------
# stop_simulation.sh – stop any previously‑running Docker containers
# that were started from the infotainment-sim image.
# -------------------------------------------------

set -e

# Find running containers based on the image name "infotainment-sim"
containers=$(docker ps -q --filter "ancestor=infotainment-sim")

if [ -z "$containers" ]; then
    echo "ℹ️ No running infotainment-sim containers found."
    exit 0
fi

echo "🛑 Stopping existing infotainment-sim containers..."
docker stop $containers

echo "✅ Stopped containers: $containers"
