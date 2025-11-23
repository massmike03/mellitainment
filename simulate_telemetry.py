#!/usr/bin/env python3
"""Simulate telemetry data for local testing.

This script connects to the backend Socket.IO server (default http://localhost:5001)
and emits custom telemetry updates every second. It can be used instead of the
built‑in mock sensor thread to test how the frontend reacts to arbitrary data.

Usage:
    ./simulate_telemetry.py          # runs with random values
    ./simulate_telemetry.py --fixed   # emits a fixed set of values (useful for UI snapshots)
"""
import argparse
import random
import time
import socketio

# Default backend address – matches the Flask‑SocketIO server in backend/app.py
DEFAULT_URL = "http://localhost:5001"

parser = argparse.ArgumentParser(description="Telemetry simulator for Mellitainment")
parser.add_argument("--url", default=DEFAULT_URL, help="Backend Socket.IO URL")
parser.add_argument("--fixed", action="store_true", help="Emit a fixed set of values instead of random ones")
args = parser.parse_args()

sio = socketio.Client()

@sio.event
def connect():
    print(f"✅ Connected to {args.url}")

@sio.event
def disconnect():
    print("⚠️ Disconnected from backend")

def generate_data():
    if args.fixed:
        return {
            "oil_pressure": 55.0,
            "water_temp": 190.0,
            "voltage": 13.8,
        }
    else:
        return {
            "oil_pressure": round(random.uniform(0, 100), 1),
            "water_temp": round(random.uniform(150, 250), 1),
            "voltage": round(random.uniform(12, 15), 1),
        }

def main():
    sio.connect(args.url)
    try:
        while True:
            data = generate_data()
            sio.emit("telemetry_update", data)
            print(f"📡 Sent: {data}")
            time.sleep(1)
    except KeyboardInterrupt:
        print("🛑 Stopping simulator")
    finally:
        sio.disconnect()

if __name__ == "__main__":
    main()
