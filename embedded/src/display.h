#pragma once

#include <M5Unified.h>
#include <vector>

#include "wifi-scanner.h"

namespace wiggles {

enum class ViewMode {
  Radar,
  List,
  Settings,
};

class Display {
 public:
  void begin();
  void render(ViewMode mode,
              const std::vector<Signal>& signals,
              size_t selectedIndex,
              bool demoMode,
              bool wifiConnected,
              bool scanning,
              uint32_t lastScanAgeMs);

 private:
  void drawHeader_(bool demoMode, bool wifiConnected, bool scanning, size_t count);
  void drawRadar_(const std::vector<Signal>& signals, size_t selectedIndex);
  void drawList_(const std::vector<Signal>& signals, size_t selectedIndex);
  void drawSettings_(bool demoMode, uint32_t lastScanAgeMs);
  uint16_t rssiColor_(int rssi) const;
};

}  // namespace wiggles
