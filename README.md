# Mellitainment - Raspberry Pi Infotainment System

A custom-built, retro-modern infotainment system designed specifically for a 1970 Ford F100. This project bridges the gap between classic automotive design and modern technology, providing a seamless Apple CarPlay experience alongside critical real-time vehicle telemetry.

Built on a Raspberry Pi foundation, **Mellitainment** integrates with the vehicle's analog sensors via an ADC module to display accurate readings for Oil Pressure, Water Temperature, and Battery Voltage. The user interface is crafted with React to mimic the aesthetic of the 70s while offering the responsiveness of a modern web application. It features a 10-band audio equalizer, automatic day/night switching, and a robust backend that handles power management and sensor data smoothing.

## Features
- **Apple CarPlay**: Wireless/Wired CarPlay via Carlinkit CPC200-CCPA dongle
- **Telemetry Dashboard**: Real-time monitoring of Oil Pressure, Water Temperature, and Voltage
- **Retro-Modern UI**: Custom React-based interface optimized for touchscreens
- **10-Band Equalizer**: Custom audio equalizer with presets and responsive UI
- **Centralized Configuration**: All settings in `config/config.json` - no code changes needed
- **Plug & Play**: Automated setup script for Raspberry Pi OS (Bullseye)

---

# Quick Start

## Configuration Overview

All tunable parameters are centralized in **`config/config.json`**:
- Screen resolution (800x480)
- Sensor calibration curves
- Warning thresholds
- Smoothing parameters
- Service ports

**To enable real sensors:** Edit `.env` file:
```bash
MOCK_SENSORS=false
```

No systemd editing required!

---

# Development & Deployment Guide

## 1. Local Development (Mac/PC)

### Prerequisites
- **Python 3.8+**
- **Node.js 20+**
- **npm**

### Setup
1.  **Backend Setup**:
    ```bash
    cd backend
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    npm install  # For node-carplay dependencies
    ```

2.  **Frontend Setup**:
    ```bash
    cd frontend
    npm install
    ```

3.  **Create .env file**:
    ```bash
    cp .env.example .env
    # Edit .env to set MOCK_SENSORS=true (default for development)
    ```

### Running Locally
1.  **Start Backend** (Terminal 1):
    ```bash
    cd backend
    source venv/bin/activate
    python3 app.py
    ```
    - Backend API: [http://localhost:5001](http://localhost:5001)
    - Config endpoint: [http://localhost:5001/api/config](http://localhost:5001/api/config)

2.  **Start CarPlay Server** (Terminal 2):
    ```bash
    cd backend
    node carplay_server.mjs
    ```
    - CarPlay Stream: [http://localhost:5006](http://localhost:5006)

3.  **Start Frontend Dev Server** (Terminal 3):
    ```bash
    cd frontend
    npm run dev
    ```
    - Dashboard UI: [http://localhost:5173](http://localhost:5173)

### Notes
- Telemetry data is simulated by default (`MOCK_SENSORS=true`)
- CarPlay requires the physical Carlinkit dongle to be connected via USB
- All configuration loaded from `config/config.json`

---

## 2. Docker Simulation (Mac/PC)

Before flashing to hardware, use Docker to verify the UI and application logic. This runs the exact same software stack as the Pi.

### How to Run
1.  **Start Simulation**:
    ```bash
    ./run_in_docker.sh
    ```
    *   Builds a Debian Bullseye image (mimicking RPi OS)
    *   Installs all dependencies via `setup.sh`
    *   Starts Backend (Port 5001), CarPlay Server (Port 5006), and Frontend (Port 5173)

2.  **Access Dashboard**:
    *   Open [http://localhost:5173](http://localhost:5173) in your browser

### Limitations
*   **No Audio**: Audio device mapping is disabled on macOS
*   **No Dongle**: Physical USB dongle cannot be passed through easily
*   **Mock Sensors**: Telemetry data is simulated (random values)

---

## 3. Hardware Deployment (Raspberry Pi)

This process is designed to be "Plug & Play". Once set up, the Pi will boot directly into the dashboard.

### Prerequisites
*   **Raspberry Pi 4 or 5** (4GB+ RAM recommended)
*   **MicroSD Card** (16GB+)
*   **Carlinkit CPC200-CCPA Dongle**
*   **Touchscreen Display** (800x480 resolution recommended)
*   **ADS1115 ADC Module** (for sensor readings)
*   **Sensors**: Oil pressure sender, water temperature sender, voltage divider for battery

### Step 1: Flash OS
1.  Download **Raspberry Pi Imager**
2.  Choose OS: **Raspberry Pi OS (Legacy, 64-bit) Bullseye**
    > [!IMPORTANT]
    > **Do NOT use Bookworm.** The video stack changes in Bookworm break `node-carplay`. Use **Bullseye**.
3.  Click settings (gear icon):
    *   Set Hostname: `infotainment`
    *   Enable SSH (use password auth)
    *   Set Username: `pi` / Password: `yourpassword`
    *   Configure Wi-Fi (if needed for initial setup)
4.  Write to SD Card

### Step 2: Install Code
1.  Boot the Pi and connect via SSH:
    ```bash
    ssh mellis@mellis-pi.local
    ```
2.  Copy the project folder to the Pi:
    ```bash
    # Run this from your Mac terminal
    rsync -avz --progress --delete \
      --exclude 'node_modules' \
      --exclude '.git' \
      --exclude '.venv' \
      --exclude 'venv' \
      --exclude '__pycache__' \
      --exclude '.DS_Store' \
      --exclude '.env.local' \
      ~/Code/mellitainment/ mellis@mellis-pi.local:~/mellitainment/
    ```
3.  Run the Setup Script:
    ```bash
    # On the Pi
    cd ~/mellitainment
    chmod +x setup.sh
    ./setup.sh
    ```
    
    **What setup.sh does:**
    - Installs system dependencies (Python, Node.js 20, ffmpeg, i2c-tools)
    - Creates Python virtual environment and installs packages
    - Builds React frontend for production
    - Creates `.env` file from `.env.example`
    - Enables I2C interface for ADC
    - Configures USB permissions for CarPlay dongle
    - Creates systemd services for auto-start
    - Configures kiosk mode (fullscreen browser)
    - Disables screen blanking and hides cursor

### Step 3: Configure Display Resolution
1.  **Edit boot config** to force 800x480 resolution:
    ```bash
    sudo nano /boot/config.txt
    ```
2.  **Add the following lines** (or copy from `config/hdmi_config.txt`):
    ```
    hdmi_force_hotplug=1
    hdmi_group=2
    hdmi_mode=87
    hdmi_cvt=800 480 60 6 0 0 0
    disable_overscan=1
    ```
3.  Save and exit (Ctrl+X, Y, Enter)

> [!TIP]
> To use a different resolution, edit `config/config.json` → `display.width/height` and update the `hdmi_cvt` line accordingly.

### Step 4: Configure Sensors

#### Hardware Wiring
1.  **Wire the ADS1115** to the Pi:
    *   VDD → 3.3V (Pin 1)
    *   GND → Ground (Pin 6)
    *   SCL → GPIO 3 / SCL (Pin 5)
    *   SDA → GPIO 2 / SDA (Pin 3)

2.  **Connect sensors** to ADC channels:
    *   **A0**: Oil Pressure Sensor (0-5V output)
    *   **A1**: Water Temperature Sender (resistance-based)
    *   **A2**: Battery Voltage (via 3:1 voltage divider)

#### Sensor Calibration
1.  **Edit calibration settings** in `config/config.json`:
    ```json
    {
      "sensors": {
        "calibration": {
          "oil_pressure": {
            "min_voltage": 0.0,
            "max_voltage": 5.0,
            "min_value": 0,
            "max_value": 100
          }
        }
      }
    }
    ```

2.  **Adjust warning thresholds** in `config/config.json`:
    ```json
    {
      "sensors": {
        "thresholds": {
          "oil_pressure": { "min": 10, "max": 90 },
          "water_temp": { "max": 220 },
          "voltage": { "min": 11.5, "max": 15.0 }
        }
      }
    }
    ```

#### Enable Real Sensors
1.  **Edit `.env` file**:
    ```bash
    nano ~/mellitainment/.env
    ```
    
2.  **Change MOCK_SENSORS**:
    ```bash
    MOCK_SENSORS=false
    ```

3.  **Restart backend service**:
    ```bash
    sudo systemctl restart infotainment-backend
    ```

> [!NOTE]
> The system will automatically fall back to mock mode if ADC hardware is not detected.

### Step 5: Verify I2C Communication
Before enabling real sensors, verify the ADC is detected:
```bash
sudo i2cdetect -y 1
```
You should see address `0x48` (default ADS1115 address).

### Step 6: Final Verification
1.  **Reboot** the Pi:
    ```bash
    sudo reboot
    ```
2.  The screen should show boot text, then launch directly into the Infotainment Dashboard
3.  Plug in your iPhone to the Carlinkit dongle - CarPlay should appear automatically

---

## 4. Configuration Reference

### config/config.json

All tunable parameters are in this file. Edit and restart services to apply changes.

#### Display Settings
```json
{
  "display": {
    "width": 800,
    "height": 480,
    "fps": 60
  }
}
```

#### Sensor Settings
```json
{
  "sensors": {
    "mock_mode": true,
    "smoothing": {
      "enabled": true,
      "alpha": 0.2  // Lower = more smoothing (0-1)
    },
    "calibration": {
      // Voltage-to-unit conversion curves
    },
    "thresholds": {
      // Warning trigger values
    }
  }
}
```

#### UI Settings
```json
{
  "ui": {
    "visual_warnings": {
      "enabled": true,
      "min_duration_ms": 2000  // Minimum warning flash duration
    }
  }
}
```

### .env File

Simple environment configuration (no systemd editing required):

```bash
# Sensor Mode
MOCK_SENSORS=true   # true = simulated, false = real ADC hardware

# Config file path (relative to backend directory)
CONFIG_FILE=../config/config.json

# Log level
LOG_LEVEL=INFO
```

---

## 5. Real-World Testing Checklist

### ✅ What's Been Tested (Development)
- [x] Backend loads config.json successfully
- [x] Frontend fetches config via API
- [x] Mock sensor data displays correctly
- [x] Gauge warning system triggers properly
- [x] CarPlay simulator connects and streams
- [x] Touch coordinate scaling logic
- [x] .env file loading
- [x] Graceful ADC fallback when hardware missing

### ⏳ What Needs IRL Testing (On Raspberry Pi)

#### Hardware Integration
- [ ] **I2C Communication**: Verify `i2cdetect -y 1` shows ADS1115 at 0x48
- [ ] **ADC Voltage Reading**: Test raw voltage readings from each channel
- [ ] **Sensor Calibration**: Verify voltage-to-unit conversions are accurate
- [ ] **EMA Smoothing**: Check if alpha=0.2 provides adequate noise filtering
- [ ] **Warning Thresholds**: Confirm visual warnings trigger at correct values

#### CarPlay Dongle
- [ ] **USB Detection**: Verify dongle is recognized on USB 3.0 port
- [ ] **iPhone Connection**: Test wired connection time (<10 seconds)
- [ ] **Video Streaming**: Confirm 800x480@60fps video appears
- [ ] **Audio Playback**: Verify audio plays through Pi audio output
- [ ] **Touch Accuracy**: Test all CarPlay UI elements respond correctly
- [ ] **Disconnect/Reconnect**: Verify graceful handling of phone disconnect

#### Display & Touch
- [ ] **HDMI Resolution**: Confirm display shows 800x480 (no black bars)
- [ ] **Touch Calibration**: Verify touch coordinates map accurately
- [ ] **Kiosk Mode**: Confirm browser launches fullscreen on boot
- [ ] **Screen Blanking**: Verify screen stays on indefinitely
- [ ] **Cursor Hidden**: Confirm no mouse cursor visible

#### System Performance
- [ ] **Boot Time**: Measure time from power-on to dashboard visible
- [ ] **CPU Temperature**: Monitor under full load (CarPlay + sensors)
- [ ] **Memory Usage**: Check if 4GB RAM is sufficient
- [ ] **Service Stability**: Run for 24+ hours, check for crashes
- [ ] **Service Recovery**: Kill services manually, verify auto-restart

#### Real-World Scenarios
- [ ] **Cold Start**: Test startup in cold weather (if applicable)
- [ ] **Engine Running**: Verify sensor readings match analog gauges
- [ ] **Driving**: Test CarPlay navigation while monitoring sensors
- [ ] **High Temp Warning**: Trigger water temp warning, verify visibility
- [ ] **Low Voltage Warning**: Test with engine off, verify battery warning

---

## 6. Troubleshooting

### CarPlay Not Connecting
*   Ensure dongle is in **USB 3.0 (blue)** port
*   Check service status: `sudo systemctl status infotainment-carplay`
*   Check logs: `journalctl -u infotainment-carplay -f`
*   Verify dongle permissions: `ls -l /dev/bus/usb/*/*`
*   **Dongle Settings/Update:**
    *   Connect phone to dongle WiFi (`AutoKit_...`).
    *   Open `http://192.168.43.1` (or `192.168.50.2`).
    *   Try changing "Sync Mode" to "Compatible".
    *   Check for Firmware Updates (requires Cellular Data on phone).

### Sensors Not Reading
*   Verify I2C enabled: `sudo raspi-config nonint get_i2c` (should return 0)
*   Check I2C devices: `sudo i2cdetect -y 1`
*   Verify `.env` has `MOCK_SENSORS=false`
*   Check backend logs: `journalctl -u infotainment-backend -f`

### Display Issues
*   **Wrong resolution**: Check `/boot/config.txt` has correct `hdmi_cvt` line
*   **Not fullscreen**: Verify `/home/mellis/.config/lxsession/LXDE-pi/autostart` has kiosk command
*   **Screen blanking**: Check autostart file has `@xset s off` lines

### Configuration Not Loading
*   Verify `config/config.json` is valid JSON: `python3 -m json.tool config/config.json`
*   Check file permissions: `ls -l config/config.json`
*   Restart services: `sudo systemctl restart infotainment-*`

### Performance Issues
*   Check CPU throttling: `vcgencmd get_throttled`
*   Monitor temperature: `vcgencmd measure_temp`
*   Check memory: `free -h`
*   Consider Pi 5 if Pi 4 struggles

---

## 7. Advanced Configuration

### Changing Screen Resolution
1.  Edit `config/config.json`:
    ```json
    {
      "display": {
        "width": 1024,
        "height": 600
      }
    }
    ```
2.  Update `/boot/config.txt`:
    ```
    hdmi_cvt=1024 600 60 6 0 0 0
    ```
3.  Restart services and reboot

### Adjusting Sensor Smoothing
Lower alpha = more smoothing (slower response):
```json
{
  "sensors": {
    "smoothing": {
      "alpha": 0.1  // Was 0.2
    }
  }
}
```

### Custom Warning Thresholds
```json
{
  "sensors": {
    "thresholds": {
      "water_temp": {
        "max": 230  // Raise warning threshold
      }
    }
  }
}
```

---

## 8. Development Tips

### Viewing Configuration
```bash
# View current config
curl http://localhost:5001/api/config | python3 -m json.tool
```

### Testing Sensor Calibration
```bash
# Enable mock mode
echo "MOCK_SENSORS=true" > .env

# Watch telemetry updates
curl http://localhost:5001/api/telemetry
```

### Monitoring Services
```bash
# Watch all services
watch -n 1 'systemctl status infotainment-*'

# Follow all logs
journalctl -u infotainment-* -f
```

---

## License
MIT

## Credits
- Built for a 1970 Ford F100
- Uses [node-carplay](https://github.com/rhysmorgan134/node-carplay) for CarPlay integration
- Adafruit CircuitPython for ADC support

---

## 9. UPS Integration & Power Management

The system supports the **MakerFocus/Geekworm RPi UPSPack V3P** for safe shutdowns and power loss detection.

### Hardware Wiring
Connect the UPS UART pins to the Raspberry Pi GPIO header:

| UPS Pin | Raspberry Pi Pin | Function |
| :--- | :--- | :--- |
| **TX** | **GPIO 15 (RXD)** / Pin 10 | Serial Receive |
| **RX** | **GPIO 14 (TXD)** / Pin 8 | Serial Transmit |
| **5V** | **5V** / Pin 2 or 4 | Power Input |
| **GND** | **GND** / Pin 6, 9, etc. | Ground |

### Configuration
1.  **Enable Serial Port**:
    ```bash
    sudo raspi-config
    # Interface Options -> Serial Port
    # Login Shell: No
    # Serial Hardware: Yes
    ```
2.  **Reboot**: `sudo reboot`

### How it Works
*   The backend monitors the UPS via `/dev/serial0` at 9600 baud.
*   **Power Loss Detection**: If Input Voltage (Vin) drops below **4.0V**, the system assumes USB power is lost.
*   **Shutdown Timer**: A 60-second countdown begins. If power is restored, the timer cancels.
*   **Safe Shutdown**: If the timer expires, the system executes `sudo shutdown -h now`.

### Simulating UPS Events (Local Development)
You can test the power management logic without hardware using the simulation script:

1.  **Start the Backend**:
    ```bash
    python3 backend/app.py
    ```
2.  **Run the Simulator** (in a new terminal):
    ```bash
    # Simulate Battery Drain (battery indicator appears and percentage drops)
    backend/venv/bin/python simulate_ups.py --drain
    
    # Simulate Power Loss (triggers shutdown timer)
    backend/venv/bin/python simulate_ups.py --power-loss
    
    # Restore Power (cancels shutdown)
    backend/venv/bin/python simulate_ups.py --restore
    ```
3.  **What You'll See**:
    *   Battery indicator appears at bottom of sidebar (below clock)
    *   Green icon when charging, red when capacity < 20%
    *   Percentage updates in real-time
    *   Indicator disappears when simulation stops (Ctrl+C)

---

## 10. Equalizer Details

The **Equalizer** UI includes:
- A persistent preset selection stored in `localStorage` (default preset is **Mellis**).
- Highlighting of the active preset button.
- A **Reset** button that only appears when the user has modified the EQ settings and resets to the currently selected preset.
- Automatic emission of the EQ band values to the backend via a Socket.IO `eq_update` event whenever the sliders change or the preset is applied.

These changes ensure that the backend receives the correct EQ configuration on app load and after any adjustments.

---

## 11. Running Tests

The project includes a comprehensive test suite for both backend (Python/Pytest) and frontend (React/Vitest).

### Run All Tests
```bash
./run_tests.sh
```

### Run Backend Tests Only
```bash
cd backend
python3 -m pytest tests/
```

### Run Frontend Tests Only
```bash
cd frontend
npm test
```

---

## 12. CarPlay Integration

### node-carplay Patches

This project uses a **patched version** of `node-carplay` to support newer Carlinkit dongle firmware. The patches add support for message types 35, 36, 37, 38, and 163 which are sent by recent dongle firmware but not handled by the upstream library.

**The patches are automatically applied** thanks to `patch-package`:
- Patch file: `backend/patches/node-carplay+4.3.0.patch`
- Auto-applied on `npm install` via `postinstall` script
- No manual intervention needed!

### What was patched:
1. **Message Classes**: Added `UINightMode`, `UIColorMode`, `UIScaleMode`, `UISettingMessage`, and `PluginMessage` classes
2. **Import Statements**: Updated to include new message classes  
3. **Switch Cases**: Added handlers for message types 35-38 and 163

### If CarPlay isn't working:

**Dongle blinking blue:**
- Ensure iPhone is connected to dongle's WiFi
- Check if dongle appears in USB: `lsusb` (Linux) or `ioreg -p IOUSB -w 0 | grep -i auto` (Mac)
- Try different USB port or powered USB hub
- Restart CarPlay server: `cd backend && node carplay_server.mjs`

**Patches not applying:**
- Verify patch file exists: `ls backend/patches/`
- Manually apply: `cd backend && npx patch-package`
- Check postinstall ran: Review npm install output for "patch-package" messages

**Mac-specific issues:**
- macOS USB power limitations can affect dongle stability
- Raspberry Pi deployment is recommended for production use
- Use powered USB hub on Mac for testing

### Dongle Settings

Access dongle web interface (connect to dongle's WiFi first):
- URL: `http://192.168.50.2` or `http://192.168.43.1`
- Try changing "Sync Mode" to "Compatible"
- Switch WiFi band to 2.4GHz if on 5GHz

---

## License

MIT License - see LICENSE file for details.

**Credits:**
- `node-carplay` library by rhysmorgan134
- Carlinkit CPC200-CCPA dongle
