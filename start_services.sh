#!/bin/bash
# Start services in Docker (since systemd is missing)

echo "🚀 Starting Infotainment Simulation..."

# Start Backend
echo "🐍 Starting Backend..."
cd /home/mellis/mellitainment/backend
source venv/bin/activate
python3 app.py &
BACKEND_PID=$!

# Start CarPlay Server
echo "🚗 Starting CarPlay Server..."
node carplay_server.mjs &
CARPLAY_PID=$!

# Start Frontend
echo "⚛️ Starting Frontend..."
cd /home/mellis/mellitainment/frontend
npx serve -s dist -l 5173 &
FRONTEND_PID=$!

# Wait for any process to exit
wait -n
  
# Exit with status of process that exited first
exit $?
