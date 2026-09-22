'use strict';

(function () {
  const app = window.MrWigglesApp;
  const canvasWrapper = document.getElementById('js-canvas-wrapper');
  const offlineBanner = document.getElementById('js-offline');

  let touchStartX = null;

  function showOffline(isOffline) {
    offlineBanner.classList.toggle('hidden', !isOffline);
  }

  window.addEventListener('online', () => showOffline(false));
  window.addEventListener('offline', () => showOffline(true));
  showOffline(!navigator.onLine);

  if (canvasWrapper) {
    canvasWrapper.addEventListener('touchstart', (evt) => {
      if (!evt.touches.length) return;
      touchStartX = evt.touches[0].clientX;
    }, { passive: true });

    canvasWrapper.addEventListener('touchend', (evt) => {
      if (touchStartX == null || !evt.changedTouches.length || !app) return;
      const endX = evt.changedTouches[0].clientX;
      const delta = endX - touchStartX;
      touchStartX = null;

      if (Math.abs(delta) < 35) return;
      if (delta > 0) app.selectTargetByOffset(-1);
      else app.selectTargetByOffset(1);
    }, { passive: true });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
