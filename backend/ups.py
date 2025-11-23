import time
import os
import threading
import re

class UPSInterface:
    def __init__(self, port='/dev/serial0', baudrate=9600, mock=False):
        self.port = port
        self.baudrate = baudrate
        self.mock = mock
        self.available = False
        self.serial = None
        self.shutdown_timer_start = None
        self.SHUTDOWN_DELAY = 60  # Seconds to wait before shutdown
        
        # UPS State
        self.voltage = 0.0      # Battery Voltage
        self.capacity = 100.0   # Battery Percentage
        self.input_voltage = 5.0 # Input (USB) Voltage
        self.charging = True
        
        if self.mock:
            print("✅ UPS Interface started in MOCK mode (Passive)")
            # In mock mode, we don't open a serial port.
            # Values remain at defaults unless updated externally or by a simulation hook.
            self.available = False  # Only becomes True when simulation script connects 
        else:
            try:
                import serial
                self.serial = serial.Serial(port, baudrate, timeout=1)
                self.available = True
                print(f"✅ UPS Serial connection opened on {port}")
                
                # Start a background thread to continuously read serial data
                self.read_thread = threading.Thread(target=self._read_serial_loop, daemon=True)
                self.read_thread.start()
                
            except ImportError:
                print("⚠️ pyserial not installed. Install with: pip install pyserial")
                self.available = False
            except Exception as e:
                print(f"⚠️ UPS Serial connection failed: {e}")
                self.available = False

    def _read_serial_loop(self):
        """
        Continuously reads lines from the serial port and parses them.
        Expected format (V3): "SmartUPS V3.1,Vin 5.10,BATCAP 100,Vout 5.10"
        """
        buffer = ""
        while self.available and self.serial.is_open:
            try:
                if self.serial.in_waiting > 0:
                    line = self.serial.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        self._parse_data(line)
                else:
                    time.sleep(0.1)
            except Exception as e:
                print(f"Error reading UPS serial: {e}")
                time.sleep(1)

    def _parse_data(self, line):
        """
        Parses the UART string from UPSPack V3.
        Example: "SmartUPS V3.1,Vin 5.10,BATCAP 100,Vout 5.10"
        """
        try:
            # Parse Input Voltage (Vin)
            vin_match = re.search(r'Vin\s*([0-9.]+)', line)
            if vin_match:
                self.input_voltage = float(vin_match.group(1))

            # Parse Battery Capacity (BATCAP)
            cap_match = re.search(r'BATCAP\s*([0-9]+)', line)
            if cap_match:
                self.capacity = float(cap_match.group(1))
            
            # Parse Battery Voltage (if available, Vbat isn't always in the standard string but Vout is)
            # Some versions send "Vbat X.XX"
            vbat_match = re.search(r'Vbat\s*([0-9.]+)', line)
            if vbat_match:
                self.voltage = float(vbat_match.group(1))
            
            # Infer charging status based on Input Voltage
            # If Vin > 4.5V, we are plugged in
            self.charging = self.input_voltage > 4.5
            
        except Exception as e:
            print(f"Error parsing UPS data '{line}': {e}")

    def get_status(self):
        """
        Returns dict with:
        - voltage (V)
        - capacity (%)
        - charging (bool)
        - input_voltage (V)
        """
        if not self.available:
            return {"available": False, "voltage": 0, "capacity": 0, "charging": False}
        
        return {
            "available": True,
            "voltage": self.voltage,
            "capacity": self.capacity,
            "charging": self.charging,
            "input_voltage": self.input_voltage
        }

    def check_power_loss(self):
        """
        Checks if power is lost and handles shutdown logic.
        Returns True if shutdown is imminent.
        """
        # This logic is now handled in the main app loop using get_status()
        pass
