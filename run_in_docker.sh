#!/bin/bash
# Build and run the infotainment app in Docker

# Stop any existing containers to ensure only one runs
./stop_simulation.sh || true

echo "🏗️ Building Infotainment Image..."
docker build -t infotainment-sim -f Dockerfile.test .

echo "▶️ Running Infotainment App..."
echo "   Dashboard: http://localhost:5173"
echo "   Backend API: http://localhost:5001"
echo "   CarPlay Stream: http://localhost:5006"

# Run container in background and capture ID
CONTAINER_ID=$(docker run -d --rm \
  -p 5173:5173 \
  -p 5001:5001 \
  -p 5006:5006 \
  infotainment-sim)

echo "✅ Infotainment app started with Container ID: $CONTAINER_ID"

# Trap Ctrl+C to stop the specific container
cleanup() {
    echo ""
    echo "🛑 Stopping container $CONTAINER_ID..."
    docker stop "$CONTAINER_ID" >/dev/null
    exit 0
}
trap cleanup INT TERM

# Follow logs to keep script alive and show output
echo "📋 Following container logs (Press Ctrl+C to stop)..."
docker logs -f "$CONTAINER_ID"
