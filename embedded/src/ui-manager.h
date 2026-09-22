#pragma once

#include <M5Unified.h>

#include "display.h"

namespace wiggles {

class UiManager {
 public:
  void begin();
  void update(size_t signalCount, bool touchEnabled);

  ViewMode viewMode() const { return viewMode_; }
  size_t selectedIndex() const { return selectedIndex_; }
  bool consumeToggleDemo();
  bool consumeForceScan();

 private:
  ViewMode viewMode_ = ViewMode::Radar;
  size_t selectedIndex_ = 0;
  bool toggleDemoRequested_ = false;
  bool forceScanRequested_ = false;
  int32_t touchStartX_ = -1;

  void nextView_();
  void prevSignal_(size_t signalCount);
  void nextSignal_(size_t signalCount);
};

}  // namespace wiggles
