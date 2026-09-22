'use strict';

class SensorSource extends EventTarget {
  constructor() {
    super();
    this._heading = 0;
    this._position = null;
    this._connected = false;
    this._source = 'none';
    this._geoWatchId = null;
    this._orientationHandler = (evt) => this._onOrientation(evt);
  }

  getState() {
    return {
      heading: this._heading,
      position: this._position,
      connected: this._connected,
      source: this._source,
    };
  }

  async connect() {
    let orientationEnabled = false;

    if (typeof DeviceOrientationEvent !== 'undefined') {
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          const result = await DeviceOrientationEvent.requestPermission();
          orientationEnabled = result === 'granted';
        } else {
          orientationEnabled = true;
        }
      } catch (_) {
        orientationEnabled = false;
      }
    }

    if (orientationEnabled) {
      window.addEventListener('deviceorientation', this._orientationHandler, true);
      this._source = 'imu';
    }

    if ('geolocation' in navigator) {
      this._geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this._position = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          this._emit();
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1500, timeout: 4000 }
      );
    }

    this._emitStatus();
  }

  stop() {
    window.removeEventListener('deviceorientation', this._orientationHandler, true);
    if (this._geoWatchId != null) {
      navigator.geolocation.clearWatch(this._geoWatchId);
      this._geoWatchId = null;
    }
  }

  _onOrientation(evt) {
    const rawHeading = typeof evt.webkitCompassHeading === 'number'
      ? evt.webkitCompassHeading
      : (typeof evt.alpha === 'number' ? 360 - evt.alpha : null);

    if (typeof rawHeading !== 'number' || Number.isNaN(rawHeading)) {
      return;
    }

    this._heading = ((rawHeading % 360) + 360) % 360;
    this._connected = true;
    this._source = this._position ? 'imu+gps' : 'imu';
    this._emit();
    this._emitStatus();
  }

  _emit() {
    this.dispatchEvent(new CustomEvent('update', { detail: this.getState() }));
  }

  _emitStatus() {
    this.dispatchEvent(new CustomEvent('status', { detail: this.getState() }));
  }
}
