import random
import time

class SensorInterface:
    def __init__(self, mock=True, alpha=0.2, config=None):
        self.mock = mock
        self.alpha = alpha  # EMA smoothing factor
        self.config = config or {}  # Sensor calibration config
        
        # Store previous EMA values for each telemetry metric
        self._ema_values = {
            'oil_pressure': None,
            'water_temp': None,
            'voltage': None,
        }
        # In a real scenario, initialize I2C/ADC here
        if not mock:
            try:
                import board
                import busio
                import adafruit_ads1x15.ads1115 as ADS
                from adafruit_ads1x15.analog_in import AnalogIn
                
                i2c = busio.I2C(board.SCL, board.SDA)
                self.adc = ADS.ADS1115(i2c)
            except ImportError:
                print("Warning: ADC libraries not installed. Install with: pip install adafruit-circuitpython-ads1x15")
                self.mock = True
            except Exception as e:
                print(f"Warning: Could not initialize ADC: {e}. Falling back to mock mode.")
                self.mock = True
        
    def _oil_pressure_from_voltage(self, voltage):
        """Convert voltage to oil pressure using config calibration."""
        cfg = self.config.get('oil_pressure', {})
        if cfg.get('type') == 'linear':
            min_v = cfg.get('min_voltage', 0.0)
            max_v = cfg.get('max_voltage', 5.0)
            min_val = cfg.get('min_value', 0)
            max_val = cfg.get('max_value', 100)
            # Linear interpolation
            return min_val + (voltage - min_v) * (max_val - min_val) / (max_v - min_v)
        # Fallback to default
        return voltage * 20.0

    def _water_temp_from_voltage(self, voltage):
        """Convert voltage to water temperature using config calibration."""
        cfg = self.config.get('water_temp', {})
        if cfg.get('type') == 'linear':
            min_v = cfg.get('min_voltage', 0.0)
            max_v = cfg.get('max_voltage', 5.0)
            min_val = cfg.get('min_value', 50)
            max_val = cfg.get('max_value', 200)
            return min_val + (voltage - min_v) * (max_val - min_val) / (max_v - min_v)
        # Fallback to default
        return (voltage * 30.0) + 50.0

    def _battery_voltage_from_voltage(self, voltage):
        """Convert measured voltage to actual battery voltage using config."""
        cfg = self.config.get('voltage', {})
        if cfg.get('type') == 'voltage_divider':
            ratio = cfg.get('divider_ratio', 3.0)
            return voltage * ratio
        # Fallback to default
        return voltage * 3.0

    def _apply_ema(self, metric, raw_value):
        """Apply exponential moving average smoothing.
        If no previous EMA exists, initialize with the raw value.
        """
        prev = self._ema_values.get(metric)
        if prev is None:
            ema = raw_value
        else:
            ema = self.alpha * raw_value + (1 - self.alpha) * prev
        self._ema_values[metric] = ema
        return ema

    def read_voltage(self, channel):
        """Reads raw voltage from the ADC channel.
        
        Args:
            channel: ADC channel number (0-3)
            
        Returns:
            Voltage reading (0-5V range)
        """
        if self.mock:
            # Return a random voltage between 0 and 5V
            return random.uniform(0, 5.0)
        else:
            try:
                from adafruit_ads1x15.analog_in import AnalogIn
                import adafruit_ads1x15.ads1115 as ADS
                
                # Map channel numbers to ADS pins
                pins = [ADS.P0, ADS.P1, ADS.P2, ADS.P3]
                chan = AnalogIn(self.adc, pins[channel])
                
                # ADS1115 returns voltage directly
                return chan.voltage
            except Exception as e:
                print(f"Error reading ADC channel {channel}: {e}")
                return 0.0

    def get_telemetry(self):
        """Returns a dictionary of sensor readings converted to appropriate units with EMA smoothing."""
        if self.mock:
            # Simulate realistic raw voltages
            raw_oil = random.uniform(0, 5)
            raw_temp = random.uniform(0, 5)
            raw_volt = random.uniform(0, 5)
        else:
            raw_oil = self.read_voltage(0)
            raw_temp = self.read_voltage(1)
            raw_volt = self.read_voltage(2)

        # Convert raw voltages to physical units
        oil_pressure_raw = self._oil_pressure_from_voltage(raw_oil)
        water_temp_raw = self._water_temp_from_voltage(raw_temp)
        voltage_raw = self._battery_voltage_from_voltage(raw_volt)

        # Apply EMA smoothing
        oil_pressure = self._apply_ema('oil_pressure', oil_pressure_raw)
        water_temp = self._apply_ema('water_temp', water_temp_raw)
        voltage = self._apply_ema('voltage', voltage_raw)

        return {
            'oil_pressure': round(oil_pressure, 1),
            'water_temp': round(water_temp, 1),
            'voltage': round(voltage, 1)
        }
