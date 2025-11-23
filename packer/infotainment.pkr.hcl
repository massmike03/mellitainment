packer {
  required_plugins {
    arm-image = {
      version = ">= 0.2.5"
      source  = "github.com/solo-io/arm-image"
    }
  }
}

variable "wifi_name" {
  type    = string
  default = "MyWifi"
}

variable "wifi_password" {
  type    = string
  default = "password"
}

source "arm-image" "infotainment" {
  iso_url      = "https://downloads.raspberrypi.org/raspios_lite_armhf/images/raspios_lite_armhf-2023-05-03/2023-05-03-raspios-bullseye-armhf-lite.img.xz"
  iso_checksum = "sha256:b5e3a1d984a7eaa402a6e078d707b506b962f6804d331dcc0daa61debae3a19a"
  output_filename = "infotainment-dist.img"
  image_type   = "raspberrypi"
}

build {
  sources = ["source.arm-image.infotainment"]

  # Enable SSH
  provisioner "shell" {
    inline = ["touch /boot/ssh"]
  }

  # Configure Wi-Fi
  provisioner "file" {
    content = <<EOF
country=US
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="${var.wifi_name}"
    psk="${var.wifi_password}"
}
EOF
    destination = "/boot/wpa_supplicant.conf"
  }

  # Install System Dependencies
  provisioner "shell" {
    inline = [
      "apt-get update",
      "apt-get install -y python3-pip python3-venv git libudev-dev ffmpeg curl i2c-tools python3-smbus",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
      "apt-get install -y nodejs"
    ]
  }

  # Copy Application Code
  provisioner "file" {
    source      = "../backend"
    destination = "/home/pi/backend"
  }

  provisioner "file" {
    source      = "../frontend"
    destination = "/home/pi/frontend"
  }

  # Setup Application
  provisioner "shell" {
    inline = [
      # Backend Setup
      "cd /home/pi/backend",
      "pip3 install -r requirements.txt",
      "npm install", # For carplay_server

      # Frontend Setup
      "cd /home/pi/frontend",
      "npm install",
      "npm run build",

      # Permissions
      "chown -R pi:pi /home/pi/backend /home/pi/frontend"
    ]
  }
  
  # Setup Services (You would copy service files here)
  # provisioner "file" { ... }
}
