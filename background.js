importScripts('maps-url.js');

const { isMapsUrl } = self.MapsUrl;

const DEFAULT_TITLE = 'Open Maps AI Review';
const OFF_MAPS_TITLE = 'Maps AI Review works on Google Maps only';
const KEEP_OPEN_KEY = 'keepPanelOpen';

// Must match manifest.json's side_panel.default_path. Chrome stores tab-scoped
// options verbatim: a per-tab entry does NOT inherit the manifest path, and
// sidePanel.open() rejects with "No active side panel for tabId" whenever the
// resolved options for that tab have no path. So every tab-scoped write below
// carries the path, even when only `enabled` is actually changing.
const SIDE_PANEL_PATH = 'sidepanel.html';

// chrome.sidePanel.open() requires a user gesture, so a panel closed by
// leaving Maps cannot be reopened programmatically on the way back - the user
// would have to click the toolbar icon again. Keeping it enabled everywhere
// (the panel itself explains when the tab is not Maps) avoids that dead end.
// The old close-on-leave behaviour is still available via the setting.
let keepPanelOpen = true;

// Read once per service worker lifetime. Handlers await this instead of a
// bare boot() call so waking the worker never touches the panel - see below.
const settingsReady = (async () => {
    try {
        const stored = await chrome.storage.local.get([KEEP_OPEN_KEY]);
        if (typeof stored[KEEP_OPEN_KEY] === 'boolean') keepPanelOpen = stored[KEEP_OPEN_KEY];
    } catch (_) {}
})();

// Fast path only, to skip the getOptions round trip on repeated navigations
// inside the Maps SPA. It is empty after every worker restart, which is why the
// authoritative check below asks Chrome rather than trusting this map.
const appliedState = new Map();

// setOptions re-navigates an open side panel even when the options it writes
// are the ones already in effect, and a panel that reloads mid-interaction takes
// any open <select> popup down with it. The worker restarts on any event we
// listen for - including the window blur a native select popup produces - so
// "have I already written this?" has to survive a restart: read the live state
// back from Chrome and only write when it actually differs.
async function applyPanelState(tabId, url) {
    if (typeof tabId !== 'number' || tabId === chrome.tabs.TAB_ID_NONE) return;
    await settingsReady;

    const shouldEnable = keepPanelOpen || isMapsUrl(url);
    if (appliedState.get(tabId) === shouldEnable) return;

    try {
        const current = await chrome.sidePanel.getOptions({ tabId });
        if (current.enabled !== shouldEnable || current.path !== SIDE_PANEL_PATH) {
            // Disabling for a tab closes the panel when that tab is active, and
            // Chrome restores it on returning to a tab where it was open.
            await chrome.sidePanel.setOptions({
                tabId,
                path: SIDE_PANEL_PATH,
                enabled: shouldEnable
            });
        }
        appliedState.set(tabId, shouldEnable);
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

// Covers tabs created after this point, which never fire an update we act on
// before the user switches to them. Unlike the tab-scoped writes, the default
// entry is seeded from the manifest by Chrome, so the path here is a no-op that
// just keeps the comparison below honest.
async function applyGlobalDefault() {
    await settingsReady;
    try {
        const current = await chrome.sidePanel.getOptions({});
        if (current.enabled === keepPanelOpen && current.path === SIDE_PANEL_PATH) return;
        await chrome.sidePanel.setOptions({ path: SIDE_PANEL_PATH, enabled: keepPanelOpen });
    } catch (_) {}
}

// Deliberately not called at import time. The worker is torn down after ~30s
// idle and restarted by any event we listen for - including the focus change
// that opening a native <select> popup produces - so anything run at the top
// level runs again in the middle of whatever the user is doing.
async function boot() {
    await settingsReady;
    try {
        // The panel still only *opens* from a Maps tab; see the click handler.
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    } catch (_) {}
    appliedState.clear();
    await applyGlobalDefault();
    await syncAllTabs();
}

chrome.runtime.onInstalled.addListener(boot);
chrome.runtime.onStartup.addListener(boot);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEEP_OPEN_KEY]) return;
    keepPanelOpen = changes[KEEP_OPEN_KEY].newValue !== false;
    // Every cached decision was made under the old setting.
    appliedState.clear();
    applyGlobalDefault().then(syncAllTabs);
});

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

    // Nothing here is awaited: sidePanel.open() must run inside the click's
    // user-gesture window, and awaiting anything first breaks that chain - which
    // rules out the getOptions check used above. Writing the options outright is
    // the safe side of that trade: without a path on this tab open() fails, and
    // re-navigating a panel the user is deliberately (re)opening costs nothing.
    if (appliedState.get(tab.id) !== true) {
        chrome.sidePanel.setOptions({ tabId: tab.id, path: SIDE_PANEL_PATH, enabled: true });
        appliedState.set(tab.id, true);
    }
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => console.error(error));
});
