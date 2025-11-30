import os

content = r"""import { webusb } from 'usb';
import NodeMicrophone from './NodeMicrophone.js';
import { AudioData, MediaData, Plugged, SendAudio, SendCommand, SendTouch, Unplugged, VideoData, DongleDriver, DEFAULT_CONFIG, Command, AudioCommand, } from '../modules/index.js';
const USB_WAIT_PERIOD_MS = 3000;
export default class CarplayNode {
    _pairTimeout = null;
    _frameInterval = null;
    _config;
    dongleDriver;
    constructor(config) {
        this._config = Object.assign({}, DEFAULT_CONFIG, config);
        const mic = new NodeMicrophone();
        const driver = new DongleDriver();
        mic.on('data', data => {
            driver.send(new SendAudio(data));
        });
        driver.on('message', (message) => {
            if (message instanceof Plugged) {
                this.clearPairTimeout();
                this.clearFrameInterval();
                const phoneTypeConfg = this._config.phoneConfig?.[message.phoneType];
                if (phoneTypeConfg?.frameInterval) {
                    this._frameInterval = setInterval(() => {
                        this.dongleDriver.send(new SendCommand('frame'));
                    }, phoneTypeConfg?.frameInterval);
                }
                this.onmessage?.({ type: 'plugged' });
            }
            else if (message instanceof Unplugged) {
                this.onmessage?.({ type: 'unplugged' });
            }
            else if (message instanceof VideoData) {
                this.clearPairTimeout();
                this.onmessage?.({ type: 'video', message });
            }
            else if (message instanceof AudioData) {
                this.clearPairTimeout();
                this.onmessage?.({ type: 'audio', message });
            }
            else if (message instanceof MediaData) {
                this.clearPairTimeout();
                this.onmessage?.({ type: 'media', message });
            }
            else if (message instanceof Command) {
                this.onmessage?.({ type: 'command', message });
            }
            // Trigger internal event logic
            if (message instanceof AudioData && message.command != null) {
                switch (message.command) {
                    case AudioCommand.AudioSiriStart:
                    case AudioCommand.AudioPhonecallStart:
                        mic.start();
                        break;
                    case AudioCommand.AudioSiriStop:
                    case AudioCommand.AudioPhonecallStop:
                        mic.stop();
                        break;
                }
            }
        });
        driver.on('failure', () => {
            this.onmessage?.({ type: 'failure' });
        });
        this.dongleDriver = driver;
    }
    async findDevice() {
        let device = null;
        while (device == null) {
            try {
                device = await webusb.requestDevice({
                    filters: DongleDriver.knownDevices,
                });
            }
            catch (err) {
                // ^ requestDevice throws an error when no device is found, so keep retrying
            }
            if (device == null) {
                console.log('No device found, retrying');
                await new Promise(resolve => setTimeout(resolve, USB_WAIT_PERIOD_MS));
            }
        }
        return device;
    }
    start = async () => {
        // Find device to "reset" first
        let device = await this.findDevice();
        await device.open();
        
        // Reset device to ensure fresh state (SPS/PPS headers)
        // On Linux/Pi, this causes a disconnect/reconnect cycle that takes time.
        console.log('Resetting device...');
        await device.reset();
        await device.close();

        // Wait for re-enumeration
        // Linux needs more time (10s) to avoid LIBUSB_ERROR_NOT_FOUND
        const waitTime = process.platform === 'linux' ? 10000 : USB_WAIT_PERIOD_MS;
        console.log(`Reset done, waiting ${waitTime}ms for re-enumeration...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Retry finding device loop
        let retries = 0;
        const maxRetries = 5;
        while (retries < maxRetries) {
            try {
                device = await this.findDevice();
                if (device) break;
            } catch (e) {
                console.log(`Device not found yet (attempt ${retries + 1}/${maxRetries})...`);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries++;
        }

        if (!device) {
            throw new Error("Failed to find device after reset");
        }

        console.log('Device found & opening...');
        await device.open();

        let initialised = false;
        try {
            const { initialise, start, send } = this.dongleDriver;
            await initialise(device);
            await start(this._config);
            this._pairTimeout = setTimeout(() => {
                console.debug('no device, sending pair');
                send(new SendCommand('wifiPair'));
            }, 15000);
            initialised = true;
        }
        catch (err) {
            console.error(err);
        }
        if (!initialised) {
            console.log('carplay not initialised, retrying in 2s');
            setTimeout(this.start, 2000);
        }
    };
    stop = async () => {
        try {
            this.clearPairTimeout();
            this.clearFrameInterval();
            await this.dongleDriver.close();
        }
        catch (err) {
            console.error(err);
        }
    };
    clearPairTimeout() {
        if (this._pairTimeout) {
            clearTimeout(this._pairTimeout);
            this._pairTimeout = null;
        }
    }
    clearFrameInterval() {
        if (this._frameInterval) {
            clearInterval(this._frameInterval);
            this._pairTimeout = null;
        }
    }
    sendKey = (action) => {
        this.dongleDriver.send(new SendCommand(action));
    };
    sendTouch = ({ type, x, y }) => {
        this.dongleDriver.send(new SendTouch(x, y, type));
    };
    onmessage = null;
}
//# sourceMappingURL=CarplayNode.js.map
"""

with open('backend/node_modules/node-carplay/dist/node/CarplayNode.js', 'w') as f:
    f.write(content)
