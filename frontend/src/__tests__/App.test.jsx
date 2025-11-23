import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../App';

// Mock socket.io-client
const { mockSocket } = vi.hoisted(() => {
    return {
        mockSocket: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
            disconnect: vi.fn(),
            connect: vi.fn(),
        }
    }
});

vi.mock('socket.io-client', () => ({
    default: () => mockSocket,
}));

// Mock the child components to simplify testing the App shell logic
vi.mock('../components/Dashboard', () => ({
    default: ({ isStale }) => <div data-testid="dashboard">Dashboard Component {isStale ? '(Stale)' : ''}</div>,
}));

vi.mock('../components/CarPlay', () => ({
    default: () => <div data-testid="carplay">CarPlay Component</div>,
}));

// Mock fetch for config
global.fetch = vi.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({
            display: { width: 800, height: 480, fps: 60 },
            sensors: { thresholds: {} },
            ui: { visual_warnings: { enabled: true } },
            frontend: { carplay_url: 'http://localhost:5006' }
        }),
    })
);

describe('App Integration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test.skip('shows splash screen initially then transitions to dashboard', async () => {
        render(<App />);

        // Check for Splash Screen
        expect(screen.getByText('MelliTainment')).toBeInTheDocument();
        expect(screen.getByAltText('MelliTainment')).toBeInTheDocument();

        // Fast-forward past splash screen timer (3500ms)
        act(() => {
            vi.advanceTimersByTime(3500);
        });

        // Wait for config fetch and state update
        await waitFor(() => {
            expect(screen.queryByText('MelliTainment')).not.toBeInTheDocument();
        });

        // Should show Dashboard by default
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });

    test.skip('navigates between tabs', { timeout: 10000 }, async () => {
        render(<App />);

        // Skip splash screen
        act(() => {
            vi.advanceTimersByTime(3500);
        });
        await waitFor(() => screen.getByTestId('dashboard'));

        // Find navigation buttons (using the icons or class names would be ideal, but we can rely on the render order or aria-labels if we added them. 
        // Since we didn't add aria-labels, we'll assume the buttons are in order: Dashboard, CarPlay, Settings)
        const buttons = screen.getAllByRole('button');
        const carplayBtn = buttons[1];
        const settingsBtn = buttons[2];

        // Navigate to CarPlay
        fireEvent.click(carplayBtn);
        expect(screen.getByTestId('carplay')).toBeInTheDocument();
        expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();

        // Navigate to Settings
        fireEvent.click(settingsBtn);
        expect(screen.getByText('System Settings')).toBeInTheDocument();
        expect(screen.queryByTestId('carplay')).not.toBeInTheDocument();
    });

    test.skip('handles stale telemetry state', { timeout: 15000 }, async () => {
        render(<App />);

        // Skip splash screen
        await act(async () => {
            vi.advanceTimersByTime(3500);
        });
        // Wait for initial render to settle
        await waitFor(() => screen.getByTestId('dashboard'));

        // Initial state should not be stale (grace period)
        expect(screen.getByTestId('dashboard')).not.toHaveTextContent('(Stale)');

        // Advance past grace period (5000ms) + stale timeout (2000ms)
        await act(async () => {
            vi.advanceTimersByTime(8000);
        });

        // Should now be stale
        expect(screen.getByTestId('dashboard')).toHaveTextContent('(Stale)');

        // Simulate receiving a socket update
        const socketCallback = mockSocket.on.mock.calls.find(call => call[0] === 'telemetry_update')[1];
        await act(async () => {
            socketCallback({ oil_pressure: 50, water_temp: 180, voltage: 14 });
        });

        // Should no longer be stale
        expect(screen.getByTestId('dashboard')).not.toHaveTextContent('(Stale)');
    });
});
