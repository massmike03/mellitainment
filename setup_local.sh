#!/bin/bash
# Local Development Setup Script (macOS/Linux)
# Use this to set up the project on your laptop for development.

set -e

echo "💻 Setting up Local Development Environment..."

# 1. Backend Setup
echo "🐍 Setting up Python Backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Created virtual environment"
fi

# Activate venv and install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Install Node.js dependencies for backend (node-carplay)
echo "📦 Installing Backend Node dependencies..."
npm install
cd ..

# 2. Frontend Setup
echo "⚛️ Setting up React Frontend..."
cd frontend
npm install
# Create .env.local for local development (overrides defaults)
echo "VITE_API_HOST=localhost" > .env.local
echo "✅ Created frontend/.env.local (VITE_API_HOST=localhost)"
cd ..

# 3. Create .env file
echo "📝 Creating .env file..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    # Default to MOCK sensors locally
    sed -i '' 's/MOCK_SENSORS=false/MOCK_SENSORS=true/' .env
    echo "✅ .env file created (MOCK_SENSORS=true)"
else
    echo "ℹ️  .env file already exists"
fi

# 4. Simulator Setup
echo "🚗 Installing Simulator dependencies..."
if [ -f "package.json" ]; then
    npm install
fi

echo ""
echo "✅ Local Setup Complete!"
echo ""
echo "To run the system locally:"
echo "   ./run_local.sh"
echo ""
echo "This will start Backend, CarPlay Server, and Frontend in parallel."
echo "   ./run_simulations.sh"
