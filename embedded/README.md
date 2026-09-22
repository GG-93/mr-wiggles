# Mr. Wiggles Embedded (M5Stack Cardputer + CoreS3)

Standalone firmware for ESP32-S3 M5 devices with:
- Built-in WiFi scanning
- Self-contained demo mode (no external WiFi required)
- Real-time signal visualization on 320x240
- Cardputer/CoreS3-friendly controls
- OTA support via ArduinoOTA

## Build

```bash
cd embedded
pip install platformio
platformio run -e cardputer
platformio run -e cores3
```

## Output binaries

PlatformIO generates `firmware.bin` under:
- `.pio/build/cardputer/firmware.bin`
- `.pio/build/cores3/firmware.bin`

Merged flash-ready images are generated in CI as:
- `mr-wiggles-cardputer-merged.bin`
- `mr-wiggles-cores3-merged.bin`

## Flash (esptool.py)

```bash
# Cardputer
esptool.py --chip esp32s3 --port /dev/ttyACM0 --baud 921600 write_flash -z 0x0 mr-wiggles-cardputer-merged.bin

# CoreS3
esptool.py --chip esp32s3 --port /dev/ttyACM0 --baud 921600 write_flash -z 0x0 mr-wiggles-cores3-merged.bin
```

## Device controls

- `A`: previous signal (or toggle demo in Settings)
- `B`: next signal (or force scan in Settings)
- `C`: switch view (Radar → List → Settings)
- CoreS3 touch: swipe left/right to change selected signal, tap to change view

## OTA updates

When device joins WiFi, OTA is available with hostname `mr-wiggles`.
Use PlatformIO OTA upload:

```bash
platformio run -e cardputer -t upload --upload-port mr-wiggles.local
```
