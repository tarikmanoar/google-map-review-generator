importScripts('maps-url.js');

const { isMapsUrl } = self.MapsUrl;

const SIDE_PANEL_PATH = 'sidepanel.html';
const DEFAULT_TITLE = 'Open Maps AI Review';
const OFF_MAPS_TITLE = 'Maps AI Review works on Google Maps only';

// Remembers the last state pushed per tab so repeated navigations inside the
// Maps SPA don't re-issue identical setOptions calls (which can flicker an
// already-open panel). Resets whenever the service worker restarts, which is
// harmless: the next event just re-applies the correct state.
const appliedState = new Map();

async function applyPanelState(tabId, url) {
    if (typeof tabId !== 'number' || tabId === chrome.tabs.TAB_ID_NONE) return;

    const shouldEnable = isMapsUrl(url);
    if (appliedState.get(tabId) === shouldEnable) return;
    appliedState.set(tabId, shouldEnable);

    try {
        if (shouldEnable) {
            await chrome.sidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true });
        } else {
            // Disabling for a tab closes the panel when that tab is active, and
            // Chrome restores it on returning to a tab where it was open.
            await chrome.sidePanel.setOptions({ tabId, enabled: false });
        }
    } catch (_) {
        // Tab went away mid-flight; drop the cached state so we retry later.
        appliedState.delete(tabId);
    }
}

async function syncAllTabs() {
    try {
        const tabs = await chrome.tabs.query({});
        await Promise.all(tabs.map((tab) => applyPanelState(tab.id, tab.url)));
    } catch (_) {}
}

// The panel is never globally available: it is opted in per tab, so it can
// never appear on a tab we haven't vetted (including tabs that existed before
// this worker started).
(async () => {
    try {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    } catch (_) {}
    try {
        await chrome.sidePanel.setOptions({ enabled: false });
    } catch (_) {}
    await syncAllTabs();
})();

chrome.runtime.onInstalled.addListener(syncAllTabs);
chrome.runtime.onStartup.addListener(syncAllTabs);

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    // Maps is a single-page app: place changes surface as info.url updates.
    if (!info.url && info.status !== 'complete') return;
    applyPanelState(tabId, info.url || tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        await applyPanelState(tabId, tab.url);
    } catch (_) {}
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    try {
        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (tab) await applyPanelState(tab.id, tab.url);
    } catch (_) {}
});

chrome.tabs.onRemoved.addListener((tabId) => {
    appliedState.delete(tabId);
});

function flashOffMapsHint(tabId) {
    try {
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#d93025' });
        chrome.action.setBadgeText({ tabId, text: '!' });
        chrome.action.setTitle({ tabId, title: OFF_MAPS_TITLE });
        setTimeout(() => {
            chrome.action.setBadgeText({ tabId, text: '' });
            chrome.action.setTitle({ tabId, title: DEFAULT_TITLE });
        }, 2500);
    } catch (_) {}
}

chrome.action.onClicked.addListener((tab) => {
    if (!tab || typeof tab.id !== 'number') return;

    if (!isMapsUrl(tab.url)) {
        flashOffMapsHint(tab.id);
        return;
    }

    // Not awaited on purpose: sidePanel.open() must run inside the click's
    // user-gesture window, and awaiting setOptions first breaks that chain.
    chrome.sidePanel.setOptions({ tabId: tab.id, path: SIDE_PANEL_PATH, enabled: true });
    appliedState.set(tab.id, true);
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => console.error(error));
});
