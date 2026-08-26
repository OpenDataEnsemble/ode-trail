// Waits for Formulus to inject window.formulus, then resolves with it.
// Every screen in this app should call getFormulus() before touching the bridge.
(function () {
  'use strict';

  if (window.getFormulus) return;

  window.getFormulus = function () {
    return new Promise(function (resolve, reject) {
      var timeoutMs = 5000;
      var settled = false;

      function isReady() {
        return (
          window.formulus &&
          typeof window.formulus === 'object' &&
          typeof window.formulus.getVersion === 'function'
        );
      }

      if (isReady()) {
        resolve(window.formulus);
        return;
      }

      window.formulusCallbacks = window.formulusCallbacks || {};
      var previousOnReady = window.formulusCallbacks.onFormulusReady;
      window.formulusCallbacks.onFormulusReady = function () {
        if (typeof previousOnReady === 'function') previousOnReady();
        if (!settled && isReady()) {
          settled = true;
          resolve(window.formulus);
        }
      };

      var waited = 0;
      var pollId = setInterval(function () {
        waited += 100;
        if (settled) {
          clearInterval(pollId);
          return;
        }
        if (isReady()) {
          settled = true;
          clearInterval(pollId);
          resolve(window.formulus);
          return;
        }
        if (waited >= timeoutMs) {
          clearInterval(pollId);
          reject(new Error('Formulus did not become ready in time.'));
        }
      }, 100);
    });
  };
})();
