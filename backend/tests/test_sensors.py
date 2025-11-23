import pytest
import sys
import os
from pathlib import Path

# Add backend to path so we can import sensors
sys.path.append(str(Path(__file__).parent.parent))

from sensors import SensorInterface

class TestSensorInterface:
    @pytest.fixture
    def sensor_interface(self):
        # Initialize with mock=True and a known alpha for testing smoothing
        config = {
            'oil_pressure': {'type': 'linear', 'min_voltage': 0, 'max_voltage': 5, 'min_value': 0, 'max_value': 100},
            'water_temp': {'type': 'linear', 'min_voltage': 0, 'max_voltage': 5, 'min_value': 50, 'max_value': 200},
            'voltage': {'type': 'voltage_divider', 'divider_ratio': 3.0}
        }
        return SensorInterface(mock=True, alpha=0.5, config=config)

    def test_initialization(self, sensor_interface):
        assert sensor_interface.mock is True
        assert sensor_interface.alpha == 0.5

    def test_voltage_conversion_oil(self, sensor_interface):
        # Linear mapping: 0V=0PSI, 5V=100PSI. 2.5V should be 50PSI
        pressure = sensor_interface._oil_pressure_from_voltage(2.5)
        assert pressure == 50.0

    def test_voltage_conversion_temp(self, sensor_interface):
        # Linear mapping: 0V=50F, 5V=200F. 2.5V should be 125F
        temp = sensor_interface._water_temp_from_voltage(2.5)
        assert temp == 125.0

    def test_voltage_conversion_battery(self, sensor_interface):
        # Divider ratio 3.0. 4V input should be 12V battery
        volts = sensor_interface._battery_voltage_from_voltage(4.0)
        assert volts == 12.0

    def test_ema_smoothing(self, sensor_interface):
        # Alpha is 0.5
        # First value should be taken as is
        val1 = sensor_interface._apply_ema('test_metric', 10.0)
        assert val1 == 10.0

        # Second value: 0.5 * 20 + 0.5 * 10 = 15
        val2 = sensor_interface._apply_ema('test_metric', 20.0)
        assert val2 == 15.0

        # Third value: 0.5 * 20 + 0.5 * 15 = 17.5
        val3 = sensor_interface._apply_ema('test_metric', 20.0)
        assert val3 == 17.5

    def test_get_telemetry_structure(self, sensor_interface):
        telemetry = sensor_interface.get_telemetry()
        assert 'oil_pressure' in telemetry
        assert 'water_temp' in telemetry
        assert 'voltage' in telemetry
        assert isinstance(telemetry['oil_pressure'], (int, float))
