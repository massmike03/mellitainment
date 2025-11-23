import pytest
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_index_route(client):
    rv = client.get('/')
    assert b"Infotainment Backend Running" in rv.data

def test_config_endpoint(client):
    rv = client.get('/api/config')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert 'sensors' in data
    assert 'display' in data
