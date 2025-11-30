import CarplayNode from 'node-carplay/node';
import { Server } from 'socket.io';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load centralized configuration
const configPath = path.join(__dirname, '..', 'config', 'config.json');
const configData = fs.readFileSync(configPath, 'utf8');
const CONFIG = JSON.parse(configData);

// CarPlay configuration from config file
const PORT = CONFIG.carplay.port;
const CARPLAY_CONFIG = CONFIG.carplay.config;

// Setup HTTP and Socket.IO server
const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let carplay;
let eventEmitter;
let currentStatus = { status: 'disconnected' };

function updateStatus(newStatus) {
    currentStatus = newStatus;
    io.emit('status', currentStatus);
}

function setupCarPlay() {
    try {
        // Handle ESM/CJS interop
        let CNode = CarplayNode;
        if (CNode && CNode.default) {
            CNode = CNode.default;
        }

        console.log("Initializing CarPlayNode with config:", CARPLAY_CONFIG);
        carplay = new CNode(CARPLAY_CONFIG);

        // Determine Event Emitter (Instance vs DongleDriver)
        if (typeof carplay.on === 'function') {
            eventEmitter = carplay;
        } else if (carplay.dongleDriver && typeof carplay.dongleDriver.on === 'function') {
            console.log("⚠️ Instance missing 'on()', using carplay.dongleDriver for events.");
            eventEmitter = carplay.dongleDriver;
        } else {
            console.error("❌ CRITICAL: Could not find event emitter on CarPlay instance!");
            console.log("Instance keys:", Object.keys(carplay));
            return;
        }

        // CarplayNode uses onmessage callback pattern for some events
        // Bridge it to our event system
        carplay.onmessage = (message) => {
            const { type, message: payload } = message;
            console.log(`📬 onmessage callback: type=${type}`);

            switch (type) {
                case 'video':
                    // payload is a VideoData message object - emit the actual data buffer
                    eventEmitter.emit('video', payload.data);
                    break;
                case 'audio':
                    // payload is an AudioData message object - emit the actual data buffer
                    eventEmitter.emit('audio', payload.data);
                    break;
                case 'status':
                    eventEmitter.emit('status', payload);
                    break;
                case 'plugged':
                    console.log('📱 Phone plugged in');
                    break;
                case 'unplugged':
                    console.log('📱 Phone unplugged');
                    eventEmitter.emit('quit');
                    break;
                default:
                    console.log(`   Other message type: ${type}`);
            }
        };

        // Attach Global Listeners (Only once!)
        eventEmitter.on('video', (data) => {
            io.emit('video', data);
            // Implicitly streaming if video is flowing
            if (currentStatus.status !== 'streaming') {
                console.log('✅ VIDEO STREAM STARTED - CarPlay connection successful!');
                updateStatus({ status: 'streaming' });
            }
        });

        eventEmitter.on('audio', (data) => {
            io.emit('audio', data);
            if (currentStatus.status === 'waiting_for_device' || currentStatus.status === 'connecting') {
                console.log('✅ AUDIO STREAM STARTED');
            }
        });

        eventEmitter.on('status', (data) => {
            console.log('CarPlay Status:', data);
            updateStatus(data);
        });

        eventEmitter.on('quit', () => {
            console.log('CarPlay Quit Event');
            updateStatus({ status: 'disconnected' });
        });

        // Log errors
        eventEmitter.on('error', (err) => {
            console.error('CarPlay Error:', err);
            if (err && (err.toString().includes('LIBUSB_ERROR_NO_DEVICE') || err.toString().includes('LIBUSB_TRANSFER_ERROR'))) {
                console.error("❌ Device disconnected. Killing process to trigger restart...");
                process.kill(process.pid, 'SIGKILL');
            }
        });

        eventEmitter.on('failure', () => {
            console.error("❌ DongleDriver reported failure. Killing process to trigger restart...");
            process.kill(process.pid, 'SIGKILL');
        });

        // Add generic message listener to see ALL messages received
        eventEmitter.on('message', (message) => {
            const messageType = message?.constructor?.name || 'Unknown';
            console.log(`📨 Received message: ${messageType}`);

            // Log specific types we care about
            if (messageType === 'VideoData') {
                console.log('🎥 VideoData message received - should trigger video stream!');
            } else if (messageType === 'AudioData') {
                console.log('🔊 AudioData message received');
            } else if (messageType.includes('UI') || messageType.includes('Plugin')) {
                console.log(`   ℹ️  UI/Plugin message (${messageType}) - acknowledged`);
            }
        });

        const startCarPlay = async () => {
            console.log(`🚀 Starting CarPlay Node...`);
            try {
                // Notify frontend we are trying to connect
                updateStatus({ status: 'connecting', message: `Initializing Dongle...` });

                // Give USB bus a moment to settle
                await new Promise(resolve => setTimeout(resolve, 1000));

                await carplay.start();
                console.log("✅ CarPlay Node started successfully");
                console.log("📱 Waiting for iPhone connection...");
                console.log("ℹ️  Note: 'Unknown message type' warnings may appear - these are often non-blocking");
                // Reset status to waiting for device once started
                updateStatus({ status: 'waiting_for_device' });
            } catch (err) {
                console.error("❌ Error starting CarPlay Node:", err.message);
                console.log("⏳ Retrying in 5 seconds...");
                updateStatus({ status: 'error', message: 'Dongle not found. Retrying...' });
                setTimeout(() => startCarPlay(), 5000);
            }
        };

        startCarPlay();

    } catch (e) {
        console.error("❌ Failed to initialize CarPlayNode:", e.message);
        console.error(e.stack);
        carplay = undefined;
    }
}

// Initialize on startup
setupCarPlay();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send current status immediately
    socket.emit('status', currentStatus);

    if (carplay) {
        // Handle input events from frontend
        socket.on('click', (data) => {
            if (carplay && typeof carplay.sendTouch === 'function') {
                console.log(`🖱️  Touch: type=${data.type}, x=${data.x.toFixed(3)}, y=${data.y.toFixed(3)}`);
                // sendTouch expects { type, x, y } object
                carplay.sendTouch(data);
            }
        });
    } else {
        // Mock mode - no hardware
        // socket.emit('status', { status: 'waiting_for_device' }); // Handled by currentStatus above
    }

    // Handle simulation video from a simulator client
    socket.on('simulation_video', (data) => {
        socket.isSimulator = true;
        socket.broadcast.emit('video', data);
        socket.broadcast.emit('status', { status: 'streaming' });
    });

    socket.on('enable_simulation', () => {
        console.log("Simulation enabled by client");
        socket.isSimulator = true;
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (socket.isSimulator) {
            console.log('Simulator disconnected, resetting status');
            io.emit('status', { status: 'waiting_for_device' });
        }
    });
});

server.listen(PORT, () => {
    console.log(`CarPlay Stream Server running on port ${PORT}`);
});

// Prevent crashes
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
