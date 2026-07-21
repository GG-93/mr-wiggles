# ESP32 Firmware Example for Mr. Wiggles

The ESP32 acts as a wireless scanner and reports Wi-Fi and BLE results over USB serial as JSON lines.

## Protocol

Each scan result is a single JSON object followed by a newline (`\n`).

### Wi-Fi access point
```json
{"t":"wifi","ssid":"HomeNetwork","bssid":"aa:bb:cc:dd:ee:ff","rssi":-65,"freq":2437,"ch":6}
```

### BLE peripheral
```json
{"t":"ble","name":"iPhone 15","addr":"aa:bb:cc:dd:ee:ff","rssi":-72}
```

### Keep-alive (optional, ignored by backend)
```json
{"t":"ping"}
```

## Arduino Sketch (ESP32)

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <ArduinoJson.h>

// Scan every 5 seconds
const int SCAN_INTERVAL_MS = 5000;
BLEScan* bleScan = nullptr;

void setup() {
  Serial.begin(115200);
  delay(1000);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  BLEDevice::init("MrWiggles");
  bleScan = BLEDevice::getScan();
  bleScan->setActiveScan(true);
  bleScan->setInterval(100);
  bleScan->setWindow(99);
}

void scanWifi() {
  int n = WiFi.scanNetworks(false, true); // async=false, hidden=true
  for (int i = 0; i < n; i++) {
    StaticJsonDocument<256> doc;
    doc["t"]    = "wifi";
    doc["ssid"] = WiFi.SSID(i).c_str();
    doc["bssid"] = WiFi.BSSIDstr(i).c_str();
    doc["rssi"] = WiFi.RSSI(i);
    doc["freq"] = WiFi.channel(i) <= 13
                    ? 2407 + WiFi.channel(i) * 5
                    : 5000 + WiFi.channel(i) * 5;
    doc["ch"]   = WiFi.channel(i);
    serializeJson(doc, Serial);
    Serial.println();
  }
  WiFi.scanDelete();
}

void scanBle() {
  BLEScanResults results = bleScan->start(3, false); // scan for 3 seconds
  for (int i = 0; i < results.getCount(); i++) {
    BLEAdvertisedDevice d = results.getDevice(i);
    StaticJsonDocument<256> doc;
    doc["t"]    = "ble";
    doc["name"] = d.haveName() ? d.getName().c_str() : "";
    doc["addr"] = d.getAddress().toString().c_str();
    doc["rssi"] = d.getRSSI();
    serializeJson(doc, Serial);
    Serial.println();
  }
  bleScan->clearResults();
}

void loop() {
  scanWifi();
  scanBle();
  delay(SCAN_INTERVAL_MS);
}
```

## Dependencies (Arduino IDE / PlatformIO)

| Library | Source |
|---------|--------|
| ArduinoJson | `arduino-cli lib install ArduinoJson` |
| ESP32 Arduino Core | Boards manager: `https://dl.espressif.com/dl/package_esp32_index.json` |

## Wiring

Connect the ESP32 to your computer with a **data-capable** USB cable (not charge-only).

## Backend Configuration

In `backend/.env`:
```
DEMO_MODE=false
ESP32_PORT=/dev/ttyUSB0   # Linux
# ESP32_PORT=/dev/cu.usbserial-0001  # macOS
# ESP32_PORT=COM3                    # Windows
ESP32_BAUD=115200
```

Install the serialport npm package:
```bash
cd backend
npm install serialport
```
