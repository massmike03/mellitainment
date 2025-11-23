from flask import Flask, jsonify, request as flask_request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import time
import threading
import random
import os
import json
from pathlib import Path
from dotenv import load_dotenv

from sensors import SensorInterface

# Load environment variables from .env file
load_dotenv()

# Load centralized configuration
config_path = Path(__file__).parent / '..' / 'config' / 'config.json'
with open(config_path, 'r') as f:
    CONFIG = json.load(f)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Use environment variable to control mock mode (overrides config.json)
mock_mode = os.getenv('MOCK_SENSORS', str(CONFIG['sensors']['mock_mode'])).lower() == 'true'
print(f"Starting sensor interface in {'MOCK' if mock_mode else 'HARDWARE'} mode")

from ups import UPSInterface

# Initialize sensor interface with config
sensor_interface = SensorInterface(
    mock=mock_mode,
    alpha=CONFIG['sensors']['smoothing']['alpha'],
    config=CONFIG['sensors']['calibration']
)

# Initialize UPS Interface
ups_interface = UPSInterface(mock=mock_mode)

def monitor_ups():
    """Background thread to monitor UPS and trigger shutdown if needed."""
    shutdown_counter = 0
    SHUTDOWN_LIMIT = 60  # Seconds
    
    while True:
        status = ups_interface.get_status()
        if status['available']:
            # Logic: If Input Voltage (Vin) < 4.0V, we are on battery
            if status.get('input_voltage', 5.0) < 4.0:
                shutdown_counter += 1
                print(f"⚠️ Power Loss Detected! Shutdown in {SHUTDOWN_LIMIT - shutdown_counter}s (Vin: {status.get('input_voltage')}V)")
            else:
                if shutdown_counter > 0:
                    print("✅ Power Restored. Shutdown cancelled.")
                shutdown_counter = 0
                
            if shutdown_counter >= SHUTDOWN_LIMIT:
                print("🛑 Initiating System Shutdown...")
                # os.system("sudo shutdown -h now")
                shutdown_counter = 0 # Reset to avoid spamming
        
        time.sleep(1)

# Start UPS monitoring thread
ups_thread = threading.Thread(target=monitor_ups, daemon=True)
ups_thread.start()

@app.route('/')
def index():
    return "Infotainment Backend Running"

@app.route('/api/config')
def get_config():
    """Expose configuration to frontend"""
    return jsonify(CONFIG)

@app.route('/api/telemetry')
def get_telemetry():
    data = sensor_interface.get_telemetry()
    # Add UPS data to telemetry
    ups_data = ups_interface.get_status()
    if ups_data['available']:
        data['ups'] = ups_data
    return jsonify(data)

@app.route('/api/control', methods=['POST'])
def system_control():
    # Placeholder for system control (volume, brightness)
    # In real implementation, this would interact with system commands
    return jsonify({"status": "success", "message": "Control command received"})

@socketio.on('connect')
def test_connect():
    print('Client connected')
    emit('my response', {'data': 'Connected'})

@socketio.on('telemetry_update')
def handle_telemetry_update(data):
    """Relay telemetry data from simulators to all connected clients."""
    # Inject UPS data if available
    ups_data = ups_interface.get_status()
    if ups_data['available']:
        data['ups'] = ups_data
    emit('telemetry_update', data, broadcast=True)

# Track which session is the simulator
simulator_sid = None

@socketio.on('simulate_ups')
def handle_ups_simulation(data):
    """Allow external simulation of UPS state when in mock mode."""
    global simulator_sid
    print(f"Received simulate_ups event: {data}")
    if ups_interface.mock:
        ups_interface.voltage = data.get('voltage', 0)
        ups_interface.capacity = data.get('capacity', 0)
        ups_interface.input_voltage = data.get('input_voltage', 0)
        ups_interface.charging = data.get('charging', False)
        ups_interface.available = True
        
        # Track this session as the simulator
        simulator_sid = flask_request.sid
        
        # Broadcast updated UPS state to all clients
        # We send a minimal telemetry_update with just UPS data
        emit('telemetry_update', {
            'ups': ups_interface.get_status()
        }, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    """Reset UPS state when simulation disconnects."""
    global simulator_sid
    
    print(f"Client disconnected: {flask_request.sid}, simulator_sid: {simulator_sid}")
    
    # Only reset if this was the simulator session
    if ups_interface.mock and ups_interface.available and flask_request.sid == simulator_sid:
        print("Simulator disconnected - resetting UPS state")
        ups_interface.available = False
        simulator_sid = None
        # Broadcast that UPS is no longer available using socketio.emit
        socketio.emit('telemetry_update', {
            'ups': ups_interface.get_status()
        })

if __name__ == '__main__':
    host = CONFIG['backend']['host']
    port = CONFIG['backend']['port']
    debug = CONFIG['backend']['debug']
    socketio.run(app, host=host, port=port, debug=debug, allow_unsafe_werkzeug=True)
