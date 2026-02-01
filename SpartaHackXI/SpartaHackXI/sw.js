// sw.js
import { getLevelDef } from "./gameConfig.js";

const DEFAULT_SETTINGS = {
  goodSites: [],
  badSites: [],
  xpPerMinuteGood: 15,  // ✅ Now configurable
  xpPerMinuteBad: 10    // ✅ Now configurable
};

// ❌ Remove this static object:
// const XP_RATES = Object.freeze({
//   good: 15,
//   bad: 10,
// });

// NOTE: xpToNext will be set from config on init
const DEFAULT_STATE = {
  xp: 0,
  level: 1,
  xpToNext: 0,
  pendingUpgrade: false,
  current: null
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
  if (!url || !(url.startsWith("http://") || url.startsWith("https://"))) {
    console.log('[Categorize] Not HTTP/HTTPS:', url);
    return "neutral";
  }
  
  const host = normalizeHost(url);
  if (!host) {
    console.log('[Categorize] Could not parse host from:', url);
    return "neutral";
  }

  console.log('[Categorize] Checking host:', host);
  console.log('[Categorize] Good sites list:', settings.goodSites);
  console.log('[Categorize] Bad sites list:', settings.badSites);

  if (hostMatchesList(host, settings.badSites)) {
    console.log('[Categorize] ❌ Matched BAD site!');
    return "bad";
  }
  
  if (hostMatchesList(host, settings.goodSites)) {
    console.log('[Categorize] ✅ Matched GOOD site!');
    return "good";
  }
  
  console.log('[Categorize] ➖ Neutral (no match)');
  return "neutral";
}

// ---------- Storage helpers ----------
async function getSettings() {
  if (settingsCache) return settingsCache;
  
  // ✅ Load from the TOP LEVEL keys (not nested in "settings")
  const res = await chrome.storage.sync.get(['goodSites', 'badSites', 'xpPerMinuteGood', 'xpPerMinuteBad']);
  
  settingsCache = {
    goodSites: res.goodSites || DEFAULT_SETTINGS.goodSites,
    badSites: res.badSites || DEFAULT_SETTINGS.badSites,
    xpPerMinuteGood: res.xpPerMinuteGood || DEFAULT_SETTINGS.xpPerMinuteGood,
    xpPerMinuteBad: res.xpPerMinuteBad || DEFAULT_SETTINGS.xpPerMinuteBad
  };
  
  console.log('[Settings] Loaded from storage:', settingsCache);
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
  
  // ✅ Save to TOP LEVEL keys (not nested)
  await chrome.storage.sync.set({
    goodSites: settingsCache.goodSites,
    badSites: settingsCache.badSites,
    xpPerMinuteGood: settingsCache.xpPerMinuteGood,
    xpPerMinuteBad: settingsCache.xpPerMinuteBad
  });
  
  console.log('[Settings] Saved to storage:', settingsCache);
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
// ---------- Time accounting ----------

// ✅ Track XP increments separately
let xpIncrementInterval = null;

// ✅ Start XP increment loop (runs every 5 seconds)
// ✅ Start XP increment loop (runs every 5 seconds)
function startXpIncrementLoop() {
  // Clear any existing interval
  if (xpIncrementInterval) {
    clearInterval(xpIncrementInterval);
  }

  xpIncrementInterval = setInterval(async () => {
    const state = await getState();
    const settings = await getSettings();
    const curr = state.current;

    console.log('[XP Loop] Running check...', {
      hasCurrent: !!curr,
      currentUrl: curr?.url,
      category: curr?.category,
      windowFocused: curr?.windowFocused,
      userIdle: curr?.userIdle,
      goodSites: settings.goodSites,
      badSites: settings.badSites,
      xpPerMinuteGood: settings.xpPerMinuteGood,
      xpPerMinuteBad: settings.xpPerMinuteBad
    });

    // Only award XP if session is active and focused
    if (!curr) {
      console.log('[XP Loop] ❌ No current session');
      return;
    }

    if (!curr.windowFocused) {
      console.log('[XP Loop] ❌ Window not focused');
      return;
    }

    if (curr.userIdle) {
      console.log('[XP Loop] ❌ User is idle');
      return;
    }

    // Only award XP for good/bad sites (not neutral)
    if (curr.category === 'neutral') {
      console.log('[XP Loop] ❌ Neutral site (no XP)');
      return;
    }

    // ✅ Award XP based on 5 seconds of time
    const minutesFraction = 5 / 60; // 5 seconds = 0.0833 minutes

    let xpDelta = 0;
    if (curr.category === 'good') {
      xpDelta = minutesFraction * (settings.xpPerMinuteGood || 15);
      console.log('[XP Loop] ✅ Good site detected!');
    } else if (curr.category === 'bad') {
      xpDelta = -minutesFraction * (settings.xpPerMinuteBad || 10);
      console.log('[XP Loop] ⚠️ Bad site detected!');
    }

    if (xpDelta !== 0) {
      const newXp = Math.max(0, (state.xp || 0) + xpDelta);
      await saveState({ xp: newXp });
      console.log(`[XP] ${curr.category} site: ${xpDelta > 0 ? '+' : ''}${xpDelta.toFixed(2)} XP (total: ${newXp.toFixed(2)})`);
    }
  }, 5000); // ✅ Run every 5 seconds
  
  console.log('[XP Loop] ✅ Started - will check every 5 seconds');
}

async function finalizeCurrentSession(reason) {
  const state = await getState();
  await saveState({ current: null });
  console.log(`[Session] Ended: ${reason}`);
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
  console.log(`[Session] Started: ${category} - ${tab.url}`);
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
// ---------- Lifecycle ----------
chrome.runtime.onInstalled.addListener(async () => {
  // ✅ Check if settings exist at TOP LEVEL
  const existing = await chrome.storage.sync.get(['goodSites', 'badSites', 'xpPerMinuteGood', 'xpPerMinuteBad']);
  
  if (!existing.goodSites || existing.goodSites.length === 0) {
    console.log('[Install] Setting up defaults...');
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
  
  // ✅ Start XP increment loop
  startXpIncrementLoop();
  
  console.log('[Install] Extension initialized!');
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
    // Window lost focus
    if (curr) {
      await saveState({ current: { ...curr, windowFocused: false } });
      console.log('[Focus] Window blurred - XP paused');
    }
  } else {
    // Window gained focus
    if (curr) {
      await saveState({ current: { ...curr, windowFocused: true } });
      console.log('[Focus] Window focused - XP resumed');
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
    console.log(`[Idle] User ${isIdle ? 'idle' : 'active'} - XP ${isIdle ? 'paused' : 'resumed'}`);
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
  
  // ✅ Save to top-level keys
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
