#!/bin/bash
# Local Development Runner for Mellitainment
# This script starts all services needed for local development

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "🚗 Mellitainment Local Development Setup"
echo "========================================"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20 or higher."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ Prerequisites met"

# Function to clean up ports
cleanup_ports() {
    local ports=("5001" "5006" "5173")
    echo "🧹 Cleaning up ports: ${ports[*]}..."
    for port in "${ports[@]}"; do
        # Find PID using lsof (if available) or netstat/ss could be alternatives, but lsof is standard on Mac
        if command -v lsof >/dev/null; then
            pid=$(lsof -ti:$port 2>/dev/null || true)
            if [ -n "$pid" ]; then
                echo "   Killing process $pid on port $port"
                kill -9 $pid 2>/dev/null || true
            fi
        fi
    done
}

cleanup_ports

# Setup Backend
echo ""
echo "🐍 Setting up Backend..."
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment and installing dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt

if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies for CarPlay..."
    npm install
fi

echo "✅ Backend setup complete"

# Setup Frontend
echo ""
echo "⚛️  Setting up Frontend..."
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "✅ Frontend setup complete"

# Start services
echo ""
echo "🚀 Starting services..."
echo ""
echo "Services will be available at:"
echo "  - Frontend:  http://localhost:5173"
echo "  - Backend:   http://localhost:5001"
echo "  - CarPlay:   http://localhost:5006"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Trap to kill all background processes on exit
trap 'echo ""; echo "🛑 Stopping all services..."; kill $(jobs -p) 2>/dev/null; exit' INT TERM

# Start Backend
cd "$BACKEND_DIR"
source venv/bin/activate
echo "Starting Backend (Flask)..."
python3 app.py > /tmp/mellitainment-backend.log 2>&1 &
BACKEND_PID=$!

# Start CarPlay Server
echo "Starting CarPlay Server (Node.js)..."
node carplay_server.mjs > /tmp/mellitainment-carplay.log 2>&1 &
CARPLAY_PID=$!

# Start Frontend (foreground to see logs)
cd "$FRONTEND_DIR"
echo "Starting Frontend (Vite)..."
echo ""
npm run dev

# Wait for all background processes
wait
