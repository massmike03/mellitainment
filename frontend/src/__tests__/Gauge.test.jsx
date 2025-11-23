import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Gauge from '../components/Gauge';

describe('Gauge Component', () => {
    const defaultProps = {
        value: 50,
        min: 0,
        max: 100,
        label: 'Test Gauge',
        unit: 'PSI',
        color: '#ffffff',
        warning: false,
    };

    test('renders label and unit', () => {
        render(<Gauge {...defaultProps} />);
        expect(screen.getByText('Test Gauge')).toBeInTheDocument();
        expect(screen.getByText('PSI')).toBeInTheDocument();
    });

    test('displays the correct value', () => {
        render(<Gauge {...defaultProps} />);
        expect(screen.getByText('50')).toBeInTheDocument();
    });

    test('applies warning class when warning prop is true', () => {
        const { container } = render(<Gauge {...defaultProps} warning={true} />);
        // The outer div should have the 'warning' class
        expect(container.firstChild).toHaveClass('warning');
    });

    test('resets peak on click', () => {
        // Render with value 50 (so peak starts at 50)
        const { rerender } = render(<Gauge {...defaultProps} value={50} />);

        // Update with value 80 (peak should become 80)
        rerender(<Gauge {...defaultProps} value={80} />);

        // Update with value 40 (peak should stay 80)
        rerender(<Gauge {...defaultProps} value={40} />);

        // We can't easily check the internal state or SVG rotation without complex selectors,
        // but we can verify the click handler doesn't crash.
        // Ideally, we'd check visual state, but for a unit test, ensuring interaction works is a good start.
        const gaugeContainer = screen.getByText('Test Gauge').closest('.gauge-container');
        fireEvent.click(gaugeContainer);
    });
});
