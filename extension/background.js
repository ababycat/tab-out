/**
 * background.js — Service Worker for Badge Updates
 *
 * Cross-browser background script for Tab Out.
 * Uses the browser.* API (via browser-polyfill.js or native in Safari).
 *
 * Its only job: keep the toolbar badge showing the current open tab count.
 * The badge counts real web tabs (skipping browser-internal and extension pages).
 *
 * Color coding gives a quick at-a-glance health signal:
 *   Green  (#3d7a4a) → 1–10 tabs  (focused, manageable)
 *   Amber  (#b8892e) → 11–20 tabs (getting busy)
 *   Red    (#b35a5a) → 21+ tabs   (time to cull!)
 */

// Import the polyfill if running in a context that supports it
// (Service workers in Chrome don't auto-load scripts, but Safari handles this differently)
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  // Minimal inline polyfill for background script
  window.browser = {};

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

  if (chrome.runtime) {
    browser.runtime = { ...chrome.runtime, get id() { return chrome.runtime.id; } };
  }
  if (chrome.tabs) {
    browser.tabs = {
      ...chrome.tabs,
      query: promisify(chrome.tabs.query.bind(chrome.tabs)),
      onCreated: chrome.tabs.onCreated,
      onRemoved: chrome.tabs.onRemoved,
      onUpdated: chrome.tabs.onUpdated,
    };
  }
  const actionApi = chrome.action || chrome.browserAction;
  if (actionApi) {
    browser.action = {
      setBadgeText: promisify(actionApi.setBadgeText.bind(actionApi)),
      setBadgeBackgroundColor: promisify(actionApi.setBadgeBackgroundColor.bind(actionApi)),
    };
  }
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

// ─── Badge updater ────────────────────────────────────────────────────────────

/**
 * updateBadge()
 *
 * Counts open real-web tabs and updates the extension's toolbar badge.
 * "Real" tabs = not browser internals and extension pages.
 *
 * NOTE: Badge is disabled for Safari to avoid the red number overlay
 * on the toolbar icon. The dashboard itself shows the tab count.
 */
async function updateBadge() {
  // Skip badge updates on Safari — the badge appears as an unwanted
  // red number bubble on the toolbar icon.
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    await browser.action.setBadgeText({ text: '' });
    return;
  }

  try {
    const tabs = await browser.tabs.query({});

    // Only count actual web pages — skip browser internals and extension pages
    const count = tabs.filter(t => !isBrowserInternalUrl(t.url)).length;

    // Don't show "0" — an empty badge is cleaner
    await browser.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;

    // Pick badge color based on workload level
    let color;
    if (count <= 10) {
      color = '#3d7a4a'; // Green — you're in control
    } else if (count <= 20) {
      color = '#b8892e'; // Amber — things are piling up
    } else {
      color = '#b35a5a'; // Red — time to focus and close some tabs
    }

    await browser.action.setBadgeBackgroundColor({ color });

  } catch {
    // If something goes wrong, clear the badge rather than show stale data
    browser.action.setBadgeText({ text: '' });
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// Update badge when the extension is first installed
browser.runtime.onInstalled.addListener(() => {
  updateBadge();
});

// Update badge when Chrome starts up
browser.runtime.onStartup.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is opened
browser.tabs.onCreated.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is closed
browser.tabs.onRemoved.addListener(() => {
  updateBadge();
});

// Update badge when a tab's URL changes (e.g. navigating to/from chrome://)
browser.tabs.onUpdated.addListener(() => {
  updateBadge();
});

// ─── Click handler: open dashboard in a new tab ──────────────────────────────

/**
 * openDashboardTab()
 *
 * Opens the Tab Out dashboard in a new tab when the toolbar icon is clicked.
 * This avoids the popup size limitations in Safari and gives a full-page experience.
 */
async function openDashboardTab() {
  try {
    const dashboardUrl = browser.runtime.getURL('index.html');

    // Check if a Tab Out dashboard is already open
    const tabs = await browser.tabs.query({});
    const existing = tabs.find(t => t.url && t.url.includes(dashboardUrl));

    if (existing) {
      // Focus the existing tab
      await browser.tabs.update(existing.id, { active: true });
      await browser.windows.update(existing.windowId, { focused: true });
    } else {
      // Open a new tab with the dashboard
      await browser.tabs.create({ url: dashboardUrl });
    }
  } catch (err) {
    console.error('[tab-out] Failed to open dashboard:', err);
  }
}

// Listen for toolbar icon clicks
browser.action.onClicked.addListener(openDashboardTab);

// ─── Initial run ─────────────────────────────────────────────────────────────

// Run once immediately when the service worker first loads
updateBadge();
