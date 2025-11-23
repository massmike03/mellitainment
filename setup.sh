#!/bin/bash
# Raspberry Pi Infotainment Setup Script
# Run this script ON the Raspberry Pi after cloning the repo.

set -e # Exit on error

echo "🚗 Starting Infotainment System Setup..."

if [ -z "$USER" ]; then
    USER=$(whoami)
fi
echo "👤 Running as user: $USER"

# 1. Install System Dependencies
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv git libudev-dev ffmpeg curl i2c-tools python3-smbus

# Install Node.js (LTS)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. Backend Setup
echo "🐍 Setting up Python Backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
npm install # Install node-carplay dependencies
cd ..

# 3. Frontend Setup
echo "⚛️ Setting up React Frontend..."
cd frontend
npm install
npm run build
cd ..

# 4. Create .env file for environment configuration
echo "📝 Creating .env file..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ .env file created from .env.example"
    echo "ℹ️  Edit .env to configure MOCK_SENSORS and other settings"
else
    echo "ℹ️  .env file already exists"
fi
cd ..

# 4. Enable I2C Interface (for ADC sensors)
echo "🔧 Enabling I2C interface..."
if command -v raspi-config &> /dev/null; then
    sudo raspi-config nonint do_i2c 0
    echo "✅ I2C enabled"
else
    echo "⚠️  raspi-config not found (likely not on Pi). Skipping I2C setup."
fi

# 5. Simulator Dependencies
echo "📦 Installing simulator dependencies..."
npm install
cd ..

# 6. Configure Udev Rules (for Carlinkit Dongle)
echo "🔌 Configuring USB permissions..."
sudo mkdir -p /etc/udev/rules.d
sudo bash -c 'cat > /etc/udev/rules.d/50-carplay.rules <<EOF
SUBSYSTEM=="usb", ATTR{idVendor}=="1314", ATTR{idProduct}=="1520", MODE="0660", GROUP="plugdev"
SUBSYSTEM=="usb", ATTR{idVendor}=="1314", ATTR{idProduct}=="1521", MODE="0660", GROUP="plugdev"
EOF'
sudo udevadm control --reload-rules && sudo udevadm trigger
# Ensure plugdev group exists (Linux only)
if [[ "$OSTYPE" == "linux"* ]]; then
    if ! getent group plugdev > /dev/null; then
        sudo groupadd plugdev
    fi
    CURRENT_USER=$(whoami)
    sudo usermod -a -G plugdev $CURRENT_USER
else
    echo "Skipping plugdev group setup on non‑Linux OS ($OSTYPE)"
fi

# 7. Setup Systemd Services
echo "⚙️ Creating systemd services..."

# Backend Service
sudo bash -c "cat > /etc/systemd/system/infotainment-backend.service <<EOF
[Unit]
Description=Infotainment Backend
After=network.target

[Service]
User=$USER
WorkingDirectory=$(pwd)/backend
EnvironmentFile=$(pwd)/.env
ExecStart=$(pwd)/backend/venv/bin/python3 app.py
Restart=always
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF"

# CarPlay Service
sudo bash -c "cat > /etc/systemd/system/infotainment-carplay.service <<EOF
[Unit]
Description=CarPlay Node Server
After=network.target

[Service]
User=$USER
WorkingDirectory=$(pwd)/backend
ExecStart=$(which node) carplay_server.mjs
Restart=always

[Install]
WantedBy=multi-user.target
EOF"

# Frontend Service (Serve)
sudo npm install -g serve
sudo bash -c "cat > /etc/systemd/system/infotainment-frontend.service <<EOF
[Unit]
Description=Infotainment Frontend
After=network.target

[Service]
User=$USER
WorkingDirectory=$(pwd)/frontend
ExecStart=$(which serve) -s dist -l 5173
Restart=always

[Install]
WantedBy=multi-user.target
EOF"

# Enable and Start Services
echo "🚀 Enabling and starting services..."
if pidof systemd >/dev/null 2>&1; then
    sudo systemctl daemon-reload
    sudo systemctl enable infotainment-backend infotainment-carplay infotainment-frontend
    sudo systemctl restart infotainment-backend infotainment-carplay infotainment-frontend
    echo "⚠️  Systemd not running (likely in Docker). Skipping service start."
fi

# 8. Configure Kiosk Mode (Auto-start Browser)
echo "🖥️ Configuring Kiosk Mode..."
AUTOSTART_DIR="/home/$USER/.config/lxsession/LXDE-pi"
AUTOSTART_FILE="$AUTOSTART_DIR/autostart"

if [ -d "/home/$USER" ]; then
    mkdir -p "$AUTOSTART_DIR"
    # Check if autostart file exists, if not create it with defaults
    if [ ! -f "$AUTOSTART_FILE" ]; then
        cat > "$AUTOSTART_FILE" <<EOF
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xscreensaver -no-splash
EOF
    fi
    
    # Add Chromium Kiosk line if not present
    if ! grep -q "chromium-browser" "$AUTOSTART_FILE"; then
        echo "@chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito --window-position=0,0 --window-size=800,480 --check-for-update-interval=31536000 http://localhost:5173" >> "$AUTOSTART_FILE"
        echo "✅ Kiosk mode configured."
    else
        echo "ℹ️  Kiosk mode already configured."
    fi
    
    # Disable screen blanking (recommended for car display)
    if ! grep -q "xset s off" "$AUTOSTART_FILE"; then
        echo "@xset s off" >> "$AUTOSTART_FILE"
        echo "@xset -dpms" >> "$AUTOSTART_FILE"
        echo "@xset s noblank" >> "$AUTOSTART_FILE"
        echo "@unclutter -idle 0" >> "$AUTOSTART_FILE"
        echo "✅ Screen blanking disabled and cursor hidden."
    fi
else
    echo "⚠️  User home directory not found (likely root or docker). Skipping Kiosk config."
fi

echo "✅ Setup Complete! Reboot your Pi to ensure everything starts cleanly."
echo "   Access the dashboard at: http://localhost:5173"
