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
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"]
    }
});

// Initialize CarPlay Node
let carplay;
try {
    carplay = new CarplayNode(CARPLAY_CONFIG);
    // Validate that the object has the required methods
    if (!carplay || typeof carplay.on !== 'function') {
        console.error("CarPlayNode initialized but missing required methods");
        carplay = undefined;
    }
} catch (e) {
    console.error("Failed to initialize CarPlayNode (Hardware likely missing):", e.message);
    carplay = undefined;
}

io.on('connection', (socket) => {
    console.log('Frontend connected to CarPlay Stream');

    if (carplay) {
        // Real hardware mode
        carplay.on('video', (data) => {
            io.emit('video', data);
        });

        carplay.on('audio', (data) => {
            io.emit('audio', data);
        });

        carplay.on('status', (data) => {
            console.log('CarPlay status:', data);
            // Relay all status changes to all clients
            io.emit('status', data);
        });

        // Handle input events from frontend
        socket.on('click', (data) => {
            carplay.sendTouch(data.type, data.x, data.y);
        });

        carplay.start();
    } else {
        // Mock mode - no hardware
        console.log("No hardware detected. Waiting for simulation or device...");
        socket.emit('status', { status: 'waiting_for_device' });
    }

    // Handle simulation video from a simulator client
    socket.on('simulation_video', (data) => {
        // Mark this socket as a simulator
        socket.isSimulator = true;
        // Broadcast to all other clients (frontend)
        socket.broadcast.emit('video', data);
        // Also update status to streaming if not already
        socket.broadcast.emit('status', { status: 'streaming' });
    });

    socket.on('enable_simulation', () => {
        console.log("Simulation enabled by client");
        socket.isSimulator = true;
    });

    socket.on('disconnect', () => {
        console.log('Frontend disconnected');
        // If this was a simulator, notify other clients to go back to waiting
        if (socket.isSimulator) {
            console.log('Simulator disconnected, resetting to waiting state');
            io.emit('status', { status: 'waiting_for_device' });
        }
        if (carplay) {
            // carplay.stop(); 
        }
    });
});

server.listen(PORT, () => {
    console.log(`CarPlay Stream Server running on port ${PORT}`);
});
