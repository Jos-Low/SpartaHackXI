const DEFAULT_SETTINGS = {
  goodSites: [],
  badSites: [],
  xpPerMinuteGood: 10,
  xpPerMinuteBad: 15
};

const DEFAULT_STATE = {
  xp: 0,
  level: 1,
  xpToNext: 100,
  pendingUpgrade: false,
  // session tracking
  current: null // { tabId, url, category, startTs, windowFocused, userIdle }
};

let settingsCache = null;
let stateCache = null;

// ---------- Helpers ----------
function normalizeHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function hostMatchesList(host, list) {
  // Match exact host or suffix match: "sub.example.com" matches "example.com"
  return list.some((entry) => {
    const e = entry.toLowerCase().trim();
    if (!e) return false;
    return host === e || host.endsWith("." + e);
  });
}

function categorizeUrl(url, settings) {
  if (!url || !(url.startsWith("http://") || url.startsWith("https://"))) return "neutral";
  const host = normalizeHost(url);
  if (!host) return "neutral";

  if (hostMatchesList(host, settings.badSites)) return "bad";
  if (hostMatchesList(host, settings.goodSites)) return "good";
  return "neutral";
}

function xpToNextForLevel(level) {
  // simple curve
  return 100 + level * 50;
}

async function getSettings() {
  if (settingsCache) return settingsCache;
  const res = await chrome.storage.sync.get("settings");
  settingsCache = { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
  return settingsCache;
}

async function getState() {
  if (stateCache) return stateCache;
  const res = await chrome.storage.local.get("state");
  stateCache = { ...DEFAULT_STATE, ...(res.state || {}) };
  return stateCache;
}

async function saveState(patch) {
  const state = await getState();
  stateCache = { ...state, ...patch };
  await chrome.storage.local.set({ state: stateCache });

  // notify popup/content scripts if they care
  chrome.runtime.sendMessage({ type: "STATE_UPDATED", state: stateCache }).catch(() => {});
}

async function saveSettings(patch) {
  const s = await getSettings();
  settingsCache = { ...s, ...patch };
  await chrome.storage.sync.set({ settings: settingsCache });
}

// ---------- Time accounting ----------
async function finalizeCurrentSession(reason) {
  const state = await getState();
  const settings = await getSettings();
  const curr = state.current;
  if (!curr) return;

  const now = Date.now();

  // Only count time if focused and not idle
  if (curr.windowFocused && !curr.userIdle) {
    const deltaMs = Math.max(0, now - curr.startTs);
    const minutes = deltaMs / 60000;

    let xpDelta = 0;
    if (curr.category === "good") xpDelta = minutes * settings.xpPerMinuteGood;
    if (curr.category === "bad") xpDelta = -minutes * settings.xpPerMinuteBad;

    if (xpDelta !== 0) {
      let xp = Math.max(0, (state.xp || 0) + xpDelta);

      // level up automatically if you want, or just keep xp capped to next
      // We'll NOT auto-level in MVP; just let XP overflow.
      await saveState({ xp });
    }
  }

  await saveState({ current: null });
}

async function startSessionFromActiveTab() {
  const settings = await getSettings();
  const state = await getState();

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.url) return;

  // ignore browser internal pages
  if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
    await saveState({ current: null });
    return;
  }

  const category = categorizeUrl(tab.url, settings);

  const current = {
    tabId: tab.id,
    url: tab.url,
    category,
    startTs: Date.now(),
    windowFocused: state.current?.windowFocused ?? true,
    userIdle: state.current?.userIdle ?? false
  };

  await saveState({ current });
}

async function refreshSession(reason) {
  await finalizeCurrentSession(reason);
  await startSessionFromActiveTab();
}

// ---------- Lifecycle ----------
chrome.runtime.onInstalled.addListener(async () => {
  // initialize settings/state if missing
  const existingS = await chrome.storage.sync.get("settings");
  if (!existingS.settings) await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });

  const existingState = await chrome.storage.local.get("state");
  if (!existingState.state) await chrome.storage.local.set({ state: DEFAULT_STATE });

  settingsCache = null;
  stateCache = null;

  await refreshSession("installed");
});

// ---------- Events ----------
chrome.tabs.onActivated.addListener(() => refreshSession("tab_activated"));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) refreshSession("url_changed");
});

chrome.windows.onFocusChanged.addListener(async (winId) => {
  const state = await getState();
  const curr = state.current;

  if (winId === chrome.windows.WINDOW_ID_NONE) {
    // no window focused
    if (curr) await saveState({ current: { ...curr, windowFocused: false } });
    await finalizeCurrentSession("window_blur");
  } else {
    // regained focus
    if (curr) await saveState({ current: { ...curr, windowFocused: true, startTs: Date.now() } });
    await refreshSession("window_focus");
  }
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  const isIdle = newState === "idle" || newState === "locked";
  const state = await getState();
  const curr = state.current;

  if (curr) {
    await saveState({
      current: {
        ...curr,
        userIdle: isIdle,
        // when returning from idle, restart timer to avoid counting idle time
        startTs: isIdle ? curr.startTs : Date.now()
      }
    });
  }

  if (isIdle) await finalizeCurrentSession("idle");
  else await refreshSession("active");
});

// ---------- Messages ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "GET_STATE") {
      const state = await getState();
      return sendResponse({ ok: true, state });
    }

    if (msg.type === "GET_SETTINGS") {
      const settings = await getSettings();
      return sendResponse({ ok: true, settings });
    }

    if (msg.type === "SET_SETTINGS") {
      await saveSettings(msg.settingsPatch || {});
      // refresh categorization immediately
      await refreshSession("settings_changed");
      return sendResponse({ ok: true });
    }

    if (msg.type === "RESET_XP") {
      const state = await getState();
      await saveState({ xp: 0, level: 1, xpToNext: xpToNextForLevel(1), current: state.current });
      return sendResponse({ ok: true });
    }

    return sendResponse({ ok: false, err: "Unknown message" });
  })();

  return true;
});
