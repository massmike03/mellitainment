// Equalizer component tests
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import io from 'socket.io-client';
import Equalizer from '../components/Equalizer';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
        this.callback = callback;
    }
    observe(target) {
        // Trigger callback immediately with dummy dimensions
        this.callback([{ contentRect: { width: 100, height: 300 } }]);
    }
    unobserve() { }
    disconnect() { }
};

// Mock socket.io-client
vi.mock('socket.io-client', () => {
    const mSocket = { emit: vi.fn() };
    return { default: vi.fn(() => mSocket) };
});

describe('Equalizer component', () => {
    beforeEach(() => {
        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn()
        };
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });

        // Clear mock implementations
        vi.clearAllMocks();
    });

    test('loads with default Mellis preset and highlights it', () => {
        render(<Equalizer />);
        const mellisButton = screen.getByRole('button', { name: 'Mellis' });
        // Active preset should have greenish background (as defined in component)
        expect(mellisButton).toHaveStyle('background-color: rgba(16, 185, 129, 0.2)');
    });

    test('shows Reset button only after a change and emits eq_update', async () => {
        const { container } = render(<Equalizer />);
        // Initially Reset should not be in the document
        expect(screen.queryByRole('button', { name: /Reset/i })).not.toBeInTheDocument();

        // Change a slider (first band)
        await waitFor(() => {
            const firstSlider = container.querySelector('input[type="range"]');
            expect(firstSlider).toBeInTheDocument();
            fireEvent.change(firstSlider, { target: { value: '5' } });
        });

        // Reset button should appear
        const resetBtn = await screen.findByRole('button', { name: /Reset/i });
        expect(resetBtn).toBeInTheDocument();

        // eq_update should have been emitted twice: once on mount, once after change
        const mockSocket = io();
        expect(mockSocket.emit).toHaveBeenCalledWith('eq_update', expect.any(Object));
        // The last call should contain the updated band value
        const lastCallArg = mockSocket.emit.mock.calls[mockSocket.emit.mock.calls.length - 1][1];
        expect(lastCallArg.bands[0].gain).toBe(5);
    });
});
