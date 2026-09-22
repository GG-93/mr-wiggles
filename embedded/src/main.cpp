#include <Arduino.h>
#include <ArduinoOTA.h>
#include <WiFi.h>
#include <M5Unified.h>

#include <vector>

#include "config.h"
#include "display.h"
#include "ui-manager.h"
#include "wifi-scanner.h"

namespace {

wiggles::Display gDisplay;
wiggles::WifiScanner gScanner;
wiggles::UiManager gUi;
std::vector<wiggles::Signal> gSignals;

bool gDemoMode = true;
bool gScanning = false;
uint32_t gLastScanMs = 0;

bool touchEnabled() {
  return M5.getBoard() == m5::board_t::board_M5StackCoreS3;
}

void setupOTA() {
  ArduinoOTA.setHostname(wiggles::OTA_HOSTNAME);
  ArduinoOTA.begin();
}

void performScan() {
  gScanning = true;
  gSignals = gScanner.scan(gDemoMode);
  gLastScanMs = millis();
  gScanning = false;
}

}  // namespace

void setup() {
  auto cfg = M5.config();
  cfg.clear_display = true;
  cfg.output_power = true;
  M5.begin(cfg);

  gDisplay.begin();
  gScanner.begin();
  gUi.begin();

  WiFi.mode(WIFI_MODE_STA);
  setupOTA();
  performScan();
}

void loop() {
  gUi.update(gSignals.size(), touchEnabled());

  if (gUi.consumeToggleDemo()) {
    gDemoMode = !gDemoMode;
    performScan();
  }

  if (gUi.consumeForceScan() || millis() - gLastScanMs >= wiggles::SCAN_INTERVAL_MS) {
    performScan();
  }

  ArduinoOTA.handle();

  const bool wifiConnected = WiFi.status() == WL_CONNECTED || gDemoMode;
  gDisplay.render(
      gUi.viewMode(),
      gSignals,
      gUi.selectedIndex(),
      gDemoMode,
      wifiConnected,
      gScanning,
      millis() - gLastScanMs);

  delay(16);
}
