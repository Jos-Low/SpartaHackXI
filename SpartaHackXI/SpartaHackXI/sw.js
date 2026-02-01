// sw.js
import { getLevelDef } from "./gameConfig.js";

const DEFAULT_SETTINGS = {
  goodSites: [],
  badSites: [],
  //xpPerMinuteGood: 15,
  //xpPerMinuteBad: 10
};

const XP_RATES = Object.freeze({
  good: 15,
  bad: 10,
});

// NOTE: xpToNext will be set from config on init
const DEFAULT_STATE = {
  xp: 0,
  level: 1,
  xpToNext: 0,
  pendingUpgrade: false, // kept for compatibility; not used
  current: null // { tabId, url, category, startTs, windowFocused, userIdle }
};

let settingsCache = null;
let stateCache = null;

// ---------- Level/Config helpers ----------
function computeXpToNext(level) {
  const def = getLevelDef(level);
  return def?.xpToNext ?? (100 + level * 50);
}

function getCharacterIconForLevel(level) {
  const def = getLevelDef(level);
  return def?.characterIcon ?? "assets/character_lv1.png";
}

function clampXpForLevel(level, xp) {
  const cap = computeXpToNext(level || 1);
  const n = Number.isFinite(xp) ? xp : 0;
  return Math.max(0, Math.min(cap, n));
}


// ---------- Site helpers ----------
function normalizeHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function hostMatchesList(host, list) {
  return (list || []).some((entry) => {
    const e = String(entry).toLowerCase().trim();
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

// ---------- Storage helpers ----------
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
  const prev = await getState();

  // Merge first
  let next = { ...prev, ...patch };

  // Keep level sane
  const level = next.level || 1;

  // Ensure xpToNext always matches the merged level
  const correctXpToNext = computeXpToNext(level);
  next.xpToNext = correctXpToNext;

  // Clamp xp so it can never exceed the max for this level
  next.xp = clampXpForLevel(level, next.xp);

  stateCache = next;
  await chrome.storage.local.set({ state: stateCache });

  chrome.runtime.sendMessage({ type: "STATE_UPDATED", state: stateCache }).catch(() => {});

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) continue;
    chrome.tabs.sendMessage(tab.id, { type: "STATE_UPDATED", state: stateCache }).catch(() => {});
  }
}

async function saveSettings(patch) {
  const s = await getSettings();
  settingsCache = { ...s, ...patch };
  await chrome.storage.sync.set({ settings: settingsCache });
}

// Make sure xpToNext is always correct for the stored level
async function ensureStateIsConsistent() {
  const state = await getState();
  const level = state.level || 1;

  const patch = {};
  if (!state.level) patch.level = 1;
  if (state.xp == null) patch.xp = 0;
  if (state.pendingUpgrade) patch.pendingUpgrade = false;

  const correctXpToNext = computeXpToNext(level);
  if (!state.xpToNext || state.xpToNext !== correctXpToNext) {
    patch.xpToNext = correctXpToNext;
  }

  if (Object.keys(patch).length) {
    await saveState(patch);
  }
}

// ---------- Time accounting ----------
async function finalizeCurrentSession(reason) {
  const state = await getState();
  const settings = await getSettings();
  const curr = state.current;
  if (!curr) return;

  const now = Date.now();

  if (curr.windowFocused && !curr.userIdle) {
    const deltaMs = Math.max(0, now - curr.startTs);

    // Optional: ignore tiny flickers
    if (deltaMs >= 1500) {
      const minutes = deltaMs / 60000;

      let xpDelta = 0;
      if (curr.category === "good") xpDelta = minutes * XP_RATES.good * 1000000;
      if (curr.category === "bad") xpDelta = -minutes * XP_RATES.bad;

      if (xpDelta !== 0) {
        const newXp = Math.max(0, (state.xp || 0) + xpDelta);
        await saveState({ xp: newXp });
      }
    }
  }

  await saveState({ current: null });
}

async function startSessionFromActiveTab() {
  const settings = await getSettings();
  const state = await getState();

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.url) return;

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

// ---------- Upgrade (open minigame) ----------
async function startUpgrade() {
  const state = await getState();
  await ensureStateIsConsistent();

  const level = state.level || 1;
  const xp = state.xp || 0;
  const xpToNext = computeXpToNext(level);

  if (xp < xpToNext) return { ok: false, err: "Not enough XP" };

  // ✅ Look up the minigame for THIS level from gameConfig
  const def = getLevelDef(level);
  const upgradeMinigame = def?.upgradeMinigame ?? null;

  // --- keep your existing "instant upgrade" behavior ---
  const newLevel = level + 1;
  const newXp = Math.max(0, xp - xpToNext);
  const newXpToNext = computeXpToNext(newLevel);

  await saveState({
    level: newLevel,
    xp: newXp,
    xpToNext: newXpToNext,
    pendingUpgrade: false
  });

  // ✅ Return the path so popup can open it
  return { ok: true, level: newLevel, upgradeMinigame };
}


// ---------- Lifecycle ----------
chrome.runtime.onInstalled.addListener(async () => {
  const existingS = await chrome.storage.sync.get("settings");
  if (!existingS.settings) await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });

  const existingState = await chrome.storage.local.get("state");
  if (!existingState.state) await chrome.storage.local.set({ state: DEFAULT_STATE });
  

  settingsCache = null;
  stateCache = null;

  await ensureStateIsConsistent();
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
    if (curr) await saveState({ current: { ...curr, windowFocused: false } });
    await finalizeCurrentSession("window_blur");
  } else {
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
        startTs: isIdle ? curr.startTs : Date.now()
      }
    });
  }

  if (isIdle) await finalizeCurrentSession("idle");
  else await refreshSession("active");
});

async function resetStateToDefault() {
  // Stop any in-progress session from modifying XP after reset
  await finalizeCurrentSession("reset");

  // Build a fresh default state, but make xpToNext consistent with level 1
  const fresh = {
    ...DEFAULT_STATE,
    level: 1,
    xp: 0,
    pendingUpgrade: false,
    current: null
  };
  fresh.xpToNext = computeXpToNext(fresh.level);

  // Persist + clear caches
  await chrome.storage.local.set({ state: fresh });
  stateCache = null;

  // Broadcast so UI/content scripts update character + bar immediately
  chrome.runtime.sendMessage({ type: "STATE_UPDATED", state: fresh }).catch(() => {});
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) continue;
    chrome.tabs.sendMessage(tab.id, { type: "STATE_UPDATED", state: fresh }).catch(() => {});
  }

  return fresh;
}


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
      await refreshSession("settings_changed");
      return sendResponse({ ok: true });
    }

    // Character icon lookup (content script uses this)
    if (msg.type === "GET_CHARACTER_ICON") {
      const state = await getState();
      const icon = getCharacterIconForLevel(state.level || 1);
      return sendResponse({ ok: true, icon });
    }

    // ✅ Upgrade is instant now
    if (msg.type === "START_UPGRADE") {
      const res = await startUpgrade();
      return sendResponse(res);
    }

    // Keep this for compatibility (does nothing meaningful now)
    if (msg.type === "MINIGAME_COMPLETE") {
      return sendResponse({ ok: true });
    }

    if (msg.type === "RESET_STATE") {
      const fresh = await resetStateToDefault();
      return sendResponse({ ok: true, state: fresh });
    }


    return sendResponse({ ok: false, err: "Unknown message" });
  })();

  return true;
});
