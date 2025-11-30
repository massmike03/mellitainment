#!/bin/bash
# Debug script for CarPlay connection

echo "🔍 Checking for Carlinkit Dongle (ID 1314)..."
if lsusb | grep -q "1314"; then
    echo "✅ Dongle found!"
    lsusb | grep "1314"
else
    echo "❌ Dongle NOT found. Please check USB connection."
    echo "   If plugged in, try a different port or cable."
    # Don't exit, maybe it's intermittent
fi

echo "🛑 Stopping background service..."
sudo systemctl stop infotainment-carplay

echo "🧹 Clearing temporary files..."
# Sometimes lock files persist? Unlikely for this lib.

# Function to cleanup and restart service on exit
cleanup() {
    echo ""
    echo "🛑 Debug session ended."
    echo "🔄 Restarting background service..."
    sudo systemctl start infotainment-carplay
    echo "✅ Service restarted."
}

# Trap Ctrl+C (SIGINT) and Exit (EXIT)
trap cleanup EXIT

echo "▶️ Starting CarPlay Server in foreground..."
echo "   (Press Ctrl+C to stop)"
echo ""

cd backend
# Enable debug logs for node-carplay
export DEBUG=node-carplay*
# Run the server
node carplay_server.mjs
