#!/usr/bin/env bash
# run_simulations.sh – orchestrate local simulation scripts
# This script starts telemetry simulation scripts.
# NOTE: It assumes the Backend (port 5001) is ALREADY running (e.g., via run_local.sh).
# Add additional simulation scripts by appending them to the "SIM_SCRIPTS" array.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Array of simulation scripts (relative to project root)
SIM_SCRIPTS=(
    "./simulate_telemetry.py"
    # Add more scripts here, eg., "./simulate_other.py"
)

echo "🚀 Starting Mellitainment simulation scripts..."

# Check if Backend is running
if ! curl -s http://localhost:5001 >/dev/null; then
    echo "⚠️  WARNING: Backend does not appear to be running on http://localhost:5001"
    echo "   Simulation scripts might fail to connect."
    echo "   Please run './run_local.sh' in another terminal first."
    read -p "   Press ENTER to continue anyway, or Ctrl+C to abort..."
fi

# Cleanup existing simulation processes
echo "🧹 Checking for existing simulation processes..."
for script in "${SIM_SCRIPTS[@]}"; do
    script_name=$(basename "$script")
    # Find PIDs of the script running with python
    pids=$(pgrep -f "$script_name" || true)
    if [ -n "$pids" ]; then
        echo "   Stopping existing instances of $script_name..."
        echo "$pids" | xargs kill 2>/dev/null || true
    fi
done

# Activate backend virtual environment (ensure dependencies are available)
if [ -d "$PROJECT_ROOT/backend/venv" ]; then
    echo "🔧 Activating backend virtual environment..."
    source "$PROJECT_ROOT/backend/venv/bin/activate"
else
    echo "⚠️ Backend virtual environment not found. Creating it..."
    cd "$PROJECT_ROOT/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd "$PROJECT_ROOT"
    cd "$PROJECT_ROOT"
fi

# Check for root-level node dependencies (for simulators)
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo "📦 Installing simulator dependencies..."
    npm install
fi

SIM_PIDS=()
for script in "${SIM_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        echo "📡 Launching simulation script: $script"
        chmod +x "$script"
        "$script" &
        SIM_PIDS+=($!) # Store PID
    else
        echo "⚠️ Simulation script not found: $script"
    fi
done

# Start CarPlay Simulator
if [ -f "simulate_carplay.js" ]; then
    echo "📺 Launching CarPlay Simulator..."
    node simulate_carplay.js &
    SIM_PIDS+=($!)
else
    echo "⚠️  simulate_carplay.js not found."
fi

# Trap Ctrl+C to clean up background processes
cleanup() {
    echo -e "\n🛑 Stopping all simulation services..."
    # Kill any simulation processes started in background
    if [ ${#SIM_PIDS[@]} -gt 0 ]; then
        kill "${SIM_PIDS[@]}" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup INT TERM

echo ""
echo "✅ Simulation environment running."
echo "📝 Press Ctrl+C to stop all simulations."
echo ""

# Wait for background jobs to finish (they run indefinitely until stopped)
wait
