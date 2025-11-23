#!/bin/bash
set -e

echo "🧪 Running Backend Tests..."
cd backend
# Ensure venv is active or packages are installed
if [ -d "venv" ]; then
    source venv/bin/activate
fi
# Run pytest
python3 -m pytest tests/

echo ""
echo "🧪 Running Frontend Tests..."
cd ../frontend
# Run vitest
npm test -- run

echo ""
echo "✅ All tests passed!"
