'use strict';

// Electron on macOS has no passkey / Touch ID prompt, so a WebAuthn request on
// the Microsoft sign-in page waits forever with no way out. Make WebAuthn
// report "unavailable" and fail at once, so the page offers other sign-in
// methods (password, email code, Authenticator app). Nothing is exposed to
// the page; this only replaces the passkey entry points before it loads.
const { contextBridge } = require('electron');

if (process.platform === 'darwin') {
  contextBridge.executeInMainWorld({
    func: () => {
      const fail = () => Promise.reject(
        new DOMException('Passkeys are not supported in this app.', 'NotAllowedError'),
      );
      if (window.PublicKeyCredential) {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = () => Promise.resolve(false);
        PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false);
      }
      if (navigator.credentials) {
        navigator.credentials.get = fail;
        navigator.credentials.create = fail;
      }
    },
  });
}
