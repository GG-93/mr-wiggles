#pragma once

#include <Arduino.h>
#include <vector>

namespace wiggles {

struct Signal {
  String ssid;
  String bssid;
  int rssi = -100;
  int channel = 0;
  int freqMHz = 0;
  bool active = false;
  bool demo = false;
};

class WifiScanner {
 public:
  void begin();
  std::vector<Signal> scan(bool demoMode);

 private:
  std::vector<Signal> demoSignals_;
  void ensureDemoSignals_();
  int channelToFrequency_(int channel) const;
};

}  // namespace wiggles
