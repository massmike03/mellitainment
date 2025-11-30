#!/bin/bash
# Enable High Power Mode for USB ports (Pi 4 & 5)
# This overrides the default 600mA limit and allows up to 1.2A/1.6A.

CONFIG_FILE="/boot/firmware/config.txt"

# Check if file exists (Pi 5 / Bookworm moved it here)
if [ ! -f "$CONFIG_FILE" ]; then
    CONFIG_FILE="/boot/config.txt"
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Could not find config.txt in /boot/firmware or /boot"
    exit 1
fi

echo "🔧 modifying $CONFIG_FILE..."

# Backup first
sudo cp "$CONFIG_FILE" "$CONFIG_FILE.bak"

# 1. usb_max_current_enable=1 (Standard override for Pi 4/5)
if grep -q "usb_max_current_enable" "$CONFIG_FILE"; then
    sudo sed -i 's/^#*usb_max_current_enable.*/usb_max_current_enable=1/' "$CONFIG_FILE"
else
    echo "usb_max_current_enable=1" | sudo tee -a "$CONFIG_FILE"
fi

# 2. psu_max_current=5000 (Specific override for Pi 5 to tell it we have 5A)
if grep -q "psu_max_current" "$CONFIG_FILE"; then
    sudo sed -i 's/^#*psu_max_current.*/psu_max_current=5000/' "$CONFIG_FILE"
else
    echo "psu_max_current=5000" | sudo tee -a "$CONFIG_FILE"
fi

echo "✅ High Power Mode enabled."
echo "⚠️  You MUST reboot for this to take effect."
echo "   Run: sudo reboot"
