#include "display.h"

#include <cmath>

#include "config.h"

namespace wiggles {

void Display::begin() {
  M5.Display.setRotation(1);
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setTextSize(1);
}

void Display::render(ViewMode mode,
                     const std::vector<Signal>& signals,
                     size_t selectedIndex,
                     bool demoMode,
                     bool wifiConnected,
                     bool scanning,
                     uint32_t lastScanAgeMs) {
  M5.Display.startWrite();
  M5.Display.fillScreen(TFT_BLACK);
  drawHeader_(demoMode, wifiConnected, scanning, signals.size());

  switch (mode) {
    case ViewMode::Radar:
      drawRadar_(signals, selectedIndex);
      break;
    case ViewMode::List:
      drawList_(signals, selectedIndex);
      break;
    case ViewMode::Settings:
      drawSettings_(demoMode, lastScanAgeMs);
      break;
  }
  M5.Display.endWrite();
}

void Display::drawHeader_(bool demoMode, bool wifiConnected, bool scanning, size_t count) {
  M5.Display.fillRect(0, 0, SCREEN_W, 20, TFT_DARKGREY);
  M5.Display.setCursor(6, 6);
  M5.Display.setTextColor(TFT_CYAN, TFT_DARKGREY);
  M5.Display.printf("Mr.Wiggles %s", demoMode ? "DEMO" : "LIVE");

  M5.Display.setTextColor(wifiConnected ? TFT_GREEN : TFT_RED, TFT_DARKGREY);
  M5.Display.setCursor(156, 6);
  M5.Display.printf("WiFi:%s", wifiConnected ? "OK" : "OFF");

  M5.Display.setTextColor(scanning ? TFT_YELLOW : TFT_LIGHTGREY, TFT_DARKGREY);
  M5.Display.setCursor(228, 6);
  M5.Display.printf("%s %u", scanning ? "SCAN" : "IDLE", static_cast<unsigned>(count));
}

void Display::drawRadar_(const std::vector<Signal>& signals, size_t selectedIndex) {
  const int cx = 96;
  const int cy = 130;
  const int maxR = 78;

  M5.Display.drawCircle(cx, cy, maxR, TFT_DARKGREY);
  M5.Display.drawCircle(cx, cy, maxR / 2, TFT_DARKGREY);
  M5.Display.drawFastHLine(cx - maxR, cy, maxR * 2, TFT_DARKGREY);
  M5.Display.drawFastVLine(cx, cy - maxR, maxR * 2, TFT_DARKGREY);

  const size_t count = signals.size();
  if (count == 0) {
    M5.Display.setTextColor(TFT_LIGHTGREY, TFT_BLACK);
    M5.Display.setCursor(34, 124);
    M5.Display.print("No signals yet");
    return;
  }

  for (size_t i = 0; i < count; ++i) {
    const auto& sig = signals[i];
    const float t = static_cast<float>(i) / static_cast<float>(count);
    const float angle = -1.5708f + (t * 6.2831f);
    const int radius = 20 + static_cast<int>((sig.rssi - MIN_RSSI) * (maxR - 20) / static_cast<float>(MAX_RSSI - MIN_RSSI));
    const int clampedRadius = std::max(20, std::min(maxR - 4, radius));
    const int x = cx + static_cast<int>(cosf(angle) * clampedRadius);
    const int y = cy + static_cast<int>(sinf(angle) * clampedRadius);

    uint16_t color = rssiColor_(sig.rssi);
    if (i == selectedIndex) {
      M5.Display.fillCircle(x, y, 5, color);
      M5.Display.drawCircle(x, y, 8, TFT_WHITE);
    } else {
      M5.Display.fillCircle(x, y, 3, color);
    }
  }

  const auto& selected = signals[std::min(selectedIndex, count - 1)];
  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
  M5.Display.setCursor(188, 40);
  M5.Display.printf("SSID: %.14s", selected.ssid.c_str());
  M5.Display.setCursor(188, 58);
  M5.Display.printf("RSSI: %d dBm", selected.rssi);
  M5.Display.setCursor(188, 76);
  M5.Display.printf("CH: %d", selected.channel);
  M5.Display.setCursor(188, 94);
  M5.Display.printf("FREQ: %d", selected.freqMHz);
  M5.Display.setCursor(188, 112);
  M5.Display.printf("ACTIVE: %s", selected.active ? "YES" : "NO");
}

void Display::drawList_(const std::vector<Signal>& signals, size_t selectedIndex) {
  M5.Display.setTextColor(TFT_CYAN, TFT_BLACK);
  M5.Display.setCursor(8, 28);
  M5.Display.print("Signals");

  if (signals.empty()) {
    M5.Display.setTextColor(TFT_LIGHTGREY, TFT_BLACK);
    M5.Display.setCursor(8, 48);
    M5.Display.print("No scan results.");
    return;
  }

  const int startY = 44;
  for (size_t i = 0; i < signals.size() && i < 8; ++i) {
    const auto& sig = signals[i];
    const int y = startY + static_cast<int>(i) * 22;

    if (i == selectedIndex) {
      M5.Display.fillRect(4, y - 2, SCREEN_W - 8, 18, TFT_NAVY);
    }

    M5.Display.setCursor(10, y);
    M5.Display.setTextColor(rssiColor_(sig.rssi), i == selectedIndex ? TFT_NAVY : TFT_BLACK);
    M5.Display.printf("%2d", sig.channel);

    M5.Display.setCursor(38, y);
    M5.Display.setTextColor(TFT_WHITE, i == selectedIndex ? TFT_NAVY : TFT_BLACK);
    M5.Display.printf("%.15s", sig.ssid.length() ? sig.ssid.c_str() : "<hidden>");

    M5.Display.setCursor(242, y);
    M5.Display.setTextColor(TFT_LIGHTGREY, i == selectedIndex ? TFT_NAVY : TFT_BLACK);
    M5.Display.printf("%d", sig.rssi);
  }
}

void Display::drawSettings_(bool demoMode, uint32_t lastScanAgeMs) {
  M5.Display.setTextColor(TFT_CYAN, TFT_BLACK);
  M5.Display.setCursor(8, 30);
  M5.Display.print("Settings");

  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
  M5.Display.setCursor(8, 56);
  M5.Display.printf("Mode: %s", demoMode ? "Demo (self-contained)" : "Live WiFi scan");
  M5.Display.setCursor(8, 76);
  M5.Display.print("A:Toggle demo   B:Scan now");
  M5.Display.setCursor(8, 96);
  M5.Display.print("C:Next view / swipe tabs");
  M5.Display.setCursor(8, 116);
  M5.Display.printf("Last scan: %lus ago", static_cast<unsigned long>(lastScanAgeMs / 1000));
  M5.Display.setCursor(8, 152);
  M5.Display.print("OTA: enabled after WiFi connect");
}

uint16_t Display::rssiColor_(int rssi) const {
  if (rssi >= -55) return TFT_GREEN;
  if (rssi >= -67) return TFT_YELLOW;
  if (rssi >= -80) return TFT_ORANGE;
  return TFT_RED;
}

}  // namespace wiggles
