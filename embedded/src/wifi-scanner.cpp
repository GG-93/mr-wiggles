#include "wifi-scanner.h"

#include <WiFi.h>

#include "config.h"

namespace wiggles {

void WifiScanner::begin() {
  WiFi.mode(WIFI_MODE_STA);
  WiFi.disconnect(true, true);
  delay(50);
}

std::vector<Signal> WifiScanner::scan(bool demoMode) {
  if (demoMode) {
    ensureDemoSignals_();
    const uint32_t tick = millis();
    for (size_t i = 0; i < demoSignals_.size(); ++i) {
      int drift = static_cast<int>((tick / 140 + i * 17) % 16) - 8;
      demoSignals_[i].rssi = -64 - static_cast<int>(i) * 4 + drift;
      demoSignals_[i].active = ((tick / 700 + i) % 3) != 0;
    }
    return demoSignals_;
  }

  std::vector<Signal> signals;
  const int found = WiFi.scanNetworks(false, true);
  if (found <= 0) {
    WiFi.scanDelete();
    return signals;
  }

  signals.reserve(std::min(found, static_cast<int>(MAX_SIGNALS)));
  for (int i = 0; i < found && i < static_cast<int>(MAX_SIGNALS); ++i) {
    Signal sig;
    sig.ssid = WiFi.SSID(i);
    sig.bssid = WiFi.BSSIDstr(i);
    sig.rssi = WiFi.RSSI(i);
    sig.channel = WiFi.channel(i);
    sig.freqMHz = channelToFrequency_(sig.channel);
    sig.active = true;
    sig.demo = false;
    signals.push_back(sig);
  }

  WiFi.scanDelete();
  return signals;
}

void WifiScanner::ensureDemoSignals_() {
  if (!demoSignals_.empty()) return;

  demoSignals_.reserve(4);
  auto pushDemoSignal = [this](const char* ssid, const char* bssid, int rssi, int channel, int freqMHz, bool active) {
    Signal sig;
    sig.ssid = ssid;
    sig.bssid = bssid;
    sig.rssi = rssi;
    sig.channel = channel;
    sig.freqMHz = freqMHz;
    sig.active = active;
    sig.demo = true;
    demoSignals_.push_back(sig);
  };

  pushDemoSignal("Demo_AP_1", "02:00:00:00:00:01", -58, 1, 2412, true);
  pushDemoSignal("Demo_AP_2", "02:00:00:00:00:02", -64, 6, 2437, true);
  pushDemoSignal("Demo_AP_3", "02:00:00:00:00:03", -72, 11, 2462, false);
  pushDemoSignal("Demo_AP_5G", "02:00:00:00:00:04", -68, 40, 5200, true);
}

int WifiScanner::channelToFrequency_(int channel) const {
  if (channel <= 14) {
    return 2407 + (channel * 5);
  }
  return 5000 + (channel * 5);
}

}  // namespace wiggles
