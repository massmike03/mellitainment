
import React from 'react';
import Gauge from './Gauge';
import { useWarnings } from '../hooks/useWarnings';

const Dashboard = ({ telemetry, warningsEnabled, config, isStale }) => {
    const thresholds = config?.sensors?.thresholds || {};
    const minDuration = config?.ui?.visual_warnings?.min_duration_ms || 5000;
    const warnings = useWarnings(telemetry, warningsEnabled, thresholds, minDuration);

    return (
        <div className="dashboard-container" style={{ position: 'relative' }}>
            {isStale && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 50,
                    backdropFilter: 'blur(2px)'
                }}>
                    <div style={{
                        color: 'var(--accent-red)',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        letterSpacing: '0.1em',
                        border: '2px solid var(--accent-red)',
                        padding: '1rem 2rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)'
                    }}>
                        NO SIGNAL
                    </div>
                </div>
            )}
            <div className="gauge-cluster" style={{
                opacity: isStale ? 0.5 : 1,
                filter: isStale ? 'grayscale(100%)' : 'none',
                transition: 'all 0.5s ease'
            }}>
                <Gauge
                    value={telemetry.oil_pressure}
                    min={0}
                    max={100}
                    label="Oil Press"
                    unit="PSI"
                    color="var(--accent-green)"
                    warning={warnings.oil_pressure}
                    thresholds={thresholds.oil_pressure}
                />
                <Gauge
                    value={telemetry.water_temp}
                    min={100}
                    max={250}
                    label="Water Temp"
                    unit="°F"
                    color="var(--accent-blue)"
                    warning={warnings.water_temp}
                    thresholds={thresholds.water_temp}
                />
                <Gauge
                    value={telemetry.voltage}
                    min={10}
                    max={16}
                    label="Voltage"
                    unit="V"
                    color="var(--accent-yellow)"
                    warning={warnings.voltage}
                    thresholds={thresholds.voltage}
                />
            </div>
        </div>
    );
};

export default Dashboard;
