#!/bin/bash
# Restart all infotainment systemd services

echo "🔄 Restarting Infotainment Services..."

echo "1. Restarting Backend..."
sudo systemctl restart infotainment-backend

echo "2. Restarting CarPlay Server..."
sudo systemctl restart infotainment-carplay

echo "3. Restarting Frontend..."
sudo systemctl restart infotainment-frontend

echo "✅ All services restarted!"
echo ""
echo "📊 Current Status:"
sudo systemctl status infotainment-backend infotainment-carplay infotainment-frontend --no-pager | grep -E "Unit|Active"
