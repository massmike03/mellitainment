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
# Check if venv exists and works (in case it was copied from a different OS)
if [ -d "venv" ]; then
    if ! ./venv/bin/python3 --version > /dev/null 2>&1; then
        echo "⚠️  Existing venv is invalid or incompatible. Recreating..."
        rm -rf venv
    fi
fi

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
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


# 4. Enable I2C Interface (for ADC sensors)
echo "🔧 Enabling I2C interface..."
if command -v raspi-config &> /dev/null; then
    sudo raspi-config nonint do_i2c 0
    echo "✅ I2C enabled"
else
    echo "⚠️  raspi-config not found (likely not on Pi). Skipping I2C setup."
fi

# 5. Enable High Power Mode (Crucial for Pi 5 + Carlinkit)
echo "⚡ Configuring High Power Mode (USB)..."
CONFIG_FILE="/boot/firmware/config.txt"
[ ! -f "$CONFIG_FILE" ] && CONFIG_FILE="/boot/config.txt"

if [ -f "$CONFIG_FILE" ]; then
    # Backup
    [ ! -f "$CONFIG_FILE.bak" ] && sudo cp "$CONFIG_FILE" "$CONFIG_FILE.bak"
    
    # Enable max current
    if ! grep -q "usb_max_current_enable=1" "$CONFIG_FILE"; then
        echo "usb_max_current_enable=1" | sudo tee -a "$CONFIG_FILE"
    fi
    
    # Pi 5 specific: Force 5A mode (trusting the power source)
    if ! grep -q "psu_max_current=5000" "$CONFIG_FILE"; then
        echo "psu_max_current=5000" | sudo tee -a "$CONFIG_FILE"
    fi
    echo "✅ High Power Mode configured (requires reboot)."
else
    echo "⚠️  config.txt not found. Skipping High Power setup."
fi

# 5. Simulator Dependencies (root package.json for simulators)
echo "📦 Installing simulator dependencies..."
if [ -f "package.json" ]; then
    npm install
else
    echo "⚠️  No root package.json found. Skipping simulator dependencies."
fi

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

# 7. Configure log rotation (1-hour retention to protect SD card)
echo "📋 Configuring journald log rotation..."
sudo mkdir -p /etc/systemd/journald.conf.d
sudo bash -c "cat > /etc/systemd/journald.conf.d/retention.conf <<EOF
[Journal]
# Limit log retention to 1 hour to protect SD card
MaxRetentionSec=1h
# Cap total log size at 50MB
SystemMaxUse=50M
# Individual log file size limit
SystemMaxFileSize=10M
# Use persistent storage (disk) but sync every 10 minutes for durability
Storage=persistent
SyncIntervalSec=10min
# Compress logs to save space
Compress=yes
EOF"
echo "✅ Journald configured for 1-hour retention with 10-minute sync"

# 8. Create systemd services
echo "⚙️ Creating systemd services..."

# Backend Service
sudo bash -c "cat > /etc/systemd/system/infotainment-backend.service <<EOF
[Unit]
Description=Mellitainment Backend API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=PYTHONUNBUFFERED=1
ExecStart=$(pwd)/backend/venv/bin/python3 $(pwd)/backend/app.py
Restart=always
RestartSec=3
# Log settings - 1 hour retention
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mellitainment-backend

[Install]
WantedBy=multi-user.target
EOF"
echo "✅ Backend service created"

# CarPlay Service
sudo bash -c "cat > /etc/systemd/system/infotainment-carplay.service <<EOF
[Unit]
Description=CarPlay Node Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/backend
ExecStart=$(which node) carplay_server.mjs
Restart=always
RestartSec=3
# Log settings - 1 hour retention
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mellitainment-carplay

[Install]
WantedBy=multi-user.target
EOF"
echo "✅ CarPlay service created"

# Frontend Service (Serve)
sudo npm install -g serve
sudo bash -c "cat > /etc/systemd/system/infotainment-frontend.service <<EOF
[Unit]
Description=Mellitainment Frontend (Kiosk Mode)
After=graphical.target

[Service]
Type=simple
User=$USER
Environment=DISPLAY=:0
ExecStart=/usr/bin/chromium-browser --kiosk --disable-infobars --noerrdialogs --disable-session-crashed-bubble http://localhost:5173
Restart=always
RestartSec=5
# Log settings - 1 hour retention
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mellitainment-frontend

[Install]
WantedBy=graphical.target
EOF"
echo "✅ Frontend service created"

# Enable and Start Services
echo "🚀 Enabling and starting services..."
if pidof systemd >/dev/null 2>&1; then
    sudo systemctl daemon-reload
    # Restart journald to apply new log retention settings
    sudo systemctl restart systemd-journald
    sudo systemctl enable infotainment-backend infotainment-carplay infotainment-frontend
    echo "✅ Services enabled with 1-hour log retention"
    echo "ℹ️  Run 'sudo systemctl start infotainment-backend' to start services"
else
    echo "⚠️  systemd not running - services created but not enabled"
fi

# 9. Configure Kiosk Mode (Auto-start Browser)
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
echo "   Access the dashboard at: http://localhost:5173 or http://mellis-pi.local:5173"
