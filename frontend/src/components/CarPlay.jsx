import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import JMuxer from 'jmuxer';
import PCMPlayer from 'pcm-player';
import { Smartphone, AlertCircle } from 'lucide-react';

const CarPlay = ({ config }) => {
    const videoRef = useRef(null);
    const [status, setStatus] = useState('disconnected');
    const [jmuxer, setJmuxer] = useState(null);
    const socketRef = useRef(null);
    const playerRef = useRef(null);

    // Get CarPlay resolution from config
    const carplayWidth = config?.display?.width || 800;
    const carplayHeight = config?.display?.height || 480;

    useEffect(() => {
        let reconnectInterval;

        const connectToServer = () => {
            // Connect to the dedicated CarPlay streaming server
            // Dynamically determine hostname to support both Kiosk (localhost) and Remote (LAN) access
            const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
            // Priority: VITE_API_HOST -> mellis-pi.local (if localhost) -> hostname
            const targetHost = import.meta.env.VITE_API_HOST || (hostname === 'localhost' || hostname === '127.0.0.1' ? 'mellis-pi.local' : hostname);
            const port = config?.carplay?.port || 5006;
            const carplayUrl = `http://${targetHost}:${port}`;

            console.log(`Connecting to CarPlay Server at: ${carplayUrl}`);

            const socket = io(carplayUrl, {
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: Infinity
            });
            socketRef.current = socket;

            // Initialize PCM Player
            // 16-bit, 2-channel, 44.1kHz is standard for CarPlay
            playerRef.current = new PCMPlayer({
                inputCodec: 'Int16',
                channels: 2,
                sampleRate: 44100,
                flushTime: 2000
            });

            socket.on('connect', () => {
                console.log('Connected to CarPlay Server');
                setStatus('connected');
                // Clear reconnection interval on successful connection
                if (reconnectInterval) {
                    clearInterval(reconnectInterval);
                    reconnectInterval = null;
                }
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from CarPlay Server');
                setStatus('disconnected');
                // Start reconnection attempts
                if (!reconnectInterval) {
                    reconnectInterval = setInterval(() => {
                        console.log('Attempting to reconnect...');
                        if (!socket.connected) {
                            socket.connect();
                        }
                    }, 3000);
                }
            });

            socket.on('status', (data) => {
                console.log('Received Status:', data);
                if (data.status === 'waiting_for_device') {
                    setStatus('waiting');
                } else {
                    setStatus(data.status);
                }
            });

            // Initialize JMuxer
            if (videoRef.current) {
                const muxer = new JMuxer({
                    node: videoRef.current,
                    mode: 'video',
                    flushingTime: 0,
                    fps: config?.display?.fps || 60,
                    debug: false,
                });
                setJmuxer(muxer);

                socket.on('video', (data) => {
                    // feed video data to jmuxer
                    // data is expected to be a Buffer or ArrayBuffer
                    muxer.feed({
                        video: new Uint8Array(data)
                    });
                    // Update status to streaming when we receive video
                    if (status !== 'streaming') {
                        setStatus('streaming');
                    }
                });

                socket.on('audio', (data) => {
                    // feed audio data to pcm-player
                    if (playerRef.current) {
                        playerRef.current.feed(new Uint8Array(data));
                    }
                });
            }
        };

        connectToServer();

        return () => {
            if (reconnectInterval) clearInterval(reconnectInterval);
            if (socketRef.current) socketRef.current.disconnect();
            if (jmuxer) jmuxer.destroy();
            if (playerRef.current) playerRef.current.destroy();
        };
    }, [config]);

    const handleTouch = (e) => {
        if (!socketRef.current) return;

        const rect = videoRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Normalize coordinates to 0-1 range (CarPlay expects normalized coords)
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;

        console.log(`Touch: click(${Math.round(x)}, ${Math.round(y)}) -> normalized(${normalizedX.toFixed(3)}, ${normalizedY.toFixed(3)})`);

        // Send 'down' and 'up' to simulate a tap
        socketRef.current.emit('click', { type: 14, x: normalizedX, y: normalizedY }); // 14 = Touch Down
        setTimeout(() => {
            socketRef.current.emit('click', { type: 16, x: normalizedX, y: normalizedY }); // 16 = Touch Up
        }, 100);
    };

    console.log('CarPlay Render Status:', status);

    return (
        <div className="carplay-wrapper">
            {status !== 'streaming' && (
                <div className="carplay-status-overlay">
                    {status === 'disconnected' && (
                        <div className="status-message">
                            <AlertCircle className="status-icon error" />
                            <h2 className="status-title">CarPlay Server Disconnected</h2>
                            <p className="status-subtitle">Check if the backend is running.</p>
                        </div>
                    )}
                    {status === 'waiting' && (
                        <div className="status-message animate-pulse">
                            <Smartphone className="status-icon waiting" />
                            <h2 className="status-title">Connect your iPhone.</h2>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="status-message">
                            <AlertCircle className="status-icon error" />
                            <h2 className="status-title">Hardware Error</h2>
                            <p className="status-subtitle">Dongle not detected or power issue.</p>
                        </div>
                    )}
                    {status === 'connecting' && (
                        <div className="status-message animate-pulse">
                            <Smartphone className="status-icon waiting" />
                            <h2 className="status-title">Starting Dongle...</h2>
                            <p className="status-subtitle">Please wait.</p>
                        </div>
                    )}
                    {status === 'connected' && (
                        <div className="status-message">
                            <Smartphone className="status-icon waiting" />
                            <h2 className="status-title">Connected to Server</h2>
                            <p className="status-subtitle">Waiting for status...</p>
                        </div>
                    )}
                </div>
            )}

            <video
                ref={videoRef}
                className="carplay-video"
                autoPlay
                muted // Muted because we play audio via PCMPlayer
                onClick={handleTouch}
            // Add touch handlers for better mobile support
            // onTouchStart={...}
            />
        </div>
    );
};

export default CarPlay;
