/* ================================================================
   Tab Out — Cross-Browser API Compatibility Layer

   This file provides a unified API surface for Chrome and Safari.
   Safari Web Extensions support both chrome.* and browser.* namespaces,
   but with subtle differences. This layer normalizes:

   1. API namespace: prefers browser.* (Promise-based), falls back to chrome.*
   2. Extension URL protocol: chrome-extension:// vs safari-web-extension://
   3. New tab URL: chrome://newtab/ doesn't exist in Safari
   4. Storage: chrome.storage.local is supported in Safari (5MB limit)

   Usage: Include this file BEFORE app.js and background.js:
     <script src="browser-polyfill.js"></script>
     <script src="app.js"></script>

   Then use `browser.*` APIs throughout your code.
   ================================================================ */

'use strict';

// ─── 1. Establish the global `browser` namespace ────────────────────────────

// If `browser` is already defined (Firefox, Safari modern), use it.
// Otherwise, wrap `chrome` APIs to return Promises.
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  window.browser = {};

  // Helper: promisify a chrome API that uses the (result) => callback pattern
  function promisify(fn) {
    return function (...args) {
      return new Promise((resolve, reject) => {
        fn(...args, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });
    };
  }

  // ─── runtime ─────────────────────────────────────────────────────────────
  if (chrome.runtime) {
    browser.runtime = {
      ...chrome.runtime,
      get id() { return chrome.runtime.id; },
      onInstalled: chrome.runtime.onInstalled,
      onStartup: chrome.runtime.onStartup,
    };
  }

  // ─── tabs ────────────────────────────────────────────────────────────────
  if (chrome.tabs) {
    browser.tabs = {
      ...chrome.tabs,
      query: promisify(chrome.tabs.query.bind(chrome.tabs)),
      remove: promisify(chrome.tabs.remove.bind(chrome.tabs)),
      update: promisify(chrome.tabs.update.bind(chrome.tabs)),
      onCreated: chrome.tabs.onCreated,
      onRemoved: chrome.tabs.onRemoved,
      onUpdated: chrome.tabs.onUpdated,
    };
  }

  // ─── windows ─────────────────────────────────────────────────────────────
  if (chrome.windows) {
    browser.windows = {
      ...chrome.windows,
      getCurrent: promisify(chrome.windows.getCurrent.bind(chrome.windows)),
      update: promisify(chrome.windows.update.bind(chrome.windows)),
    };
  }

  // ─── storage ─────────────────────────────────────────────────────────────
  if (chrome.storage) {
    browser.storage = {
      local: {
        get: promisify(chrome.storage.local.get.bind(chrome.storage.local)),
        set: promisify(chrome.storage.local.set.bind(chrome.storage.local)),
      },
    };
  }

  // ─── action / browserAction ──────────────────────────────────────────────
  // Safari supports browser.action (MV3) and browser.browserAction (MV2 fallback)
  const actionApi = chrome.action || chrome.browserAction;
  if (actionApi) {
    browser.action = {
      setBadgeText: promisify(actionApi.setBadgeText.bind(actionApi)),
      setBadgeBackgroundColor: promisify(actionApi.setBadgeBackgroundColor.bind(actionApi)),
      onClicked: actionApi.onClicked,
    };
  }
} else if (typeof browser === 'undefined') {
  // Neither chrome nor browser available — create stubs so code doesn't crash
  window.browser = {
    runtime: { id: 'unknown' },
    tabs: {
      query: async () => [],
      remove: async () => {},
      update: async () => {},
    },
    windows: {
      getCurrent: async () => ({}),
      update: async () => {},
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
      },
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
    },
  };
}

// ─── 2. Browser detection helpers ───────────────────────────────────────────

const BROWSER = {
  // Detect Safari by checking the extension URL protocol
  isSafari: typeof location !== 'undefined' &&
    location.protocol === 'safari-web-extension:',

  // Detect Chrome/Chromium
  isChrome: typeof location !== 'undefined' &&
    location.protocol === 'chrome-extension:',

  // Generic: any extension environment
  isExtension: typeof browser !== 'undefined' &&
    typeof browser.runtime !== 'undefined' &&
    !!browser.runtime.id,
};

// ─── 3. Extension URL helpers ───────────────────────────────────────────────

/**
 * getExtensionProtocol()
 * Returns the correct protocol for the current browser's extension URLs.
 */
function getExtensionProtocol() {
  if (BROWSER.isSafari) return 'safari-web-extension://';
  return 'chrome-extension://';
}

/**
 * getNewTabUrl()
 * Returns the URL of this extension's new-tab / dashboard page.
 */
function getNewTabUrl() {
  const protocol = getExtensionProtocol();
  const id = browser.runtime.id;
  return `${protocol}${id}/index.html`;
}

/**
 * isExtensionPage(url)
 * Checks if a URL belongs to this extension (across Chrome/Safari).
 */
function isExtensionPage(url) {
  if (!url) return false;
  const protocol = getExtensionProtocol();
  return url.startsWith(protocol) || url === 'chrome://newtab/';
}

/**
 * isBrowserInternalUrl(url)
 * Checks if a URL is a browser-internal page that should be filtered out.
 */
function isBrowserInternalUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('safari-web-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://') ||
    url.startsWith('safari-extension://')
  );
}
