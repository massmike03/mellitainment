#!/bin/bash
# Build the custom Raspberry Pi image using Packer in Docker

# Ensure we are in the project root
cd "$(dirname "$0")"

echo "Building Infotainment Image..."
echo "This may take a while as it emulates ARM architecture."

# Register QEMU handlers (required for ARM emulation on Mac)
docker run --privileged --rm tonistiigi/binfmt --install all

docker run --rm --privileged -v /dev:/dev -v $(pwd):/build \
  --entrypoint /bin/sh \
  mkaczanowski/packer-builder-arm:latest \
  -c "cd packer && packer init infotainment.pkr.hcl && packer build infotainment.pkr.hcl"

echo "Build complete! Check 'infotainment-dist.img'"
