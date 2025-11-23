import React from 'react';

const Gauge = ({ value, min, max, label, unit, color, warning, thresholds }) => {
    const radius = 80;
    const stroke = 12;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;

    // Track peak value
    const [peak, setPeak] = React.useState(min);

    // Update peak if value exceeds it
    React.useEffect(() => {
        if (value > peak) {
            setPeak(value);
        }
    }, [value, peak]);

    // Reset peak on click
    const handleResetPeak = () => {
        setPeak(value);
    };

    // Clamp value between min and max
    const clampedValue = Math.min(Math.max(value, min), max);
    const clampedPeak = Math.min(Math.max(peak, min), max);

    // Calculate percentage (0 to 1)
    const percentage = (clampedValue - min) / (max - min);
    const peakPercentage = (clampedPeak - min) / (max - min);

    // Calculate stroke dash offset
    // We want to fill 270 degrees (0.75 of full circle)
    const maxArcLength = circumference * 0.75;
    const strokeDashoffset = circumference - (maxArcLength * percentage);

    // Calculate rotation for the needle/glow
    // Start at 135 degrees (bottom left)
    // Sweep 270 degrees
    const rotation = 135 + (percentage * 270);

    // Calculate rotation for peak indicator
    const peakRotation = 135 + (peakPercentage * 270);

    // Generate tick marks
    const numTicks = 30; // Adjusted density
    const ticks = [];
    for (let i = 0; i <= numTicks; i++) {
        // Fix: Match the arc's rotation logic.
        // Arc starts at 135deg and sweeps 270deg.
        // So 0% = 135deg, 100% = 135 + 270 = 405deg (or 45deg)
        const tickAngle = 135 + (i / numTicks) * 270;

        const isMajor = i % 5 === 0;
        const tickLength = isMajor ? 10 : 6;

        // Calculate value at this tick
        const tickValue = min + (i / numTicks) * (max - min);

        // Check if this tick is in a warning zone
        let isWarningZone = false;
        if (thresholds) {
            if (thresholds.min !== undefined && tickValue <= thresholds.min) isWarningZone = true;
            if (thresholds.max !== undefined && tickValue >= thresholds.max) isWarningZone = true;
        }

        // Convert polar to cartesian
        // cx, cy are 100, 100
        const angleRad = (tickAngle * Math.PI) / 180;
        const innerR = radius - stroke - 10;
        const outerR = innerR + tickLength;

        const x1 = 100 + innerR * Math.cos(angleRad);
        const y1 = 100 + innerR * Math.sin(angleRad);
        const x2 = 100 + outerR * Math.cos(angleRad);
        const y2 = 100 + outerR * Math.sin(angleRad);

        ticks.push(
            <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isWarningZone ? "var(--accent-red)" : "rgba(255,255,255,0.3)"}
                strokeWidth={isWarningZone ? 2 : (isMajor ? 2 : 1)}
                style={{ opacity: isWarningZone ? 0.8 : 0.3 }}
            />
        );
    }

    // Calculate zero position for the indicator circle
    // 135 degrees at radius
    const zeroAngleRad = (135 * Math.PI) / 180;
    const zeroX = 100 + normalizedRadius * Math.cos(zeroAngleRad);
    const zeroY = 100 + normalizedRadius * Math.sin(zeroAngleRad);

    // Calculate peak indicator position (for a dot/line at the tip)
    // We'll use a rotated line instead of calculating coordinates for simplicity in SVG rotation

    return (
        <div
            className={`gauge-container ${warning ? 'warning' : ''}`}
            onClick={handleResetPeak}
            style={{ cursor: 'pointer' }}
            title="Click to reset peak"
        >
            <div className="gauge-wrapper">
                {/* Glow effect behind the gauge */}
                <div
                    className="gauge-glow"
                    style={{
                        background: `conic-gradient(from 225deg at 50% 50%, ${color} 0deg, ${color} ${percentage * 270}deg, transparent ${percentage * 270}deg)`,
                        opacity: warning ? 0.8 : 0
                    }}
                />

                <svg
                    viewBox="0 0 200 200"
                    className="gauge-svg"
                >
                    {/* Background Track */}
                    <circle
                        className="gauge-track"
                        strokeWidth={stroke}
                        r={normalizedRadius}
                        cx="100"
                        cy="100"
                        style={{
                            strokeDasharray: `${circumference} ${circumference}`,
                            strokeDashoffset: circumference - (circumference * 0.75),
                            transform: 'rotate(135deg)',
                            transformOrigin: '100px 100px'
                        }}
                    />

                    {/* Ticks */}
                    {ticks}

                    {/* Zero Indicator (visible when value is 0) */}
                    <circle
                        cx={zeroX}
                        cy={zeroY}
                        r={stroke / 2}
                        fill={warning ? 'var(--accent-red)' : color}
                        style={{
                            opacity: warning ? 1 : 0.5,
                            filter: warning ? 'drop-shadow(0 0 5px var(--accent-red))' : 'none'
                        }}
                    />

                    {/* Active Arc */}
                    <circle
                        className="gauge-arc"
                        stroke={warning ? 'var(--accent-red)' : color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        r={normalizedRadius}
                        cx="100"
                        cy="100"
                        style={{
                            strokeDasharray: `${circumference} ${circumference}`,
                            strokeDashoffset: strokeDashoffset,
                            transform: 'rotate(135deg)',
                            transformOrigin: '100px 100px',
                            filter: warning ? 'drop-shadow(0 0 10px var(--accent-red))' : `drop-shadow(0 0 5px ${color})`
                        }}
                    />

                    {/* Peak Indicator */}
                    <line
                        x1={100 + normalizedRadius - stroke / 2}
                        y1="100"
                        x2={100 + normalizedRadius + stroke / 2}
                        y2="100"
                        stroke="white"
                        strokeWidth="2"
                        style={{
                            transform: `rotate(${peakRotation}deg)`,
                            transformOrigin: '100px 100px',
                            opacity: 0.8,
                            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))',
                            transition: 'transform 0.3s ease-out'
                        }}
                    />
                </svg>

                {/* Value Display */}
                <div className="gauge-value-container">
                    <span className={`gauge-value ${warning ? 'text-red-500' : ''}`} style={{ color: warning ? 'var(--accent-red)' : 'white' }}>
                        {Math.round(value)}
                    </span>
                    <span className="gauge-unit">{unit}</span>
                </div>
            </div>
            <span className="gauge-label">{label}</span>
        </div>
    );
};

export default Gauge;
