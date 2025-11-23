import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Dashboard from './components/Dashboard';
import CarPlay from './components/CarPlay';
import Equalizer from './components/Equalizer';
import { LayoutDashboard, Smartphone, Settings, Battery, BatteryCharging, AudioLines } from 'lucide-react';
import logo from './assets/logo.png';

const socket = io('http://localhost:5001');

function App() {
  const [telemetry, setTelemetry] = useState({
    oil_pressure: 0,
    water_temp: 0,
    voltage: 0
  });
  const [config, setConfig] = useState(null);
  const [visualWarningsEnabled, setVisualWarningsEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [carplayStatus, setCarplayStatus] = useState('disconnected');
  const [showSplash, setShowSplash] = useState(true);
  const [isTelemetryStale, setIsTelemetryStale] = useState(false);
  const lastUpdateRef = useRef(Date.now());
  const mountTimeRef = useRef(Date.now());

  // Splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500); // Show splash for 3.5 seconds
    return () => clearTimeout(timer);
  }, []);

  // Monitor telemetry staleness
  useEffect(() => {
    const STALE_TIMEOUT = 2000; // 2 seconds without data = stale
    const STARTUP_GRACE_PERIOD = 5000; // 5 seconds grace on startup

    const checkInterval = setInterval(() => {
      const now = Date.now();
      // Ignore checks during grace period
      if (now - mountTimeRef.current < STARTUP_GRACE_PERIOD) return;

      if (now - lastUpdateRef.current > STALE_TIMEOUT) {
        setIsTelemetryStale(true);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  // Fetch configuration from backend
  useEffect(() => {
    fetch('http://localhost:5001/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setVisualWarningsEnabled(data.ui?.visual_warnings?.enabled ?? true);
      })
      .catch(err => console.error('Failed to load config:', err));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to backend');
    });

    socket.on('telemetry_update', (data) => {
      setTelemetry(prev => ({ ...prev, ...data }));
      lastUpdateRef.current = Date.now();
      setIsTelemetryStale(false);
    });

    return () => {
      socket.off('connect');
      socket.off('telemetry_update');
    };
  }, []);

  // Listen for CarPlay status updates
  useEffect(() => {
    const carplaySocket = io('http://localhost:5006');

    carplaySocket.on('status', (data) => {
      setCarplayStatus(data.status);
    });

    return () => {
      carplaySocket.disconnect();
    };
  }, []);

  if (showSplash) {
    return (
      <div className="splash-screen">
        <img src={logo} alt="MelliTainment" className="splash-logo" />
        <div className="splash-text">MelliTainment</div>
      </div>
    );
  }

  return (
    <div className="app-container fade-in">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="nav-group">
          {/* Nav Buttons */}
          <div className="nav-buttons">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`nav-btn ${activeTab === 'dashboard' ? 'active dashboard' : ''}`}
            >
              {activeTab === 'dashboard' && <div className="active-indicator dashboard" />}
              <LayoutDashboard size={32} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            </button>
            <button
              onClick={() => setActiveTab('carplay')}
              className={`nav-btn ${activeTab === 'carplay' ? 'active carplay' : ''}`}
            >
              {activeTab === 'carplay' && <div className="active-indicator carplay" />}
              <Smartphone size={32} strokeWidth={activeTab === 'carplay' ? 2.5 : 2} />
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`nav-btn ${activeTab === 'audio' ? 'active audio' : ''}`}
            >
              {activeTab === 'audio' && <div className="active-indicator audio" />}
              <AudioLines size={32} strokeWidth={activeTab === 'audio' ? 2.5 : 2} />
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`nav-btn ${activeTab === 'settings' ? 'active settings' : ''}`}
            >
              {activeTab === 'settings' && <div className="active-indicator settings" />}
              <Settings size={32} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            </button>
          </div>

          {/* Bottom section - Clock and UPS */}
          <div style={{ width: '100%' }}>
            {/* Clock - Hidden during CarPlay stream */}
            {!(carplayStatus === 'streaming' && activeTab === 'carplay') && (
              <div className="clock-container">
                <span className="clock-time">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s?[AP]M/, '')}
                </span>
                <span className="clock-ampm">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).match(/[AP]M/)[0]}
                </span>
              </div>
            )}

            {/* UPS Power Indicator - Always visible if UPS present */}
            {telemetry.ups && telemetry.ups.available && (
              <div className="ups-indicator" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: telemetry.ups.charging ? 'var(--accent-green)' : (telemetry.ups.capacity < 20 ? 'var(--accent-red)' : 'var(--text-secondary)'),
                fontSize: '0.75rem',
                fontWeight: '600',
                width: '100%',
                padding: '0.5rem 0',
                marginTop: '0.25rem'
              }}>
                {telemetry.ups.charging ? (
                  <BatteryCharging size={16} style={{ marginRight: '4px' }} />
                ) : (
                  <Battery size={16} style={{ marginRight: '4px' }} />
                )}
                <span>{Math.round(telemetry.ups.capacity)}%</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Background Ambient Glow */}
        <div className="ambient-glow"></div>

        {config && activeTab === 'dashboard' && (
          <Dashboard
            telemetry={telemetry}
            warningsEnabled={visualWarningsEnabled}
            config={config}
            isStale={isTelemetryStale}
          />
        )}

        {/* CarPlay - Always mounted to keep audio playing, but hidden when not active */}
        {config && (
          <div
            className="carplay-container"
            style={{ display: activeTab === 'carplay' ? 'flex' : 'none' }}
          >
            <CarPlay config={config} />
          </div>
        )}

        {activeTab === 'audio' && (
          <Equalizer />
        )}

        {activeTab === 'settings' && (
          <div className="settings-container">
            <div className="settings-icon-wrapper">
              <Settings size={64} className="text-muted" />
            </div>
            <h2 className="settings-title">System Settings</h2>

            <div className="settings-group" style={{ marginTop: '2rem', width: '100%', maxWidth: '400px' }}>
              <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                <div className="setting-label" style={{ marginRight: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Visual Warnings</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Flash gauges when limits exceeded</p>
                </div>
                <button
                  onClick={() => setVisualWarningsEnabled(!visualWarningsEnabled)}
                  style={{
                    width: '3rem',
                    height: '1.5rem',
                    backgroundColor: visualWarningsEnabled ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                    borderRadius: '9999px',
                    position: 'relative',
                    transition: 'background-color 0.3s ease',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '0.125rem',
                    left: visualWarningsEnabled ? 'calc(100% - 1.375rem)' : '0.125rem',
                    transition: 'left 0.3s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
