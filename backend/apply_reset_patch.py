import os

file_path = 'node_modules/node-carplay/dist/node/CarplayNode.js'

with open(file_path, 'r') as f:
    content = f.read()

# The code block to replace
original_code = """        let device = await this.findDevice();
        await device.open();
        await device.reset();
        await device.close();
        // Resetting the device causes an unplug event in node-usb
        // so subsequent writes fail with LIBUSB_ERROR_NO_DEVICE
        // or LIBUSB_TRANSFER_ERROR
        console.log('Reset device, finding again...');
        await new Promise(resolve => setTimeout(resolve, USB_WAIT_PERIOD_MS));
        // ^ Device disappears after reset for 1-3 seconds
        device = await this.findDevice();
        console.log('found & opening');
        await device.open();"""

# The new code block
new_code = """        let device = await this.findDevice();
        await device.open();
        
        // Skip reset on Linux/Pi to avoid USB disconnect loop
        if (process.platform !== 'linux') {
            await device.reset();
            await device.close();
            // Resetting the device causes an unplug event in node-usb
            // so subsequent writes fail with LIBUSB_ERROR_NO_DEVICE
            // or LIBUSB_TRANSFER_ERROR
            console.log('Reset device, finding again...');
            await new Promise(resolve => setTimeout(resolve, USB_WAIT_PERIOD_MS));
            // ^ Device disappears after reset for 1-3 seconds
            device = await this.findDevice();
            console.log('found & opening');
            await device.open();
        } else {
            console.log('Linux detected - skipping USB reset to avoid disconnect loop');
        }"""

if original_code in content:
    new_content = content.replace(original_code, new_code)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Successfully patched CarplayNode.js")
else:
    # Try a more robust match if exact string fails (e.g. whitespace)
    print("Could not find exact match, checking if already patched...")
    if "process.platform !== 'linux'" in content:
        print("Already patched.")
    else:
        print("Failed to patch: content mismatch")
        # Print a snippet to debug
        start_idx = content.find("start = async")
        print("Snippet:", content[start_idx:start_idx+500])

