import { useState, useEffect, useRef } from 'react';

const DEFAULT_MIN_WARNING_DURATION = 5000; // 5 seconds in milliseconds

export const useWarnings = (telemetry, enabled = true, thresholds = {}, minDuration = DEFAULT_MIN_WARNING_DURATION) => {
    const [activeWarnings, setActiveWarnings] = useState({});
    const warningTimers = useRef({});

    useEffect(() => {
        if (!enabled) {
            setActiveWarnings({});
            return;
        }

        const checkWarnings = () => {
            const now = Date.now();
            setActiveWarnings(prev => {
                const next = { ...prev };
                let changed = false;

                Object.keys(thresholds).forEach(key => {
                    const value = telemetry[key];
                    const threshold = thresholds[key];
                    if (value === undefined || !threshold) return;

                    const isLow = threshold.min !== undefined && value < threshold.min;
                    const isHigh = threshold.max !== undefined && value > threshold.max;
                    const isTriggered = isLow || isHigh;

                    if (isTriggered) {
                        // Extend expiration
                        warningTimers.current[key] = now + minDuration;
                        if (!next[key]) {
                            next[key] = true;
                            changed = true;
                        }
                    } else {
                        // Check expiration
                        if (next[key] && now >= (warningTimers.current[key] || 0)) {
                            delete next[key];
                            changed = true;
                        }
                    }
                });

                return changed ? next : prev;
            });
        };

        checkWarnings();
        const interval = setInterval(checkWarnings, 500); // Check every 500ms
        return () => clearInterval(interval);

    }, [telemetry, enabled, thresholds, minDuration]);

    return activeWarnings;
};
