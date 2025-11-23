import pytest
import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from ups import UPSInterface

class TestUPSInterface:
    def test_mock_initialization(self):
        """Test that UPS initializes in mock mode correctly."""
        ups = UPSInterface(mock=True)
        assert ups.available is False  # Mock mode starts as unavailable until simulation connects
        assert ups.mock is True

    @patch('serial.Serial')
    def test_serial_initialization_success(self, mock_serial):
        """Test successful serial connection."""
        ups = UPSInterface(mock=False)
        mock_serial.assert_called_once()
        assert ups.available is True

    @patch('serial.Serial')
    def test_serial_initialization_failure(self, mock_serial):
        """Test handling of serial connection failure."""
        mock_serial.side_effect = Exception("Connection failed")
        ups = UPSInterface(mock=False)
        assert ups.available is False

    def test_parsing_logic(self):
        """Test parsing of UPSPack V3 ASCII data."""
        ups = UPSInterface(mock=True)
        
        # Test standard line
        line = "SmartUPS V3.1,Vin 5.10,BATCAP 95,Vout 5.10"
        ups._parse_data(line)
        assert ups.input_voltage == 5.10
        assert ups.capacity == 95.0
        assert ups.charging is True # Vin > 4.5

        # Test power loss line (Vin low)
        line = "SmartUPS V3.1,Vin 0.00,BATCAP 90,Vout 3.70"
        ups._parse_data(line)
        assert ups.input_voltage == 0.00
        assert ups.charging is False

        # Test with Vbat if present
        line = "SmartUPS V3.1,Vin 5.00,BATCAP 100,Vbat 4.15"
        ups._parse_data(line)
        assert ups.voltage == 4.15

    def test_status_output(self):
        """Test the get_status dictionary structure."""
        ups = UPSInterface(mock=True)
        ups.voltage = 4.0
        ups.capacity = 80
        ups.input_voltage = 5.0
        ups.charging = True
        ups.available = True  # Must set available=True to get status
        
        status = ups.get_status()
        assert status['voltage'] == 4.0
        assert status['capacity'] == 80
        assert status['charging'] is True
        assert status['input_voltage'] == 5.0
