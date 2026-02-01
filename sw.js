// sw.js
import { getLevelDef } from "./gameConfig.js";

const DEFAULT_SETTINGS = {
  goodSites: [],
  badSites: [],
  xpPerMinuteGood: 15,
  xpPerMinuteBad: 10
};

// NOTE: xpToNext will be set from config on init
const DEFAULT_STATE = {
  xp: 0,
  level: 1,
  xpToNext: 0,
  pendingUpgrade: false,
  current: null
};

const MAX_LEVEL = 6;

function isMaxLevel(level) {
  return (level || 1) >= MAX_LEVEL;
}

let settingsCache = null;
let stateCache = null;

// ---------- Level/Config helpers ----------
function computeXpToNext(level) {
  const lvl = Math.min(Math.max(1, level || 1), MAX_LEVEL);

  // At max level, there is no "next" XP target
  if (lvl >= MAX_LEVEL) return 0;

  const def = getLevelDef(lvl);
  return def?.xpToNext ?? (100 + lvl * 50);
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
  if (!url || !(url.startsWith("http://") || url.startsWith("https://"))) {
    console.log("[Categorize] Not HTTP/HTTPS:", url);
    return "neutral";
  }

  const host = normalizeHost(url);
  if (!host) {
    console.log("[Categorize] Could not parse host from:", url);
    return "neutral";
  }

  console.log("[Categorize] Checking host:", host);
  console.log("[Categorize] Good sites list:", settings.goodSites);
  console.log("[Categorize] Bad sites list:", settings.badSites);

  if (hostMatchesList(host, settings.badSites)) {
    console.log("[Categorize] ❌ Matched BAD site!");
    return "bad";
  }

  if (hostMatchesList(host, settings.goodSites)) {
    console.log("[Categorize] ✅ Matched GOOD site!");
    return "good";
  }

  console.log("[Categorize] ➖ Neutral (no match)");
  return "neutral";
}

// ---------- Storage helpers ----------
async function getSettings() {
  if (settingsCache) return settingsCache;

  // Load from TOP LEVEL keys
  const res = await chrome.storage.sync.get([
    "goodSites",
    "badSites",
    "xpPerMinuteGood",
    "xpPerMinuteBad"
  ]);

  settingsCache = {
    goodSites: res.goodSites || DEFAULT_SETTINGS.goodSites,
    badSites: res.badSites || DEFAULT_SETTINGS.badSites,
    xpPerMinuteGood: res.xpPerMinuteGood || DEFAULT_SETTINGS.xpPerMinuteGood,
    xpPerMinuteBad: res.xpPerMinuteBad || DEFAULT_SETTINGS.xpPerMinuteBad
  };

  console.log("[Settings] Loaded from storage:", settingsCache);
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

  // Keep level sane + capped
  next.level = Math.min(Math.max(1, next.level || 1), MAX_LEVEL);

  // Ensure xpToNext always matches the merged/capped level
  next.xpToNext = computeXpToNext(next.level);

  // If we're maxed, don't keep accumulating XP (keep it at 0)
  if (isMaxLevel(next.level)) {
    next.xp = 0;
  } else {
    // Clamp xp so it can never exceed the max for this level
    next.xp = clampXpForLevel(next.level, next.xp);
  }

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

  // Save to TOP LEVEL keys
  await chrome.storage.sync.set({
    goodSites: settingsCache.goodSites,
    badSites: settingsCache.badSites,
    xpPerMinuteGood: settingsCache.xpPerMinuteGood,
    xpPerMinuteBad: settingsCache.xpPerMinuteBad
  });

  console.log("[Settings] Saved to storage:", settingsCache);
}

// Make sure xpToNext is always correct for the stored level
async function ensureStateIsConsistent() {
  const state = await getState();

  const rawLevel = state.level || 1;
  const level = Math.min(Math.max(1, rawLevel), MAX_LEVEL);

  const patch = {};
  if (!state.level || state.level !== level) patch.level = level;
  if (state.xp == null) patch.xp = 0;
  if (state.pendingUpgrade) patch.pendingUpgrade = false;

  const correctXpToNext = computeXpToNext(level);
  if (state.xpToNext !== correctXpToNext) {
    patch.xpToNext = correctXpToNext;
  }

  // If max, force xp = 0
  if (isMaxLevel(level) && state.xp !== 0) {
    patch.xp = 0;
  }

  if (Object.keys(patch).length) {
    await saveState(patch);
  }
}


// ---------- Reset helpers ----------
async function resetStateToDefault() {
  const level = 1;
  const def = getLevelDef(level);

  const fresh = {
    ...DEFAULT_STATE,
    level,
    xp: 0,
    xpToNext: computeXpToNext(level),
    pendingUpgrade: false,
    current: null
  };

  stateCache = null;
  await saveState(fresh);

  // Helps XP start accruing immediately after reset
  await refreshSession("reset");

  return {
    ...fresh,
    characterIcon: def?.characterIcon ?? "assets/character/Animated_Flower.png"
  };
}

// ---------- Time accounting (MV3-safe) ----------


// ---------- Session helpers ----------
async function finalizeCurrentSession(reason) {
  const state = await getState();
  const settings = await getSettings();

  // If max level, stop accruing XP entirely
  if (isMaxLevel(state.level)) {
    await saveState({ current: null, xp: 0 });
    console.log(`[Session] Ended (max level, no XP): ${reason}`);
    return;
  }

  const curr = state.current;

  if (!curr) {
    await saveState({ current: null });
    console.log(`[Session] Ended (no current): ${reason}`);
    return;
  }

  // Compute elapsed minutes
  const endTs = Date.now();
  const elapsedMs = Math.max(0, endTs - (curr.startTs || endTs));
  const minutes = elapsedMs / 60000;

  let xpDelta = 0;

  // Only count time if user was active + window focused
  // (If you want “award even if blurred/idle”, remove these gates.)
  const active = curr.windowFocused && !curr.userIdle;

  if (active) {
    if (curr.category === "good") {
      xpDelta = minutes * (settings.xpPerMinuteGood ?? 15) * 10000000;
    } else if (curr.category === "bad") {
      xpDelta = -minutes * (settings.xpPerMinuteBad ?? 10);
    }
  }

  // Apply XP + clear session
  if (xpDelta !== 0) {
    await saveState({
      xp: (state.xp || 0) + xpDelta,
      current: null
    });
  } else {
    await saveState({ current: null });
  }

  console.log(`[Session] Ended: ${reason}`, {
    url: curr.url,
    category: curr.category,
    minutes: minutes.toFixed(3),
    active,
    xpDelta: xpDelta.toFixed(3)
  });
}


async function startSessionFromActiveTab(prevCurr) {
  const settings = await getSettings();

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
    windowFocused: prevCurr?.windowFocused ?? true,
    userIdle: prevCurr?.userIdle ?? false
  };

  await saveState({ current });
  console.log(`[Session] Started: ${category} - ${tab.url}`);
}


async function refreshSession(reason) {
  const state = await getState();
  const prevCurr = state.current;

  await finalizeCurrentSession(reason);

  // Start new session with the previous focus/idle state if we had one
  await startSessionFromActiveTab(prevCurr);
}

// ---------- Upgrade (open minigame) ----------
async function startUpgrade() {
  const state = await getState();
  await ensureStateIsConsistent();

  const level = state.level || 1;

  // 🚫 already max
  if (isMaxLevel(level)) {
    return { ok: false, err: "MAX_LEVEL" };
  }

  const xp = state.xp || 0;
  const xpToNext = computeXpToNext(level);

  if (xp < xpToNext) return { ok: false, err: "Not enough XP" };

  const def = getLevelDef(level);
  const upgradeMinigame = def?.upgradeMinigame ?? null;

  const newLevel = Math.min(level + 1, MAX_LEVEL);

  // if we just reached max, wipe XP + target
  if (newLevel >= MAX_LEVEL) {
    await saveState({
      level: newLevel,
      xp: 0,
      xpToNext: 0,
      pendingUpgrade: false
    });
    return { ok: true, level: newLevel, upgradeMinigame };
  }

  const newXp = Math.max(0, xp - xpToNext);
  const newXpToNext = computeXpToNext(newLevel);

  await saveState({
    level: newLevel,
    xp: newXp,
    xpToNext: newXpToNext,
    pendingUpgrade: false
  });

  return { ok: true, level: newLevel, upgradeMinigame };
}


// ---------- Lifecycle ----------
chrome.runtime.onInstalled.addListener(async () => {
  // Check if settings exist at TOP LEVEL
  const existing = await chrome.storage.sync.get([
    "goodSites",
    "badSites",
    "xpPerMinuteGood",
    "xpPerMinuteBad"
  ]);

  if (!existing.goodSites || existing.goodSites.length === 0) {
    console.log("[Install] Setting up defaults...");
    await chrome.storage.sync.set({
      goodSites: DEFAULT_SETTINGS.goodSites,
      badSites: DEFAULT_SETTINGS.badSites,
      xpPerMinuteGood: DEFAULT_SETTINGS.xpPerMinuteGood,
      xpPerMinuteBad: DEFAULT_SETTINGS.xpPerMinuteBad
    });
  }

  const existingState = await chrome.storage.local.get("state");
  if (!existingState.state) {
    await chrome.storage.local.set({ state: DEFAULT_STATE });
  }

  settingsCache = null;
  stateCache = null;

  await ensureStateIsConsistent();
  await refreshSession("installed");

  console.log("[Install] Extension initialized!");
});

// IMPORTANT: service worker may restart; ensure we restart ticking + session.
chrome.runtime.onStartup.addListener(async () => {
  settingsCache = null;
  stateCache = null;

  await ensureStateIsConsistent();
  await refreshSession("startup");

  console.log("[Startup] Service worker started");
});

// ---------- Events ----------
chrome.tabs.onActivated.addListener(() => refreshSession("tab_activated"));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) refreshSession("url_changed");
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Only finalize if the removed tab was the one we were tracking
  refreshSession("tab_removed").catch(() => {});
});

chrome.windows.onFocusChanged.addListener(async (winId) => {
  const state = await getState();
  const curr = state.current;

  if (winId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus
    if (curr) {
      await saveState({ current: { ...curr, windowFocused: false } });
      console.log("[Focus] Window blurred - XP paused");
    }
  } else {
    // Window gained focus
    if (curr) {
      await saveState({ current: { ...curr, windowFocused: true } });
      console.log("[Focus] Window focused - XP resumed");
    }
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
        userIdle: isIdle
      }
    });
    console.log(
      `[Idle] User ${isIdle ? "idle" : "active"} - XP ${isIdle ? "paused" : "resumed"}`
    );
  }

  if (!isIdle) await refreshSession("active");
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
      const patch = msg.settingsPatch || {};

      // Save to top-level keys
      await chrome.storage.sync.set({
        goodSites: patch.goodSites,
        badSites: patch.badSites,
        xpPerMinuteGood: patch.xpPerMinuteGood,
        xpPerMinuteBad: patch.xpPerMinuteBad
      });

      settingsCache = null; // Clear cache
      await refreshSession("settings_changed");
      return sendResponse({ ok: true });
    }

    // Character icon lookup (content script uses this)
    if (msg.type === "GET_CHARACTER_ICON") {
      const state = await getState();
      const icon = getCharacterIconForLevel(state.level || 1);
      return sendResponse({ ok: true, icon });
    }

    // Upgrade is instant now
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
      return sendResponse({
        ok: true,
        state: fresh,
        icon: fresh.characterIcon
      });
    }

    return sendResponse({ ok: false, err: "Unknown message" });
  })();

  return true;
});
