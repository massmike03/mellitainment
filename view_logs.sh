#!/bin/bash
# Real-time log viewer for Mellitainment services

echo "📊 Mellitainment Real-time Logs"
echo "================================"
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 macOS detected - journalctl not available"
    echo ""
    echo "On Mac, logs appear directly in the terminal where you run each service:"
    echo ""
    echo "Terminal 1: cd backend && python3 app.py"
    echo "Terminal 2: cd backend && node carplay_server.mjs  ← CarPlay logs here"
    echo "Terminal 3: cd frontend && npm run dev"
    echo ""
    echo "💡 Tip: Use run_local.sh to start all services in one window"
    exit 0
fi

echo "Press Ctrl+C to exit"
echo ""

# Check if a specific service was requested
if [ "$1" == "backend" ]; then
    echo "Showing: Backend only"
    sudo journalctl -u infotainment-backend -f --no-pager
elif [ "$1" == "carplay" ]; then
    echo "Showing: CarPlay only"
    sudo journalctl -u infotainment-carplay -f --no-pager
elif [ "$1" == "frontend" ]; then
    echo "Showing: Frontend only"
    sudo journalctl -u infotainment-frontend -f --no-pager
else
    echo "Showing: All services"
    echo "Usage: ./view_logs.sh [backend|carplay|frontend]"
    echo ""
    # Show all three services, color-coded by identifier
    sudo journalctl -u infotainment-backend -u infotainment-carplay -u infotainment-frontend -f --no-pager
fi
