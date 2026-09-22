#include "ui-manager.h"

namespace wiggles {

void UiManager::begin() {
  viewMode_ = ViewMode::Radar;
  selectedIndex_ = 0;
}

void UiManager::update(size_t signalCount, bool touchEnabled) {
  M5.update();

  if (M5.BtnA.wasPressed()) {
    if (viewMode_ == ViewMode::Settings) {
      toggleDemoRequested_ = true;
    } else {
      prevSignal_(signalCount);
    }
  }

  if (M5.BtnB.wasPressed()) {
    if (viewMode_ == ViewMode::Settings) {
      forceScanRequested_ = true;
    } else {
      nextSignal_(signalCount);
    }
  }

  if (M5.BtnC.wasPressed()) {
    nextView_();
  }

  if (touchEnabled && M5.Touch.getCount() > 0) {
    auto d = M5.Touch.getDetail();
    if (d.wasPressed()) {
      touchStartX_ = d.x;
    }
    if (d.wasReleased() && touchStartX_ >= 0) {
      int delta = d.x - touchStartX_;
      touchStartX_ = -1;
      if (delta > 30) {
        prevSignal_(signalCount);
      } else if (delta < -30) {
        nextSignal_(signalCount);
      } else {
        nextView_();
      }
    }
  }

  if (signalCount > 0 && selectedIndex_ >= signalCount) {
    selectedIndex_ = signalCount - 1;
  }
}

bool UiManager::consumeToggleDemo() {
  bool out = toggleDemoRequested_;
  toggleDemoRequested_ = false;
  return out;
}

bool UiManager::consumeForceScan() {
  bool out = forceScanRequested_;
  forceScanRequested_ = false;
  return out;
}

void UiManager::nextView_() {
  if (viewMode_ == ViewMode::Radar) viewMode_ = ViewMode::List;
  else if (viewMode_ == ViewMode::List) viewMode_ = ViewMode::Settings;
  else viewMode_ = ViewMode::Radar;
}

void UiManager::prevSignal_(size_t signalCount) {
  if (signalCount == 0) {
    selectedIndex_ = 0;
    return;
  }
  selectedIndex_ = (selectedIndex_ + signalCount - 1) % signalCount;
}

void UiManager::nextSignal_(size_t signalCount) {
  if (signalCount == 0) {
    selectedIndex_ = 0;
    return;
  }
  selectedIndex_ = (selectedIndex_ + 1) % signalCount;
}

}  // namespace wiggles
