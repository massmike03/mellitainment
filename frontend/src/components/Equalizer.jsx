import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import io from 'socket.io-client';

const socket = io('http://localhost:5001');

const VerticalSlider = ({ value, onChange, min = -12, max = 12, step = 1 }) => {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const observeTarget = containerRef.current;
        if (!observeTarget) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });

        resizeObserver.observe(observeTarget);
        return () => resizeObserver.disconnect();
    }, []);

    // We want the slider to be as wide as the container is tall
    // because we are rotating it 90 degrees.
    const sliderWidth = dimensions.height;

    return (
        <div
            ref={containerRef}
            style={{
                flexGrow: 1,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                minHeight: '0', // Crucial for flex child to shrink
                overflow: 'hidden' // Prevent overflow during resize
            }}
        >
            {sliderWidth > 0 && (
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={onChange}
                    orient="vertical" // Firefox support
                    className="eq-slider"
                    style={{
                        width: `${sliderWidth}px`,
                        height: '10px', // Track thickness
                        position: 'absolute',
                        transform: 'rotate(-90deg)',
                        transformOrigin: 'center',
                        cursor: 'pointer',
                        margin: 0,
                    }}
                />
            )}
        </div>
    );
};

const Equalizer = () => {
    // Presets definition
    const presets = {
        Mellis: [-10, 4, -2, -3, -3, 0, 0, 2, 2, 2],
        Rock: [5, 4, -1, -2, -1, 1, 3, 4, 4, 4],
        Jazz: [4, 3, 1, 2, -1, -1, 0, 1, 2, 3],
        Classical: [5, 4, 3, 2, -1, -1, 0, 2, 3, 4],
        Bass: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
        Treble: [0, 0, 0, 0, 0, 2, 4, 6, 8, 8],
    };

    // Load persisted preset or default to Mellis
    const storedPreset = typeof window !== 'undefined' ? localStorage.getItem('selectedPreset') : null;
    const initialPreset = storedPreset && presets[storedPreset] ? storedPreset : 'Mellis';

    const [activePreset, setActivePreset] = useState(initialPreset);
    const [bands, setBands] = useState(() => {
        const gains = presets[initialPreset];
        return [
            { freq: '60Hz', gain: gains[0] },
            { freq: '170Hz', gain: gains[1] },
            { freq: '310Hz', gain: gains[2] },
            { freq: '600Hz', gain: gains[3] },
            { freq: '1kHz', gain: gains[4] },
            { freq: '3kHz', gain: gains[5] },
            { freq: '6kHz', gain: gains[6] },
            { freq: '12kHz', gain: gains[7] },
            { freq: '14kHz', gain: gains[8] },
            { freq: '16kHz', gain: gains[9] },
        ];
    });

    // Persist selected preset whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('selectedPreset', activePreset);
        }
    }, [activePreset]);

    // Emit EQ values to backend whenever bands change
    useEffect(() => {
        socket.emit('eq_update', { bands });
    }, [bands]);

    const updateBand = (index, value) => {
        const newBands = [...bands];
        newBands[index].gain = value;
        setBands(newBands);
    };

    const applyPreset = (presetName) => {
        const gains = presets[presetName];
        const newBands = bands.map((band, i) => ({ ...band, gain: gains[i] }));
        setBands(newBands);
        setActivePreset(presetName);
    };

    // Reset toggles back to the currently selected preset
    const resetEQ = () => applyPreset(activePreset);

    // Determine if any band differs from the active preset
    const isModified = activePreset && bands.some((band, i) => band.gain !== presets[activePreset][i]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            padding: '1rem',
            gap: '1.5rem',
        }}>
            {/* Preset Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.keys(presets).map((preset) => {
                    const isActive = preset === activePreset;
                    return (
                        <button
                            key={preset}
                            onClick={() => applyPreset(preset)}
                            style={{
                                padding: '0.75rem 1.25rem',
                                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                border: isActive ? '1px solid var(--accent-green)' : '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '0.375rem',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {preset}
                        </button>
                    );
                })}
                {isModified && (
                    <button
                        onClick={resetEQ}
                        style={{
                            padding: '0.75rem 1.25rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid var(--accent-red)',
                            borderRadius: '0.375rem',
                            color: 'var(--accent-red)',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                        }}
                    >
                        <RotateCcw size={14} />
                        Reset
                    </button>
                )}
            </div>

            {/* EQ Sliders */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 1fr)',
                gap: '1rem',
                width: '100%',
                flex: 1,
                height: '100%',
                alignItems: 'stretch',
                padding: '1.5rem',
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.05)',
                minHeight: 0, // Important for flex container to allow shrinking
            }}>
                {bands.map((band, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: '100%',
                            minHeight: 0,
                            gap: '0.5rem',
                        }}
                    >
                        {/* Gain value */}
                        <span
                            style={{
                                fontSize: '0.875rem',
                                fontWeight: '700',
                                color: band.gain > 0 ? 'var(--accent-green)' : band.gain < 0 ? 'var(--accent-red)' : 'var(--text-secondary)',
                                minWidth: '2.5rem',
                                textAlign: 'center',
                            }}
                        >
                            {band.gain > 0 ? '+' : ''}{band.gain}
                        </span>

                        {/* Slider wrapper */}
                        <VerticalSlider
                            value={band.gain}
                            onChange={(e) => updateBand(index, parseInt(e.target.value))}
                        />

                        {/* Frequency label */}
                        <span
                            style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                                fontWeight: '600',
                                textAlign: 'center',
                            }}
                        >
                            {band.freq}
                        </span>
                    </div>
                ))}
            </div>

            {/* Slider custom styles */}
            <style>{`
        .eq-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          outline: none;
        }
        .eq-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--accent-green);
          cursor: pointer;
          box-shadow: 0 0 12px var(--accent-green-glow);
          margin-top: -7px; /* Centered: (10px track - 24px thumb) / 2 */
        }
        .eq-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--accent-green);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 12px var(--accent-green-glow);
        }
        .eq-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 5px;
        }
        .eq-slider::-moz-range-track {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 5px;
        }
      `}</style>
        </div>
    );
};

export default Equalizer;
