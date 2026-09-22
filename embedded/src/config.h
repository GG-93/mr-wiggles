#pragma once

#include <stdint.h>

namespace wiggles {

static constexpr uint16_t SCREEN_W = 320;
static constexpr uint16_t SCREEN_H = 240;
static constexpr uint32_t SCAN_INTERVAL_MS = 2200;
static constexpr uint8_t MAX_SIGNALS = 20;
static constexpr int MIN_RSSI = -95;
static constexpr int MAX_RSSI = -30;
static constexpr const char* OTA_HOSTNAME = "mr-wiggles";

}  // namespace wiggles
