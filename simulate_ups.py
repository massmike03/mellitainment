#!/usr/bin/env python3
"""Simulate UPS telemetry data for local testing.

This script connects to the backend Socket.IO server and emits custom UPS updates.
It allows you to test the shutdown logic by simulating power loss.

Usage:
    ./simulate_ups.py --power-loss   # Simulate power loss (Vin=0V)
    ./simulate_ups.py --restore      # Restore power (Vin=5V)
    ./simulate_ups.py --drain        # Simulate battery drain
"""
import argparse
import time
import socketio
import random

# Default backend address
DEFAULT_URL = "http://localhost:5001"

parser = argparse.ArgumentParser(description="UPS simulator for Mellitainment")
parser.add_argument("--url", default=DEFAULT_URL, help="Backend Socket.IO URL")
parser.add_argument("--power-loss", action="store_true", help="Simulate power loss (Vin=0V)")
parser.add_argument("--restore", action="store_true", help="Restore power (Vin=5V)")
parser.add_argument("--drain", action="store_true", help="Simulate battery drain")
args = parser.parse_args()

sio = socketio.Client()

@sio.event
def connect():
    print(f"✅ Connected to {args.url}")

@sio.event
def disconnect():
    print("⚠️ Disconnected from backend")

def main():
    sio.connect(args.url)
    
    # Initial state
    ups_data = {
        "available": True,
        "voltage": 4.2,
        "capacity": 100.0,
        "charging": True,
        "input_voltage": 5.1
    }

    if args.power_loss:
        print("🔌 Simulating POWER LOSS...")
        ups_data["input_voltage"] = 0.0
        ups_data["charging"] = False
    
    if args.restore:
        print("⚡ Simulating POWER RESTORED...")
        ups_data["input_voltage"] = 5.1
        ups_data["charging"] = True

    try:
        while True:
            if args.drain:
                ups_data["capacity"] = max(0, ups_data["capacity"] - 0.5)
                ups_data["voltage"] = max(3.0, ups_data["voltage"] - 0.01)
            
            # In a real scenario, the backend reads from serial.
            # Since we can't easily inject into the backend's serial reader from outside,
            # we will emit a special 'ups_update' event that the backend listens to (we need to add this handler).
            # OR, since we are in mock mode, we can just emit 'telemetry_update' with the UPS data included,
            # mimicking what the backend would do.
            
            # Actually, the backend is the source of truth. 
            # To test the BACKEND's shutdown logic, we need to influence the backend's internal state.
            # Since we can't do that easily via socket.io without a specific endpoint,
            # we will add a 'simulate_ups' event to the backend app.py.
            
            sio.emit("simulate_ups", ups_data)
            print(f"🔋 Sent UPS State: Vin={ups_data['input_voltage']}V, Cap={ups_data['capacity']}%")
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("🛑 Stopping simulator")
    finally:
        sio.disconnect()

if __name__ == "__main__":
    main()
