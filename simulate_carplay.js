const io = require('socket.io-client');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const SERVER_URL = args[0] || 'http://localhost:5006';
const socket = io(SERVER_URL);

console.log('Connecting to CarPlay Server at', SERVER_URL);

socket.on('connect', () => {
    console.log('Connected to server. Starting simulation...');
    socket.emit('enable_simulation');

    // Start ffmpeg to generate a test pattern
    // -f lavfi -i testsrc=size=800x480:rate=60 : Generate test pattern
    // -c:v h264_videotoolbox : Use hardware acceleration on Mac (or libx264)
    // -f h264 : Output raw H.264 stream
    // pipe:1 : Output to stdout

    // Note: Using 'libx264' for broader compatibility if videotoolbox fails, 
    // but 'videotoolbox' is better for Mac. Let's try libx264 first for safety or just generic settings.
    // We need to tune for low latency.

    const ffmpeg = spawn('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'testsrc=size=800x480:rate=60',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-f', 'h264',
        '-'
    ]);

    ffmpeg.stdout.on('data', (data) => {
        socket.emit('simulation_video', data);
    });

    ffmpeg.stderr.on('data', (data) => {
        // console.error(`ffmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`ffmpeg process exited with code ${code}`);
        process.exit(0);
    });

    // Handle script exit
    process.on('SIGINT', () => {
        console.log('Stopping simulation...');
        ffmpeg.kill();
        process.exit();
    });
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});
